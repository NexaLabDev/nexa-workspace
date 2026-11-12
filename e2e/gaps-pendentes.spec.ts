import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';

async function login(page: Page, email = EMAIL, senha = SENHA) {
  await page.goto('/login');
  await page.getByLabel(/E-mail/i).fill(email);
  await page.getByLabel(/^Senha$/i).fill(senha);
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await expect(page.getByRole('navigation', { name: /Navegação/i }).or(page.getByRole('link', { name: /CRM/i })).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function assertSemCrash(page: Page) {
  for (const frame of page.frames()) {
    const overlay = frame.getByRole('dialog', { name: /Unhandled Runtime Error|Runtime Error/i });
    if (await overlay.count()) {
      const msg = await overlay.first().innerText().catch(() => 'erro');
      if (/Unhandled Runtime Error|Runtime Error/i.test(msg)) {
        throw new Error(`Runtime error em ${page.url()}: ${msg.slice(0, 500)}`);
      }
    }
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Gaps pendentes — CRM etapa, subtarefa, conversa, docs, equipe', () => {
  test('movimenta lead entre etapas (ficha + drag no funil)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'DnD funil só desktop');
    test.setTimeout(120_000);
    const empresa = `GAP-${Date.now()} Funil`;
    await login(page);

    await page.goto('/crm');
    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    const modal = page.getByRole('dialog', { name: /Novo lead/i });
    await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(empresa);
    await modal.locator('label').filter({ hasText: /^Interesse/i }).locator('input').fill('Movimentação de etapa');
    await modal.locator('label').filter({ hasText: /^Etapa/i }).locator('select').selectOption('novo');
    await modal.getByRole('button', { name: /Adicionar lead/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Abrir ficha e mudar etapa via select (force: shell usa scale/transform)
    await page.getByRole('button', { name: new RegExp(empresa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
    const ficha = page.getByRole('dialog', { name: new RegExp(`Ficha de ${empresa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
    await expect(ficha).toBeVisible({ timeout: 10_000 });
    await ficha.getByRole('combobox', { name: /^Etapa$/i }).selectOption('contato', { force: true });
    await ficha.getByRole('button', { name: /Fechar ficha/i }).click({ force: true });
    await expect(ficha).toBeHidden({ timeout: 10_000 });

    // Confirma etapa Contato na coluna (após select da ficha)
    await expect(page.getByRole('region', { name: /Contato Inicial/i }).getByText(empresa, { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // A11y DnD do @hello-pangea/dnd: Space levanta, setas movem, Space solta
    const card = page.getByRole('button', { name: new RegExp(empresa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first();
    await card.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight'); // Contato → Proposta
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await expect(page.getByRole('region', { name: /Proposta Enviada/i }).getByText(empresa, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('subtarefa, mensagem em conversas, documentos e equipe', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'fluxo detalhado desktop');
    test.setTimeout(150_000);
    const marca = `GAP-${Date.now()}`;
    const empresa = `${marca} Ops`;
    const tarefa = `${marca} Tarefa`;
    const sub = `${marca} Sub`;

    await login(page);

    // Lead ganho → painel conversas → mensagem
    await page.goto('/crm');
    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    const modal = page.getByRole('dialog', { name: /Novo lead/i });
    await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(empresa);
    await modal.locator('label').filter({ hasText: /^Interesse/i }).locator('input').fill('Ops E2E');
    await modal.locator('label').filter({ hasText: /Valor/i }).locator('input').fill('1200');
    await modal.locator('label').filter({ hasText: /^Etapa/i }).locator('select').selectOption('ganho');
    await modal.getByRole('button', { name: /Adicionar lead/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await page.getByText(empresa, { exact: true }).first().click();
    await page.locator('a[href*="/conversas?lead="]').first().click();
    await expect(page).toHaveURL(/\/conversas/);
    await expect(page.getByText(empresa, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const msg = page.getByPlaceholder(/Digite uma mensagem/i);
    if (await msg.isVisible().catch(() => false)) {
      await msg.fill(`Olá ${marca}`);
      await msg.press('Enter');
      await expect(page.getByText(`Olá ${marca}`).first()).toBeVisible({ timeout: 10_000 });
    }

    // Kanban → tarefa → subtarefa
    await page.goto('/kanban');
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(empresa, { exact: false }).first().click();
    await page.getByRole('tab', { name: /^Tarefas/i }).click();
    const inputTarefa = page.getByPlaceholder(/Nova tarefa/i).first();
    await inputTarefa.fill(tarefa);
    await page.getByRole('button', { name: /^Criar$/i }).first().click();
    const painelTarefas = page.locator('#painel-tarefas');
    await expect(painelTarefas.getByText(tarefa).first()).toBeVisible({ timeout: 10_000 });
    await painelTarefas.getByRole('button', { name: tarefa, exact: true }).click({ force: true });
    const inputSub = painelTarefas.getByPlaceholder(/Nova subtarefa/i);
    await expect(inputSub).toBeVisible({ timeout: 10_000 });
    await inputSub.fill(sub);
    await inputSub.press('Enter');
    await expect(painelTarefas.getByRole('checkbox', { name: new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible({
      timeout: 10_000,
    });
    // Aguarda o lote remoto (debounce 300ms + RPC) antes de sair da janela
    await expect(page.getByRole('status').filter({ hasText: /Salvo|salvo/i })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);

    // Reabre na mesma sessão (sem full reload) para validar o estado em memória/sync
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.getByText(empresa, { exact: false }).first().click();
    await page.getByRole('tab', { name: /^Tarefas/i }).click();
    await page.locator('#painel-tarefas').getByRole('button', { name: tarefa, exact: true }).click({ force: true });
    await expect(page.locator('#painel-tarefas').getByRole('checkbox', { name: new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');

    // Documentos — tela de geração
    await page.goto('/documentos');
    await assertSemCrash(page);
    await expect(page.getByText(/Gerar documento|Proposta|Contrato/i).first()).toBeVisible({ timeout: 15_000 });

    // Equipe / permissões
    await page.goto('/configuracoes');
    await expect(page.getByText(/Equipe|Perfil:|Administrador|Gestor|Colaborador|Visualizador/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('body')).toContainText(/administrador|gestor|colaborador|visualizador/i);

    // Persistência da subtarefa após reload
    await page.goto('/kanban');
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByText(empresa, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(empresa, { exact: false }).first().click();
    await page.getByRole('tab', { name: /^Tarefas/i }).click();
    const painelReload = page.locator('#painel-tarefas');
    await painelReload.getByRole('button', { name: tarefa, exact: true }).click({ force: true });
    await expect(painelReload.getByRole('checkbox', { name: new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('viewer autenticado só consulta (sem Novo Lead habilitado ou sem gravação)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'permissões desktop');
    await login(page, 'viewer@teste.local', 'TesteViewer!123');
    await page.goto('/crm');
    await assertSemCrash(page);
    await expect(page.getByRole('heading', { name: /CRM/i })).toBeVisible({ timeout: 15_000 });
    // Viewer pode ver o funil; tentativa de criar lead deve falhar ou botão ausente/desabilitado no sync
    const novo = page.getByRole('button', { name: /Novo Lead/i }).first();
    if (await novo.isVisible().catch(() => false)) {
      await novo.click();
      const modal = page.getByRole('dialog', { name: /Novo lead/i });
      if (await modal.isVisible().catch(() => false)) {
        const marca = `VIEWER-${Date.now()}`;
        await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(marca);
        await modal.getByRole('button', { name: /Adicionar lead/i }).click();
        // Se gravar_registros negar, o lead não deve persistir após reload
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.reload();
        await expect(page.getByText(marca, { exact: true })).toHaveCount(0, { timeout: 20_000 });
      }
    }
  });
});

test.describe('Gaps mobile — formulários e menus', () => {
  test('CRM, kanban, conversas e config no celular', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'só mobile');
    test.setTimeout(90_000);
    await login(page);

    for (const rota of ['/crm', '/kanban', '/conversas', '/clientes', '/recebimentos', '/configuracoes', '/documentos']) {
      await page.goto(rota);
      await assertSemCrash(page);
      await expect(page.getByRole('navigation', { name: /Navegação/i }).first()).toBeAttached();
    }

    await page.goto('/crm');
    await page.getByRole('button', { name: /Novo Lead/i }).first().click();
    const modal = page.getByRole('dialog', { name: /Novo lead/i });
    await expect(modal).toBeVisible();
    await expect(modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input')).toBeVisible();
    await modal.getByRole('button', { name: /Cancelar/i }).click();

    await page.goto('/clientes?novo=1');
    const modalCli = page.getByRole('dialog', { name: /Novo cliente/i });
    await expect(modalCli).toBeVisible({ timeout: 15_000 });
    await modalCli.getByRole('button', { name: /Cancelar|Fechar/i }).first().click();

    await page.goto('/kanban');
    await page.getByRole('button', { name: /Novo projeto/i }).click();
    const mp = page.getByRole('dialog', { name: /Novo projeto/i });
    await expect(mp).toBeVisible({ timeout: 15_000 });
    await expect(mp.getByRole('combobox', { name: /Cliente/i })).toBeVisible();
    await mp.getByRole('button', { name: /Cancelar/i }).click();
  });
});
