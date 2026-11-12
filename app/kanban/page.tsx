import type { Metadata } from 'next';
import TelaKanban from '@/components/nexa/telas/TelaKanban';

export const metadata: Metadata = { title: 'Kanban — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaKanban /></AreaPrivada>;
}
