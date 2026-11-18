import { test, expect, type Page } from '@playwright/test';

const local = (v: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(v);

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill('admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill('TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test('importação de backup novo funciona e conflito não sobrescreve registro', async ({ page }, info) => {
  test.skip(!local(String(info.project.use.baseURL ?? '')) ||
    !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') ||
    process.env.E2E_PERMITIR_GRAVACOES_LOCAIS !== 'SIM',
    'Teste de escrita disponível apenas com aplicação e Supabase locais isolados.');
  test.setTimeout(120_000);

  await entrar(page);
  await page.goto('/configuracoes');
  const id = `l-import-${Date.now()}`;
  const empresa = `Empresa importada ${id}`;
  const lead = {
    id, empresa, descricao: 'Teste sintético', valor: null,
    cor: '#777878', etapa: 'novo', historico: [], comentarios: [],
  };
  const backup = (dados: unknown) => ({
    formato: 'nexa-workspace-backup',
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados: { leads: [dados] },
    arquivos: [],
  });
  const selecionar = async (dados: unknown) => {
    await page.locator('input[type=file][accept*=".json"]').setInputFiles({
      name: 'nexa-backup-test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup(dados))),
    });
    await expect(page.getByRole('list', { name: 'Prévia da importação' })).toContainText('Leads: 1 registro(s)');
  };
  page.on('dialog', d => d.accept());
  await selecionar(lead);
  await page.getByRole('button', { name: /Confirmar importação/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /1 registro\(s\) novo\(s\) importado/i })).toBeVisible({ timeout: 30_000 });

  // A tentativa de restaurar um mesmo ID com conteúdo diferente é barrada.
  await selecionar({ ...lead, empresa: 'CONFLITO QUE NÃO PODE SOBRESCREVER' });
  await page.getByRole('button', { name: /Confirmar importação/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /ID já existente com conteúdo diferente/i }))
    .toBeVisible({ timeout: 30_000 });

  await page.goto('/crm');
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('CONFLITO QUE NÃO PODE SOBRESCREVER', { exact: true })).toHaveCount(0);
});
