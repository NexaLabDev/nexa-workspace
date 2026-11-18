import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill(process.env.E2E_EMAIL ?? 'admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill(process.env.E2E_SENHA ?? 'TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.locator('nav[aria-label="Navegação"]').first()).toBeAttached();
}

test('CRM → Kanban → CRM mantém a sessão e a rolagem lateral', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Rolagem lateral do funil validada no desktop estreito');
  await login(page);
  await page.setViewportSize({ width: 1080, height: 850 });
  await page.goto('/crm');

  const funil = page.locator('[data-nexa-scroll="crm-funil"]');
  await expect(funil).toBeVisible();
  const anterior = await funil.evaluate((el) => {
    el.scrollLeft = 240;
    return el.scrollLeft;
  });
  expect(anterior, 'O funil precisa ter rolagem horizontal nessa largura').toBeGreaterThan(0);

  // Detecta se o layout compartilhado voltou a mostrar o carregamento.
  await page.evaluate(() => {
    const w = window as typeof window & { __nexaTeveLoader?: boolean; __nexaObserver?: MutationObserver };
    w.__nexaTeveLoader = false;
    const verificar = () => {
      if (document.body.textContent?.includes('Carregando os dados do workspace…')) w.__nexaTeveLoader = true;
    };
    const observer = new MutationObserver(verificar);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    w.__nexaObserver = observer;
  });

  const menu = page.locator('nav[aria-label="Navegação"]').first();
  await menu.locator('a[href="/kanban"]').click();
  await expect(page).toHaveURL(/\/kanban$/);
  await expect(page.locator('[data-nexa-scroll="kanban-board"]')).toBeVisible();
  await menu.locator('a[href="/crm"]').click();
  await expect(page).toHaveURL(/\/crm$/);
  await expect.poll(() => page.locator('[data-nexa-scroll="crm-funil"]').evaluate((el) => el.scrollLeft)).toBeGreaterThanOrEqual(anterior - 5);
  expect(await page.evaluate(() => (window as typeof window & { __nexaTeveLoader?: boolean }).__nexaTeveLoader)).toBe(false);
  await page.evaluate(() => (window as typeof window & { __nexaObserver?: MutationObserver }).__nexaObserver?.disconnect());
});
