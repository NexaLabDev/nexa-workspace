import type { Metadata } from 'next';
import TelaMetas from '@/components/nexa/telas/TelaMetas';

export const metadata: Metadata = { title: 'Meta Mensal — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaMetas /></AreaPrivada>;
}
