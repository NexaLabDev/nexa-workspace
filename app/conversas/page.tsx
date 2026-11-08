import type { Metadata } from 'next';
import TelaConversas from '@/components/nexa/telas/TelaConversas';

export const metadata: Metadata = { title: 'Conversas — Nexa Workspace' };

export default function Pagina() {
  return <TelaConversas />;
}
