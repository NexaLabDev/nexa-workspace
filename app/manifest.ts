import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Nexa Workspace',
    short_name: 'Nexa',
    description: 'Clientes, projetos, financeiro e documentos em um só lugar.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#141516',
    theme_color: '#141516',
    lang: 'pt-BR',
    orientation: 'any',
    icons: [
      { src: '/pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'CRM', short_name: 'CRM', url: '/crm', icons: [{ src: '/pwa-icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Projetos', short_name: 'Kanban', url: '/kanban', icons: [{ src: '/pwa-icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
