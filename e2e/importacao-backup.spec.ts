import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const local = (v: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(v);

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill('admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill('TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test('backup: importa lead/anexo, recupera arquivo ausente e recusa sobrescrita', async ({ page }, info) => {
  test.skip(!local(String(info.project.use.baseURL ?? '')) ||
    !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') ||
    process.env.E2E_PERMITIR_GRAVACOES_LOCAIS !== 'SIM',
    'Teste de escrita permitido apenas com aplicação e Supabase locais isolados.');
  test.setTimeout(160_000);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const db = createClient(supabaseUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await db.auth.signInWithPassword({
    email: 'admin@teste.local', password: 'TesteAdmin!123',
  });
  if (login.error) throw login.error;
  const { data: workspace } = await db.rpc('workspace_id_atual');
  expect(workspace).toBeTruthy();

  await entrar(page);
  await page.goto('/configuracoes');
  const id = `l-import-${Date.now()}`;
  const empresa = `Empresa importada ${id}`;
  const anexoId = `arq-${Date.now()}-original`;
  const bytes = Buffer.from('Documento sintético de teste do Nexa Workspace');
  const montarAnexo = (aid: string) => ({
    id: aid,
    tipo: 'text/plain',
    base64: bytes.toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const lead = {
    id, empresa, descricao: 'Teste sintético', valor: null,
    cor: '#777878', etapa: 'novo', historico: [], comentarios: [],
    arquivoId: anexoId,
  };
  const backup = (dados: unknown, anexos: unknown[]) => ({
    formato: 'nexa-workspace-backup',
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados: { leads: [dados] },
    arquivos: anexos,
  });
  const selecionar = async (dados: unknown, anexos: unknown[]) => {
    await page.locator('input[type=file][accept*=".json"]').setInputFiles({
      name: 'nexa-backup-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup(dados, anexos))),
    });
    await expect(page.getByRole('list', { name: 'Prévia da importação' }))
      .toContainText('Leads: 1 registro(s)');
  };
  const storage = db.storage.from('nexa-arquivos');
  const lerAnexo = async (aid: string) => storage.download(`${workspace}/${aid}`);
  page.on('dialog', d => d.accept());

  await selecionar(lead, [montarAnexo(anexoId)]);
  await page.getByRole('button', { name: /Confirmar importação/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /1 registro\(s\) recuperado\(s\) ou importado/i }))
    .toBeVisible({ timeout: 30_000 });
  const original = await lerAnexo(anexoId);
  expect(original.error).toBeNull();
  expect(Buffer.from(await original.data!.arrayBuffer())).toEqual(bytes);

  // O registro já existe, mas seu arquivo desapareceu. Reimportar deve trazer
  // o arquivo de volta sem sobrescrever ou duplicar o lead.
  const removeu = await storage.remove([`${workspace}/${anexoId}`]);
  expect(removeu.error).toBeNull();
  expect((await lerAnexo(anexoId)).error).toBeTruthy();
  // O exportador não pode entregar um JSON aparentemente completo se um anexo
  // referenciado estiver ausente no Storage. Só vale no Supabase descartável.
  await page.getByRole('button', { name: /Baixar backup do workspace/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /Backup incompleto/i }))
    .toBeVisible({ timeout: 30_000 });
  await selecionar(lead, [montarAnexo(anexoId)]);
  await page.getByRole('button', { name: /Confirmar importação/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /0 registro\(s\) recuperado\(s\) ou importado\(s\); 1 anexo/i }))
    .toBeVisible({ timeout: 30_000 });
  const recuperado = await lerAnexo(anexoId);
  expect(recuperado.error).toBeNull();
  expect(Buffer.from(await recuperado.data!.arrayBuffer())).toEqual(bytes);

  // Download real do backup da nuvem pela interface. Verifica o arquivo .json
  // exportado, o lead, a inclusão do anexo e a integridade SHA-256 dos bytes.
  const baixando = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar backup do workspace/i }).click();
  const download = await baixando;
  expect(download.suggestedFilename()).toMatch(/^nexa-workspace-nuvem-.*\.json$/);
  const stream = await download.createReadStream();
  const partes: Buffer[] = [];
  for await (const parte of stream) partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte));
  const exportado = JSON.parse(Buffer.concat(partes).toString('utf8')) as {
    formato: string;
    versao: number;
    dados: { leads?: Array<{ id: string; empresa?: string }> };
    arquivos: Array<{ id: string; base64: string; sha256?: string }>;
  };
  expect(exportado.formato).toBe('nexa-workspace-backup');
  expect(exportado.versao).toBe(1);
  expect(exportado.dados.leads?.filter(r => r.id === id)).toHaveLength(1);
  expect(exportado.dados.leads?.find(r => r.id === id)?.empresa).toBe(empresa);
  const arquivoExportado = exportado.arquivos.find(a => a.id === anexoId);
  expect(arquivoExportado).toBeTruthy();
  expect(Buffer.from(arquivoExportado!.base64, 'base64')).toEqual(bytes);
  expect(arquivoExportado!.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));

  // A prévia deve detectar o conflito antes de enviar novo anexo ao Storage.
  const outroAnexoId = `arq-${Date.now()}-bloqueado`;
  await selecionar({ ...lead, empresa: 'CONFLITO NÃO PODE SOBRESCREVER', arquivoId: outroAnexoId },
    [montarAnexo(outroAnexoId)]);
  await page.getByRole('button', { name: /Confirmar importação/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /ID já existente com conteúdo diferente/i }))
    .toBeVisible({ timeout: 30_000 });
  expect((await lerAnexo(outroAnexoId)).error).toBeTruthy();

  await page.goto('/crm');
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('CONFLITO NÃO PODE SOBRESCREVER', { exact: true })).toHaveCount(0);
});
