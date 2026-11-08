// ============================================
// LAYOUT GERAL — Nexa Workspace
// ============================================
// Cada aba usa a moldura própria (components/nexa/NexaShell.tsx).
// A fonte é baixada no build e servida pelo próprio site (sem chamar o Google
// a cada visita: funciona sem internet e não envia o IP do visitante).
// ============================================

import type { Metadata } from 'next';
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
  description: 'Painel de gestão da Nexa Lab',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
