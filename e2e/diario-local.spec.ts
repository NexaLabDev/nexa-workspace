import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Testes sem login e sem writes no Supabase: verificam o módulo real do
// IndexedDB no navegador (não uma simulação da implementação).
const arquivo = path.join(process.cwd(), 'components/nexa/pendenciasLocais.ts');
const fonte = ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    isolatedModules: true,
  },
}).outputText;

test('IndexedDB: salva, recupera, isola contas e remove somente os dados confirmados', async ({ page }) => {
  await page.goto('/login');
  const resultado = await page.evaluate(async (codigo) => {
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    try {
      const modulo = await import(/* webpackIgnore: true */ url);
      const prefixo = crypto.randomUUID();
      const contaA = { id: `${prefixo}-a`, workspace_id: `${prefixo}-ws` };
      const contaB = { id: `${prefixo}-b`, workspace_id: contaA.workspace_id };
      const registro = {
        colecao: 'leads', id: `local-${prefixo}`, ordem: 0, versao: 0,
        conteudo: { id: `local-${prefixo}`, empresa: 'Teste isolado', status: 'novo' },
      };
      const antes = await modulo.lerEdicoesLocais(contaA);
      await modulo.gravarEdicoesLocais(contaA, [registro]);
      const depois = await modulo.lerEdicoesLocais(contaA);
      const outraConta = await modulo.lerEdicoesLocais(contaB);
      await modulo.gravarEdicoesLocais(contaA, []);
      const apagado = await modulo.lerEdicoesLocais(contaA);
      return { antes, depois, outraConta, apagado, registro };
    } finally { URL.revokeObjectURL(url); }
  }, fonte);
  expect(resultado.antes).toEqual([]);
  expect(resultado.depois).toEqual([resultado.registro]);
  expect(resultado.outraConta).toEqual([]);
  expect(resultado.apagado).toEqual([]);
});

test('IndexedDB: diário corrompido é recusado sem apagar o conteúdo original', async ({ page }) => {
  await page.goto('/login');
  const r = await page.evaluate(async (codigo) => {
    const id = crypto.randomUUID();
    const usuario = { id, workspace_id: crypto.randomUUID() };
    const chave = JSON.stringify([usuario.workspace_id, usuario.id]);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('nexa-workspace-edicoes-pendentes', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('pendencias')) req.result.createObjectStore('pendencias');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pendencias', 'readwrite');
      tx.objectStore('pendencias').put({ versao: 999, registros: [{ id: 'sem colecao' }] }, chave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    try {
      const modulo = await import(/* webpackIgnore: true */ url);
      let recusou = false;
      try { await modulo.lerEdicoesLocais(usuario); }
      catch { recusou = true; }
      const banco = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('nexa-workspace-edicoes-pendentes', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const original = await new Promise<unknown>((resolve, reject) => {
        const tx = banco.transaction('pendencias', 'readonly');
        const req = tx.objectStore('pendencias').get(chave);
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
      banco.close();
      return { recusou, original };
    } finally { URL.revokeObjectURL(url); }
  }, fonte);
  expect(r.recusou).toBe(true);
  expect(r.original).toEqual({ versao: 999, registros: [{ id: 'sem colecao' }] });
});


// Duas abas compartilham IndexedDB, mas não devem apagar registros diferentes.
// O teste usa duas páginas do MESMO contexto, sem Supabase/credenciais.
test('IndexedDB: duas abas preservam rascunhos distintos e impedem sobrescrita do mesmo registro', async ({ page, context }) => {
  const outra = await context.newPage();
  await Promise.all([page.goto('/login'), outra.goto('/login')]);
  async function carregar(p: typeof page) {
    await p.evaluate(async (codigo) => {
      const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
      try {
        (window as typeof window & { __diarioE2E?: unknown }).__diarioE2E =
          await import(/* webpackIgnore: true */ url);
      } finally { URL.revokeObjectURL(url); }
    }, fonte);
  }
  await Promise.all([carregar(page), carregar(outra)]);
  const id = crypto.randomUUID();
  const usuario = { id: `${id}-u`, workspace_id: `${id}-w` };
  const a = { colecao: 'leads', id: `${id}-a`, versao: 0, ordem: 0, conteudo: { id: `${id}-a`, empresa: 'A' } };
  const b = { colecao: 'leads', id: `${id}-b`, versao: 0, ordem: 1, conteudo: { id: `${id}-b`, empresa: 'B' } };
  const exec = async (p: typeof page, action: 'ler' | 'gravar', registros?: typeof a[]) =>
    p.evaluate(async ({ usuario, action, registros }) => {
      const diario = (window as typeof window & {
        __diarioE2E: { lerEdicoesLocais: (u: typeof usuario) => Promise<typeof registros>; gravarEdicoesLocais: (u: typeof usuario, r: typeof registros) => Promise<void> }
      }).__diarioE2E;
      if (action === 'ler') return diario.lerEdicoesLocais(usuario);
      await diario.gravarEdicoesLocais(usuario, registros ?? []);
      return null;
    }, { usuario, action, registros });

  await Promise.all([exec(page, 'ler'), exec(outra, 'ler')]);
  await exec(page, 'gravar', [a]);
  await exec(outra, 'gravar', [b]);
  // A primeira aba confirma somente a edição A; a B continua segura.
  await exec(page, 'gravar', []);
  const recuperado = await exec(outra, 'ler');
  expect(recuperado).toEqual([b]);

  // As duas abas leem o mesmo registro, mas tentam escrever versões distintas.
  await Promise.all([exec(page, 'ler'), exec(outra, 'ler')]);
  const b1 = { ...b, conteudo: { ...b.conteudo, empresa: 'A mudou B' } };
  const b2 = { ...b, conteudo: { ...b.conteudo, empresa: 'B mudou B' } };
  await exec(page, 'gravar', [b1]);
  let conflito = false;
  try { await exec(outra, 'gravar', [b2]); }
  catch { conflito = true; }
  expect(conflito).toBe(true);
  expect(await exec(page, 'ler')).toEqual([b1]);
  await outra.close();
});


// Simula um navegador que não fornece IndexedDB (modo restrito, bloqueio
// corporativo ou falha do armazenamento). Não deve fingir que o backup existe.
test('IndexedDB indisponível: falha claramente sem simular gravação concluída', async ({ page }) => {
  await page.goto('/login');
  const resultado = await page.evaluate(async (codigo) => {
    const uid = crypto.randomUUID();
    const perfil = { id: uid, workspace_id: crypto.randomUUID() };
    const registro = { colecao: 'leads', id: uid, ordem: 0, versao: 0, conteudo: { id: uid } };
    const descritorOriginal = Object.getOwnPropertyDescriptor(window, 'indexedDB');
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    try {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
      const modulo = await import(/* webpackIgnore: true */ url);
      try {
        await modulo.gravarEdicoesLocais(perfil, [registro]);
        return { falhou: false, mensagem: '' };
      } catch (e) {
        return { falhou: true, mensagem: e instanceof Error ? e.message : String(e) };
      }
    } finally {
      if (descritorOriginal) Object.defineProperty(window, 'indexedDB', descritorOriginal);
      else Reflect.deleteProperty(window, 'indexedDB');
      URL.revokeObjectURL(url);
    }
  }, fonte);
  expect(resultado.falhou).toBe(true);
  expect(resultado.mensagem).toMatch(/armazenamento persistente/i);
});
