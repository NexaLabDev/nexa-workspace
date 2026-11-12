/**
 * Medição equivalente em next start (produção local).
 * Uso: PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 node scripts/perf-prod.mjs [rotulo]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';
const rotulo = process.argv[2] ?? 'prod';
const outDir = path.resolve('perf-results');
fs.mkdirSync(outDir, { recursive: true });

const ROTAS = ['/', '/crm', '/conversas', '/kanban', '/clientes', '/metas', '/recebimentos'];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/E-mail/i).fill(EMAIL);
  await page.getByLabel(/^Senha$/i).fill(SENHA);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45_000, waitUntil: 'commit' }),
    page.getByRole('button', { name: /^Entrar$/i }).click(),
  ]);
  await page.waitForTimeout(2000);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await login(page);

const full = [];
for (const rota of ROTAS) {
  const t0 = Date.now();
  await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 60_000 });
  const navMs = Date.now() - t0;
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]));
    return {
      ttfb: nav?.responseStart,
      fcp: paints['first-contentful-paint'],
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    };
  });
  full.push({ rota, navMs, ...metrics });
}

// Soft nav + interação
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const soft = {};
let t = Date.now();
await page.locator('a[href="/crm"]').first().click();
await page.waitForFunction(() => location.pathname.includes('/crm'), null, { timeout: 20_000 });
soft.crmMs = Date.now() - t;
t = Date.now();
await page.locator('a[href="/kanban"]').first().click();
await page.waitForFunction(() => location.pathname.includes('/kanban'), null, { timeout: 20_000 });
soft.kanbanMs = Date.now() - t;

t = Date.now();
await page.keyboard.press('Control+k');
await page.waitForTimeout(150);
const digitar = [];
for (const ch of 'alpha') {
  const a = Date.now();
  await page.keyboard.type(ch, { delay: 0 });
  digitar.push(Date.now() - a);
}
soft.buscaMs = Date.now() - t;
soft.digitarMs = digitar;
await page.keyboard.press('Escape');

// Idle 18s: RPC count
await page.evaluate(() => {
  window.__nexaRpc = 0;
  const orig = window.fetch.bind(window);
  window.fetch = (...args) => {
    const u = String(args[0] ?? '');
    if (u.includes('ler_registros') || u.includes('gravar_registros')) window.__nexaRpc++;
    return orig(...args);
  };
});
await page.waitForTimeout(18_000);
const idle = await page.evaluate(() => ({ rpc: window.__nexaRpc ?? 0, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));

const avg = (k) => Math.round(full.reduce((s, x) => s + (x[k] ?? 0), 0) / full.length);
const resultado = {
  rotulo,
  em: new Date().toISOString(),
  modo: 'next start',
  base: BASE,
  full,
  medias: { navMs: avg('navMs'), ttfb: avg('ttfb'), fcp: avg('fcp') },
  soft,
  idle,
};
fs.writeFileSync(path.join(outDir, `${rotulo}.json`), JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
await browser.close();
