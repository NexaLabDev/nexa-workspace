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
