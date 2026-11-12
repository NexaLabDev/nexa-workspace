/**
 * Baseline de performance (Docker isolado).
 * Uso: com Next em 127.0.0.1:3000 apontando para .env.docker.local
 *   node scripts/perf-baseline.mjs [rotulo]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@teste.local';
const SENHA = process.env.E2E_SENHA ?? 'TesteAdmin!123';
const rotulo = process.argv[2] ?? 'before';
const outDir = path.resolve('perf-results');
fs.mkdirSync(outDir, { recursive: true });

const rotas = ['/', '/crm', '/conversas', '/kanban', '/clientes', '/metas', '/recebimentos'];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel(/E-mail/i).fill(EMAIL);
  await page.getByLabel(/^Senha$/i).fill(SENHA);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 45_000, waitUntil: 'commit' }),
    page.getByRole('button', { name: /^Entrar$/i }).click(),
  ]);
  await page.waitForTimeout(2000);
  console.error('login ok', page.url());
}

async function medirRota(page, rota) {
  const rpcs = [];
  const longTasks = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('ler_registros') || u.includes('gravar_registros') || u.includes('/rest/v1/rpc/')) {
      rpcs.push({ url: u, t: Date.now() });
    }
  });

  await page.evaluate(() => {
    window.__nexaLong = [];
    try {
      const obs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__nexaLong.push({ name: e.name, dur: e.duration, start: e.startTime });
      });
      obs.observe({ type: 'longtask', buffered: true });
      window.__nexaLongObs = obs;
    } catch {
      /* Safari antigo */
    }
  });

  const t0 = Date.now();
  const resp = await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 60_000 });
  const navMs = Date.now() - t0;

  // Interação: clicar na busca (Ctrl+K) e fechar
  const interacao = {};
  const k0 = Date.now();
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  interacao.abrirBuscaMs = Date.now() - k0;
  await page.keyboard.press('Escape');

  // Idle 5s: contar RPCs de poll
  const rpcAntes = rpcs.length;
  await page.waitForTimeout(5000);
  const rpcIdle = rpcs.length - rpcAntes;

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, p.startTime]));
    const mem = performance.memory
      ? { usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576), totalJSHeapMB: Math.round(performance.memory.totalJSHeapSize / 1048576) }
      : null;
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd,
      loadEvent: nav?.loadEventEnd,
      ttfb: nav?.responseStart,
      paints,
      longTasks: window.__nexaLong ?? [],
      mem,
    };
  });

  return {
    rota,
    status: resp?.status() ?? null,
    navMs,
    interacao,
    rpcTotal: rpcs.length,
    rpcIdle5s: rpcIdle,
    ...metrics,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const resultado = { rotulo, em: new Date().toISOString(), base: BASE, email: EMAIL, rotas: [] };

try {
  await login(page);
  for (const rota of rotas) {
    resultado.rotas.push(await medirRota(page, rota));
  }
} finally {
  await browser.close();
}

const dest = path.join(outDir, `${rotulo}.json`);
fs.writeFileSync(dest, JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
console.log(`\nSalvo em ${dest}`);
