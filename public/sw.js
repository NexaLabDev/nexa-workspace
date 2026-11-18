// Service worker do Nexa Workspace: recebe os avisos push e abre a tela certa ao clicar.
// Offline: apenas um aviso público é armazenado; NUNCA cachear páginas
// autenticadas, APIs, documentos, respostas do Supabase ou dados de clientes.
const CACHE_OFFLINE = 'nexa-offline-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_OFFLINE)
      .then((cache) => cache.addAll(['/offline.html','/nexa-app.webp']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.mode !== 'navigate') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // Sempre busca a página online; nunca salva HTML privado.
  e.respondWith(
    fetch(e.request).catch(async () => {
      const cache = await caches.open(CACHE_OFFLINE);
      return (await cache.match('/offline.html')) || Response.error();
    })
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { corpo: e.data ? e.data.text() : '' };
  }
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/recebimentos';
  e.waitUntil(
    self.registration.showNotification(d.titulo || 'Nexa Workspace', {
      body: d.corpo || '',
      tag: d.tag || undefined,
      icon: '/pwa/icon/192',
      badge: '/pwa/icon/192',
      lang: 'pt-BR',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (new URL(j.url).origin === self.location.origin && 'focus' in j) {
          return j.navigate(alvo).then((w) => (w || j).focus());
        }
      }
      return self.clients.openWindow(alvo);
    })
  );
});
