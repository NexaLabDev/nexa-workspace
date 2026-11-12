/**
 * Mede idle (avisar/poll) e navegação client-side — onde o sync dói.
 * node scripts/perf-interacao.mjs [rotulo]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';
const rotulo = process.argv[2] ?? 'interacao';
const outDir = path.resolve('perf-results');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByLabel(/E-mail/i).fill(EMAIL);
await page.getByLabel(/^Senha$/i).fill(SENHA);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45_000, waitUntil: 'commit' }),
  page.getByRole('button', { name: /^Entrar$/i }).click(),
]);
await page.waitForTimeout(2500);

// Instrumenta assinantes do remoto (avisar)
await page.evaluate(() => {
  window.__nexaPerf = { avisar: 0, long: [], rpc: 0 };
  const obs = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__nexaPerf.long.push({ dur: e.duration, t: e.startTime });
  });
  try { obs.observe({ type: 'longtask', buffered: true }); } catch {}
});

page.on('request', (req) => {
  if (req.url().includes('/rpc/ler_registros') || req.url().includes('ler_registros')) {
    // counted in page too
  }
});

// Soft nav: dashboard -> CRM via trilho
const soft = {};
const t0 = Date.now();
await page.locator('a[href="/crm"]').first().click();
await page.waitForFunction(() => location.pathname.includes('/crm'), null, { timeout: 20_000 });
soft.crmMs = Date.now() - t0;
await page.waitForTimeout(500);

const t1 = Date.now();
await page.locator('a[href="/kanban"]').first().click();
await page.waitForFunction(() => location.pathname.includes('/kanban'), null, { timeout: 20_000 });
soft.kanbanMs = Date.now() - t1;
await page.waitForTimeout(500);

// Busca Ctrl+K + digitar
const t2 = Date.now();
await page.keyboard.press('Control+k');
await page.waitForTimeout(200);
const digitar = [];
for (const ch of 'alpha') {
  const a = Date.now();
  await page.keyboard.type(ch, { delay: 0 });
  digitar.push(Date.now() - a);
}
soft.abrirBuscaMs = Date.now() - t2;
soft.digitarMs = digitar;
await page.keyboard.press('Escape');

// Idle 18s — cobre um ciclo de poll (15s antigo / 30s novo parcial)
const rpcBefore = await page.evaluate(() => {
  window.__nexaRpc = 0;
  const orig = window.fetch;
  window.fetch = function (...args) {
    const u = String(args[0] ?? '');
    if (u.includes('ler_registros') || u.includes('gravar_registros')) window.__nexaRpc++;
    return orig.apply(this, args);
  };
  return 0;
});
await page.waitForTimeout(18_000);
const idle = await page.evaluate(() => ({
  rpc: window.__nexaRpc ?? 0,
  longTasks: (window.__nexaPerf?.long ?? []).filter((x) => x.dur > 50).length,
  longMax: Math.max(0, ...(window.__nexaPerf?.long ?? []).map((x) => x.dur)),
  heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
}));

const resultado = { rotulo, em: new Date().toISOString(), soft, idle, rpcBefore };
fs.writeFileSync(path.join(outDir, `${rotulo}.json`), JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
await browser.close();
