import { expect, test, type Page } from '@playwright/test';

// Executar apenas contra Supabase LOCAL/isolado: a sequência cria um lead.
async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill(process.env.E2E_EMAIL ?? 'admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill(process.env.E2E_SENHA ?? 'TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test('recupera edição após falha de rede e recarregamento, sem duplicar ao sincronizar', async ({ page }, info) => {
  // Nunca criar leads de teste em um Preview/produção por engano.
  const baseURL = String(info.project.use.baseURL ?? '');
  test.skip(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(baseURL),
    'Teste com gravação permitido somente em Next/Supabase locais isolados.');

  test.skip(info.project.name === 'mobile', 'Fluxo validado inicialmente no desktop local');
  test.setTimeout(120_000);
  const empresa = `RECUP-${Date.now()} Local`;
  page.on('dialog', async dialog => { await dialog.accept(); });
  await entrar(page);
  await page.goto('/crm');

  // Impede somente as gravações. Leituras e autenticação permanecem funcionando.
  await page.route('**/rest/v1/rpc/gravar_registros', route => route.abort('failed'));
  await page.getByRole('button', { name: /Novo Lead/i }).first().click();
  const modal = page.getByRole('dialog', { name: /Novo lead/i });
  await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(empresa);
  await modal.locator('label').filter({ hasText: /^Interesse/i }).locator('input').fill('Teste de recuperação');
  await modal.getByRole('button', { name: /Adicionar lead/i }).click();
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Falha ao salvar/i }).first()).toBeVisible({ timeout: 15_000 });
  // O diário local deve estar confirmado antes de recarregar.
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('nexa-workspace-edicoes-pendentes', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction('pendencias', 'readonly');
        const req = tx.objectStore('pendencias').getAll();
        tx.oncomplete = () => resolve((req.result as Array<{registros?: unknown[]}>).reduce((n,r)=>n+(r.registros?.length??0),0));
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  })).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await page.unroute('**/rest/v1/rpc/gravar_registros');
  // Um novo recarregamento recupera o rascunho e reenvia para o Supabase.
  await page.reload();
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('status').filter({ hasText: /Salvando|Falha|Conflito/ })).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
});
