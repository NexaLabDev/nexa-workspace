// Service worker do Nexa Workspace: recebe os avisos push e abre a tela certa ao clicar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
      icon: '/icon.png',
      badge: '/icon.png',
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
