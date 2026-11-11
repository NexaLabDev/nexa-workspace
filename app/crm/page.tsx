import type { Metadata } from 'next';
import TelaCrm from '@/components/nexa/telas/TelaCrm';

export const metadata: Metadata = { title: 'CRM de Leads — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaCrm /></AreaPrivada>;
}
