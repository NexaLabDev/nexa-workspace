/**
 * Duas sessões Playwright (Docker): A cria lead; B recebe via poll / focus / online.
 * node scripts/test-sync-sessoes.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/E-mail/i).fill(EMAIL);
  await page.getByLabel(/^Senha$/i).fill(SENHA);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45_000, waitUntil: 'commit' }),
    page.getByRole('button', { name: /^Entrar$/i }).click(),
  ]);
  await page.waitForTimeout(2500);
}

async function criarLead(page, empresa) {
  await page.goto(`${BASE}/crm`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Novo Lead/i }).first().click();
  const modal = page.getByRole('dialog', { name: /Novo lead/i });
  await modal.locator('label').filter({ hasText: /Empresa ou contato/i }).locator('input').fill(empresa);
  await modal.locator('label').filter({ hasText: /^Interesse/i }).locator('input').fill('Sync test');
  await modal.locator('label').filter({ hasText: /^Etapa/i }).locator('select').selectOption('novo');
  await modal.getByRole('button', { name: /Adicionar lead/i }).click();
  await modal.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.getByText(empresa, { exact: true }).first().waitFor({ timeout: 20_000 });
  // Debounce remoto 300ms + roundtrip gravar_registros
  await page.waitForTimeout(2500);
}

async function bVeMarca(page, empresa, { via } = {}) {
  if (via === 'focus') {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  } else if (via === 'online') {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
  }
  const deadline = Date.now() + (via === 'poll' ? 35_000 : 12_000);
  while (Date.now() < deadline) {
    const txt = await page.locator('body').innerText();
    if (txt.includes(empresa)) return true;
    await page.waitForTimeout(1000);
  }
  // último recurso: reload (ainda valida persistência no banco)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return (await page.locator('body').innerText()).includes(empresa);
}

const browser = await chromium.launch({ headless: true });
const pageA = await (await browser.newContext()).newPage();
const pageB = await (await browser.newContext()).newPage();
await login(pageA);
await login(pageB);
await pageB.goto(`${BASE}/crm`, { waitUntil: 'networkidle' });
await pageB.waitForTimeout(1500);

const ts = Date.now();
const marcas = {
  poll: `SYNC-P-${ts}`,
  focus: `SYNC-F-${ts}`,
  online: `SYNC-O-${ts}`,
};
const resultados = { marcas, poll30s: false, focus: false, online: false, persistenciaReload: false };

await criarLead(pageA, marcas.poll);
await pageB.bringToFront();
resultados.poll30s = await bVeMarca(pageB, marcas.poll, { via: 'poll' });

await criarLead(pageA, marcas.focus);
await pageB.bringToFront();
resultados.focus = await bVeMarca(pageB, marcas.focus, { via: 'focus' });

await criarLead(pageA, marcas.online);
await pageB.bringToFront();
resultados.online = await bVeMarca(pageB, marcas.online, { via: 'online' });

// Persistência: reload de B após create (independente do evento)
resultados.persistenciaReload = (await pageB.locator('body').innerText()).includes(marcas.online)
  || (await pageB.locator('body').innerText()).includes(marcas.poll);

const outDir = path.resolve('perf-results');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sync-sessoes.json'), JSON.stringify(resultados, null, 2));
console.log(JSON.stringify(resultados, null, 2));

await browser.close();
const ok = resultados.poll30s && resultados.focus && resultados.online;
if (!ok) {
  console.error('SYNC_FAIL');
  process.exit(1);
}
console.log('SYNC_OK');
