import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const fonte = ts.transpileModule(
  fs.readFileSync(path.join(process.cwd(), 'components/nexa/backupValidacao.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;

test('backup: valida dados e anexos e recusa IDs duplicados, faltantes e caminhos', async ({ page }) => {
  await page.goto('/login');
  const resultado = await page.evaluate(async codigo => {
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    try {
      const m = await import(/* webpackIgnore: true */ url);
      const arquivo = { id: 'arq-1', tipo: 'text/plain', base64: btoa('teste') };
      const valido = {
        formato: 'nexa-workspace-backup', versao: 1, criadoEm: new Date().toISOString(),
        dados: { leads: [{ id: 'l-1', empresa: 'Teste', arquivoId: arquivo.id }] },
        arquivos: [arquivo],
      };
      const recusar = (b: unknown) => {
        try { m.validarBackup(b); return false; } catch { return true; }
      };
      return {
        certo: m.validarBackup(valido).arquivos[0].id,
        semAnexo: recusar({ ...valido, arquivos: [] }),
        duplicado: recusar({ ...valido, arquivos: [arquivo, arquivo] }),
        caminho: recusar({ ...valido, arquivos: [{ ...arquivo, id: '../secret' }] }),
        colecao: recusar({ ...valido, dados: { desconhecida: [] } }),
        idDuplicado: recusar({ ...valido, dados: { leads: [{ id: 'x' }, { id: 'x' }] } }),
        base64: recusar({ ...valido, arquivos: [{ ...arquivo, base64: '***' }] }),
        checksumInvalido: recusar({ ...valido, arquivos: [{ ...arquivo, sha256: 'ABC' }] }),
      };
    } finally { URL.revokeObjectURL(url); }
  }, fonte);
  expect(resultado).toEqual({
    certo: 'arq-1', semAnexo: true, duplicado: true, caminho: true,
    colecao: true, idDuplicado: true, base64: true, checksumInvalido: true,
  });
});

test('backup: SHA-256 detecta alteração de anexo mesmo com base64 válido', async ({ page }) => {
  await page.goto('/login');
  const r = await page.evaluate(async codigo => {
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
    try {
      const m = await import(/* webpackIgnore: true */ url);
      const bin = new TextEncoder().encode('arquivo de teste');
      const hash = await crypto.subtle.digest('SHA-256', bin);
      const hex = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
      const b = {
        formato: 'nexa-workspace-backup', versao: 1, criadoEm: new Date().toISOString(),
        dados: { documentos: [{ id: 'doc-1', arquivoId: 'arq-1' }] },
        arquivos: [{ id: 'arq-1', tipo: 'text/plain', base64: btoa('arquivo de teste'), sha256: hex }],
      };
      const valido = m.validarBackup(b);
      await m.verificarHashesBackup(valido);
      const adulterado = { ...valido, arquivos: [{ ...valido.arquivos[0], base64: btoa('arquivo adulterado') }] };
      let recusado = false;
      try { await m.verificarHashesBackup(m.validarBackup(adulterado)); }
      catch { recusado = true; }
      const legado = { ...valido, arquivos: [{ id: 'arq-1', tipo: 'text/plain', base64: btoa('arquivo antigo') }] };
      await m.verificarHashesBackup(m.validarBackup(legado));
      return { recusado };
    } finally { URL.revokeObjectURL(url); }
  }, fonte);
  expect(r.recusado).toBe(true);
});
