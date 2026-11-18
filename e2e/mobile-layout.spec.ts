import { expect, test, type Page } from '@playwright/test';

const local = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url);
async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill('admin@teste.local');
  await page.getByLabel(/^Senha$/i).fill('TesteAdmin!123');
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 });
}

test('celular: páginas dentro da tela, rolagem vertical própria e menu acessível', async ({ page }, info) => {
  test.skip(!local(String(info.project.use.baseURL ?? '')) ||
    !local(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '') ||
    process.env.E2E_PERMITIR_GRAVACOES_LOCAIS !== 'SIM',
    'Teste somente no Supabase local descartável.');
  test.setTimeout(160_000);
  await page.setViewportSize({ width: 375, height: 740 });
  await entrar(page);
  const rotas = ['/', '/crm', '/kanban', '/clientes', '/conversas', '/documentos', '/recebimentos', '/configuracoes'];
  for (const rota of rotas) {
    await page.goto(rota);
    await expect(page.locator('main').first()).toBeVisible();
    const dimensoes = await page.evaluate(() => {
      const w = window.innerWidth;
      const principais = Array.from(document.querySelectorAll<HTMLElement>(
        'main, section[class*="_painel_"], div[class*="_pagina_"], header[class*="_cabecalho_"]'
      )).filter((e) => {
        if (e.closest('[data-nexa-scroll]')) return false; // colunas deslizam horizontalmente
        const css = getComputedStyle(e);
        const rect = e.getBoundingClientRect();
        return css.display !== 'none' && rect.width > 1 && rect.height > 1;
      });
      const excedentes = principais.filter(e => {
        const r = e.getBoundingClientRect();
        return r.left < -3 || r.right > w + 3;
      }).map(e => ({ classe: e.className, esquerda: Math.round(e.getBoundingClientRect().left), direita: Math.round(e.getBoundingClientRect().right) }));
      const area = document.querySelector<HTMLElement>('main[class*="_principal_"]');
      const menu = document.querySelector<HTMLElement>('nav[class*="_navCelular_"]');
      return {
        largura: w,
        excedentes,
        areaRola: area ? getComputedStyle(area).overflowY : null,
        menuPosicao: menu ? getComputedStyle(menu).position : null,
        menuTemRolagem: menu ? menu.scrollWidth > menu.clientWidth : false,
        principalFinal: area ? Math.round(area.getBoundingClientRect().bottom) : null,
        menuInicio: menu ? Math.round(menu.getBoundingClientRect().top) : null,
      };
    });
    expect(dimensoes.excedentes, `overflow em ${rota}: ${JSON.stringify(dimensoes.excedentes)}`).toEqual([]);
    expect(dimensoes.areaRola, `rolagem em ${rota}`).toBe('auto');
    expect(dimensoes.menuPosicao).toBe('relative');
    expect(dimensoes.principalFinal).toBeLessThanOrEqual((dimensoes.menuInicio ?? 0) + 1);
    expect(dimensoes.menuTemRolagem).toBe(true);
    // A navegação ocupa espaço reservado, sem cobrir o último conteúdo.
    let final = { distanciaFim: Infinity, ultimoFim: Infinity, menuInicio: -1 };
    await expect.poll(async () => {
      final = await page.evaluate(async () => {
      const principal = document.querySelector<HTMLElement>('main[class*="_principal_"]');
      const menu = document.querySelector<HTMLElement>('nav[class*="_navCelular_"]');
      if (!principal || !menu) throw Error('Estrutura mobile não encontrada');
      principal.scrollTop = principal.scrollHeight;
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const ultimo = principal.lastElementChild as HTMLElement | null;
      return {
        distanciaFim: principal.scrollHeight - principal.clientHeight - principal.scrollTop,
        ultimoFim: ultimo ? ultimo.getBoundingClientRect().bottom : 0,
        menuInicio: menu.getBoundingClientRect().top,
      };
      });
      return final.distanciaFim;
    }, { timeout: 20000, intervals: [100, 250, 500] })
      .toBeLessThanOrEqual(2);
    expect(final.ultimoFim, `último elemento encoberto pelo menu em ${rota}`).toBeLessThanOrEqual(final.menuInicio + 2);
  }
  // O menu horizontal deve continuar navegável até a última aba.
  const menu = page.locator('nav[class*="_navCelular_"]');
  await menu.getByText('Ajustes').scrollIntoViewIfNeeded();
  await expect(menu.getByText('Ajustes')).toBeInViewport();
});
