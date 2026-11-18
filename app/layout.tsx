// ============================================
// LAYOUT GERAL — Nexa Workspace
// ============================================
// Cada aba usa a moldura própria (components/nexa/NexaShell.tsx).
// A fonte é baixada no build e servida pelo próprio site (sem chamar o Google
// a cada visita: funciona sem internet e não envia o IP do visitante).
// ============================================

import type { Metadata, Viewport } from 'next';
import RegistrarPWA from '@/components/nexa/RegistrarPWA';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--fonte-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nexa Workspace',
  description: 'Gestão de clientes, projetos, documentos e financeiro da Nexa Lab.',
  applicationName: 'Nexa Workspace',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Nexa Workspace',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/pwa/icon/192?v=nexa-oficial-20261118-v3', sizes: '192x192', type: 'image/png' }],
    shortcut: [{ url: '/pwa/icon/192?v=nexa-oficial-20261118-v3', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/pwa/icon/180?v=nexa-oficial-20261118-v3', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141516',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body><RegistrarPWA />{children}</body>
    </html>
  );
}
