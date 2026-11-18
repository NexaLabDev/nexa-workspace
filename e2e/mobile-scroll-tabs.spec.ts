import { expect, test, type Page } from '@playwright/test';

const local = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(url);
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill('admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill('TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 });
}
function somenteLocal(baseURL: unknown) {
  return local(String(baseURL ?? '')) && local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') &&
    process.env.E2E_PERMITIR_GRAVACOES_LOCAIS === 'SIM';
}

test('menu mobile: alternar entre abas no lado direito não faz a barra voltar', async ({ page }, info) => {
  test.skip(!somenteLocal(info.project.use.baseURL), 'Apenas aplicação e Supabase descartáveis.');
  test.setTimeout(130_000);
  await page.setViewportSize({ width: 375, height: 740 });
  await login(page);
  await page.goto('/configuracoes');
  const nav = page.locator('nav[class*="_navCelular_"]');
  await expect(nav).toBeVisible();
  const maximo = await nav.evaluate((e) => {
    e.scrollLeft = e.scrollWidth - e.clientWidth;
    return e.scrollLeft;
  });
  expect(maximo).toBeGreaterThan(180);

  // Todos os links usados ficam no trecho direito; não há motivo legítimo
  // para a barra voltar ao primeiro item em nenhuma destas trocas.
  for (const href of ['/documentos', '/configuracoes', '/documentos', '/configuracoes', '/documentos']) {
    await nav.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href + '$'));
    await expect(nav.locator(`a[href="${href}"]`)).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => nav.evaluate((e) => e.scrollLeft), { timeout: 10000 })
      .toBeGreaterThan(maximo - 16);
  }

  await expect(page.getByRole('heading', { name: 'Gerador de Documentos' }).first())
    .toBeVisible({ timeout: 20000 });
  const linksAtivos = await nav.locator('a[aria-current="page"]').count();
  expect(linksAtivos).toBe(1);
});

test('menu mobile: após mudar aba, posição vertical de Configurações é recuperada', async ({ page }, info) => {
  test.skip(!somenteLocal(info.project.use.baseURL), 'Apenas aplicação e Supabase descartáveis.');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 660 });
  await login(page);
  await page.goto('/configuracoes');
  const main = page.locator('main[class*="_principal_"]');
  await expect(main).toBeVisible();
  const anterior = await main.evaluate(e => {
    e.scrollTop = Math.min(e.scrollHeight, 520);
    return e.scrollTop;
  });
  expect(anterior).toBeGreaterThan(100);

  const nav = page.locator('nav[class*="_navCelular_"]');
  await nav.locator('a[href="/documentos"]').click();
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole('heading', { name: 'Gerador de Documentos' }).first()).toBeVisible();
  await nav.locator('a[href="/configuracoes"]').click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole('heading', { name: 'Configurações' }).first()).toBeVisible();
  await expect.poll(() => main.evaluate(e => e.scrollTop), { timeout: 15000 })
    .toBeGreaterThan(anterior - 30);
});

test('viewport mobile curto: barra e rodapé continuam acessíveis sem sobreposição', async ({ page }, info) => {
  test.skip(!somenteLocal(info.project.use.baseURL), 'Apenas aplicação e Supabase descartáveis.');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 375, height: 540 });
  await login(page);
  await page.goto('/configuracoes');
  await expect(page.locator('main[class*="_principal_"]')).toBeVisible();
  await expect(page.locator('nav[class*="_navCelular_"]')).toBeVisible();
  const final = await page.evaluate(async () => {
    const main = document.querySelector<HTMLElement>('main[class*="_principal_"]');
    const menu = document.querySelector<HTMLElement>('nav[class*="_navCelular_"]');
    if (!main || !menu) throw Error('NexaShell mobile indisponível');
    main.scrollTop = main.scrollHeight;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const ultimo = main.lastElementChild as HTMLElement | null;
    return {
      restante: main.scrollHeight - main.clientHeight - main.scrollTop,
      fim: ultimo?.getBoundingClientRect().bottom ?? -1,
      menuInicio: menu.getBoundingClientRect().top,
      menuFinal: menu.getBoundingClientRect().bottom,
      altura: innerHeight,
    };
  });
  expect(final.restante).toBeLessThanOrEqual(2);
  expect(final.fim).toBeLessThanOrEqual(final.menuInicio + 2);
  expect(final.menuFinal).toBeLessThanOrEqual(final.altura + 2);
});
