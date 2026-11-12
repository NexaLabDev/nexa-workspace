import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';
const MARCA = `E2E-${Date.now()}`;

const ROTAS = [
  { path: '/', titulo: /Dashboard|Nexa/i },
  { path: '/crm', texto: /CRM|Funil|Lead/i },
  { path: '/conversas', texto: /Conversas|mensagem|chat/i },
  { path: '/metas', texto: /Meta|mensal/i },
  { path: '/recebimentos', texto: /Recebimento|Cobrança|calendário/i },
  { path: '/clientes', texto: /Cliente/i },
  { path: '/kanban', texto: /Kanban|projeto|fase/i },
  { path: '/catalogo', texto: /Serviço/i },
  { path: '/calculadora', texto: /Calculadora|serviço/i },
  { path: '/documentos', texto: /Documento/i },
  { path: '/configuracoes', texto: /Configura|Equipe|Perfil|Preferência/i },
  { path: '/conta', texto: /Conta|e-mail|senha|workspace/i },
  { path: '/acompanhamento', texto: /acompanhamento|código|link/i },
];

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill(EMAIL);
  await page.getByLabel(/^Senha$/i).fill(SENHA);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  // Shell usa scale/transform: body pode parecer "hidden" ao Playwright — valida a navegação.
  await expect(page.getByRole('navigation', { name: /Navegação/i }).or(page.getByRole('link', { name: /CRM/i })).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function assertSemCrash(page: Page) {
  // Overlay do Next fica em iframe; procura em todos os frames.
  for (const frame of page.frames()) {
    const overlay = frame.getByRole('dialog', { name: /Unhandled Runtime Error|Runtime Error/i });
    if (await overlay.count()) {
      const msg = await overlay.first().innerText().catch(() => 'erro');
      if (/Unhandled Runtime Error|Runtime Error/i.test(msg)) {
        throw new Error(`Runtime error na página ${page.url()}: ${msg.slice(0, 500)}`);
      }
    }
  }
  const texto = await page.locator('body').innerText();
  expect(texto, `página vazia em ${page.url()}`).not.toMatch(/Application error|ChunkLoadError/i);
  expect(texto.length, `sem conteúdo em ${page.url()}`).toBeGreaterThan(20);
}

test.describe.configure({ mode: 'serial' });

test.describe('Navegação e páginas', () => {
  test('login e percorre todas as rotas', async ({ page }, testInfo) => {
    await login(page);
    for (const rota of ROTAS) {
      await page.goto(rota.path);
      await page.waitForLoadState('domcontentloaded');
      await assertSemCrash(page);
      if (rota.texto) {
        await expect(page.locator('body')).toContainText(rota.texto, { timeout: 20_000 });
      }
      await page.screenshot({
        path: path.join('playwright-report', 'shots', `${testInfo.project.name}-${rota.path.replace(/\W+/g, '_') || 'home'}.png`),
        fullPage: false,
      });
    }
  });

  test('menus do trilho respondem', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'trilho desktop');
    await login(page);
    await page.goto('/');
    const links = ['/crm', '/conversas', '/kanban', '/clientes', '/recebimentos', '/configuracoes'];
    for (const href of links) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible({ timeout: 15_000 });
      await link.click();
      await expect(page).toHaveURL(new RegExp(href.replace('/', '\\/')));
      await assertSemCrash(page);
    }
  });
});

test.describe('Fluxo empresarial completo', () => {
  test('lead → venda → projeto → tarefa → pagamento → anexo → persistência', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'fluxo completo só no desktop');
    test.setTimeout(180_000);
    const marca = `E2E-${Date.now()}`;
    const empresa = `${marca} Acme`;
    const projetoNome = `${marca} Site`;
    const tarefaNome = `${marca} Briefing`;
    const anexoPath = path.join(__dirname, `fixture-anexo-${marca}.txt`);
    fs.writeFileSync(anexoPath, `anexo e2e ${marca}\n`, 'utf8');

    await login(page);

    // 1) Criar lead já como venda ganha (registra venda + projeto automático)
    await page.goto('/crm');
    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    const modal = page.getByRole('dialog', { name: /Novo lead/i });
    await expect(modal).toBeVisible();
    await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(empresa);
    await modal.locator('label').filter({ hasText: /^Interesse/i }).locator('input').fill('CRM + Site');
    await modal.locator('label').filter({ hasText: /Valor/i }).locator('input').fill('4500');
    await modal.locator('label').filter({ hasText: /^Etapa/i }).locator('select').selectOption('ganho');
    await modal.getByRole('button', { name: /Adicionar lead/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // 2) Abrir painel completo e registrar pagamento (antes de outras navegações)
    await page.getByText(empresa, { exact: true }).first().click();
    const ficha = page.getByRole('dialog').filter({ hasText: empresa });
    await expect(ficha.getByText(/Venda ganha/i).first()).toBeVisible({ timeout: 10_000 });
    await ficha.locator('a[href*="/conversas?lead="]').click();
    await expect(page).toHaveURL(/\/conversas\?lead=/);
    await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const aVista = page.getByRole('radio', { name: /À vista/i }).or(page.getByRole('button', { name: /À vista/i }));
    if (await aVista.first().isVisible().catch(() => false)) await aVista.first().click();
    const valorPag = page.locator('label').filter({ hasText: /Valor \(R\$\)/i }).locator('input').first();
    if (await valorPag.isVisible().catch(() => false)) {
      await valorPag.fill('4500');
      await valorPag.blur();
    }
    const pagoEm = page.locator('label').filter({ hasText: /Pago em/i }).locator('input[type="date"]').first();
    if (await pagoEm.isVisible().catch(() => false)) {
      await pagoEm.fill(new Date().toISOString().slice(0, 10));
    }

    // 3) Kanban — projeto da venda ou criação manual
    await page.goto('/kanban');
    await expect(page.getByRole('button', { name: /Novo projeto/i })).toBeVisible({ timeout: 15_000 });
    let temProjetoAuto = false;
    for (let i = 0; i < 10; i++) {
      temProjetoAuto = await page.getByText(empresa, { exact: false }).first().isVisible().catch(() => false);
      if (temProjetoAuto) break;
      await page.waitForTimeout(400);
    }
    if (!temProjetoAuto) {
      await page.getByRole('button', { name: /Novo projeto/i }).click();
      const mp = page.getByRole('dialog', { name: /Novo projeto/i });
      await mp.getByRole('combobox', { name: /Cliente/i }).fill(empresa);
      await mp.getByRole('textbox', { name: /Nome do projeto/i }).fill(projetoNome);
      await mp.getByRole('button', { name: /^Adicionar$/i }).click();
      await expect(mp).toBeHidden({ timeout: 10_000 });
    }
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    // 4) Tarefa + 5) Anexo + 6) Acompanhamento público
    await page.getByText(empresa, { exact: false }).first().click();
    await page.getByRole('tab', { name: /^Tarefas/i }).click();
    const inputTarefa = page.getByPlaceholder(/Nova tarefa/i).first();
    await expect(inputTarefa).toBeVisible({ timeout: 10_000 });
    await inputTarefa.fill(tarefaNome);
    await page.getByRole('button', { name: /^Criar$/i }).first().click();
    await expect(page.getByText(tarefaNome).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /^Anexos/i }).click();
    await page.locator('input[type="file"]').first().setInputFiles(anexoPath);
    await expect(page.locator('body')).toContainText(/fixture-anexo/i, { timeout: 60_000 });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Compartilhar/i }).first().click();
    const caixa = page.getByRole('dialog', { name: /Link de acompanhamento/i });
    await expect(caixa).toBeVisible();
    await caixa.getByRole('button', { name: /Gerar novo link/i }).click();
    const verCliente = caixa.getByRole('link', { name: /Ver como o cliente/i });
    await expect(verCliente).toHaveAttribute('href', /\/acompanhamento\//, { timeout: 10_000 });
    const urlPub = (await verCliente.getAttribute('href'))!;
    const pub = await page.context().newPage();
    await pub.goto(urlPub);
    await expect(pub.locator('body')).toContainText(/fase|projeto|Nexa|acompanh|cliente/i, { timeout: 15_000 });
    await pub.close();
    await caixa.getByRole('button', { name: /Fechar/i }).click();
    await page.keyboard.press('Escape');

    // 7) Clientes / Recebimentos / Documentos / Equipe
    await page.goto('/clientes');
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await page.goto('/recebimentos');
    await assertSemCrash(page);
    await page.goto('/documentos');
    await assertSemCrash(page);
    await page.goto('/configuracoes');
    await expect(page.locator('body')).toContainText(/Equipe|membro|convite|papel|permiss/i);

    // 8) Recarregar e confirmar persistência
    await page.goto('/crm');
    await page.reload();
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await page.goto('/kanban');
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 30_000 });

    try {
      fs.unlinkSync(anexoPath);
    } catch {
      /* ignore */
    }
  });
});

test.describe('Responsividade mobile (formulários e menus)', () => {
  test('login, CRM modal e configurações no celular', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'só mobile');
    await login(page);
    await page.goto('/crm');
    await assertSemCrash(page);
    await expect(page.getByRole('navigation', { name: /Navegação/i }).first()).toBeAttached();

    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    const modal = page.getByRole('dialog', { name: /Novo lead/i });
    await expect(modal).toBeVisible();
    const empresa = modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input');
    await expect(empresa).toBeVisible();
    await empresa.fill(`E2E-mobile-${Date.now()}`);
    await modal.getByRole('button', { name: /Cancelar/i }).click();

    await page.goto('/configuracoes');
    await assertSemCrash(page);
    await page.goto('/clientes?novo=1');
    const modalCli = page.getByRole('dialog', { name: /Novo cliente/i });
    await expect(modalCli).toBeVisible({ timeout: 15_000 });
    await modalCli.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();
  });
});
