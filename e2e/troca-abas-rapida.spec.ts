import { expect, test, type Page } from '@playwright/test';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill(process.env.E2E_EMAIL ?? 'admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill(process.env.E2E_SENHA ?? 'TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\\/login/);
  await expect(page.getByRole('navigation', { name: 'Navegação' }).first()).toBeVisible();
}

test('troca de aba pelo menu sem aguardar nova resposta RSC do servidor', async ({ page }) => {
  await entrar(page);
  const requisicoesRsc: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname === '/kanban' && url.searchParams.has('_rsc')) requisicoesRsc.push(req.url());
  });
  const menu = page.getByRole('navigation', { name: 'Navegação' }).first();
  await menu.locator('a[href="/kanban"]').click();
  await expect(page).toHaveURL(/\\/kanban$/);
  await expect(page.getByRole('heading', { name: 'Kanban', exact: true })).toBeVisible();
  expect(requisicoesRsc).toEqual([]);
  await menu.locator('a[href="/crm"]').click();
  await expect(page).toHaveURL(/\\/crm$/);
  await expect(page.getByRole('heading', { name: /CRM/i }).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\\/kanban$/);
  await expect(page.getByRole('heading', { name: 'Kanban', exact: true })).toBeVisible();
});
