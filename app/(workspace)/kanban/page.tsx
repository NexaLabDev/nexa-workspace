import type { Metadata } from 'next';
import TelaKanban from '@/components/nexa/telas/TelaKanban';

export const metadata: Metadata = { title: 'Kanban — Nexa Workspace' };

export default function Pagina() {
  return <TelaKanban />;
}
