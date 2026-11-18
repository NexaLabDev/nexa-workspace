'use client';

import { useEffect } from 'react';

export default function RegistrarPWA() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    // Mesmo worker das notificações: não criamos outro com escopo conflitante.
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // O site permanece utilizável mesmo quando o navegador bloqueia SW.
    });
  }, []);
  return null;
}
