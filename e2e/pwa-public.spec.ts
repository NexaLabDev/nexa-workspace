import { expect, test } from '@playwright/test';

test('PWA: manifesto, PNGs reais e tela offline pública', async ({ request, page }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Nexa Workspace');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons.some((x: { sizes: string }) => x.sizes === '192x192')).toBeTruthy();
  expect(manifest.icons.some((x: { sizes: string }) => x.sizes === '512x512')).toBeTruthy();
  for (const size of [180, 192, 512]) {
    const response = await request.get(`/pwa-icons/icon-${size}.png`);
    expect(response.ok(), `ícone ${size}px deve ser público`).toBeTruthy();
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from('89504e470d0a1a0a', 'hex'));
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  const offline = await request.get('/offline.html');
  expect(offline.ok()).toBeTruthy();
  expect(await offline.text()).toContain('Sem conexão com a internet');
  await page.goto('/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/pwa/icon/180');
});

test('PWA: service worker funciona offline sem armazenar conteúdo privado', async ({ page, context }) => {
  await page.goto('/login');
  await expect.poll(async () =>
    page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.ready;
      return !!navigator.serviceWorker.controller;
    })
  ).toBe(true);

  // Mesmo conectado, a aplicação autenticada não entra no cache offline.
  await context.setOffline(true);
  try {
    await page.goto('/crm');
    await expect(page.getByText('Sem conexão com a internet')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Nexa Workspace precisa de conexão/i)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
