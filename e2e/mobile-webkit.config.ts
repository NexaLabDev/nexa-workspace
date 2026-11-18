import { defineConfig, devices } from '@playwright/test';

// Navegação no motor do Safari em viewport mobile; credenciais só do Supabase
// local descartável. Não equivale a um teste no iPhone físico.
export default defineConfig({
  testDir: '.',
  testMatch: ['mobile-layout.spec.ts', 'mobile-scroll-tabs.spec.ts'],
  timeout: 130_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'webkit-iphone', use: { ...devices['iPhone 13'] } }],
});
