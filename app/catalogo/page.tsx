import type { Metadata } from 'next';
import TelaCatalogo from '@/components/nexa/telas/TelaCatalogo';

export const metadata: Metadata = { title: 'Serviços — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaCatalogo /></AreaPrivada>;
}
