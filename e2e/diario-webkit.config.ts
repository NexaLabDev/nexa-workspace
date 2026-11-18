import { defineConfig, devices } from '@playwright/test';

// Suíte independente que NÃO roda os E2Es com escrita, apenas testes IndexedDB.
// WebKit no Linux ajuda na compatibilidade Safari, mas não substitui um iPhone real.
export default defineConfig({
  testDir: '.',
  testMatch: 'diario-local.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } },
  ],
});
