import type { Metadata } from 'next';
import TelaCalculadora from '@/components/nexa/telas/TelaCalculadora';

export const metadata: Metadata = { title: 'Calculadora de Serviço — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaCalculadora /></AreaPrivada>;
}
