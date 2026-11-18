import type { Metadata } from 'next';
import TelaRecebimentos from '@/components/nexa/telas/TelaRecebimentos';

export const metadata: Metadata = { title: 'Recebimentos — Nexa Workspace' };

export default function Pagina() {
  return <TelaRecebimentos />;
}
