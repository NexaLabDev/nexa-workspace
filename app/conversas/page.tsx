import type { Metadata } from 'next';
import TelaConversas from '@/components/nexa/telas/TelaConversas';

export const metadata: Metadata = { title: 'Conversas — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaConversas /></AreaPrivada>;
}
