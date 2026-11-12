import type { Metadata } from 'next';
import TelaConfiguracoes from '@/components/nexa/telas/TelaConfiguracoes';

export const metadata: Metadata = { title: 'Configurações — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaConfiguracoes /></AreaPrivada>;
}
