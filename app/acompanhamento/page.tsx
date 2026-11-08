// Página pública que o cliente abre pelo link de acompanhamento.

import type { Metadata } from 'next';
import TelaAcompanhamento from '@/components/nexa/telas/TelaAcompanhamento';
import { lerRetrato } from '@/components/nexa/acompanhamento';

export const metadata: Metadata = {
  title: 'Acompanhamento do projeto — Nexa Lab',
  description: 'Acompanhe a fase do seu projeto com a Nexa Lab.',
  robots: { index: false, follow: false },
};

export default function Pagina({ searchParams }: { searchParams: { p?: string | string[] } }) {
  const codigo = typeof searchParams.p === 'string' ? searchParams.p : null;
  return <TelaAcompanhamento retrato={lerRetrato(codigo)} />;
}
