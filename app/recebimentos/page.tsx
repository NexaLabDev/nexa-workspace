import type { Metadata } from 'next';
import TelaRecebimentos from '@/components/nexa/telas/TelaRecebimentos';

export const metadata: Metadata = { title: 'Recebimentos — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaRecebimentos /></AreaPrivada>;
}
