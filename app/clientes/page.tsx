import type { Metadata } from 'next';
import TelaClientes from '@/components/nexa/telas/TelaClientes';

export const metadata: Metadata = { title: 'Clientes — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaClientes /></AreaPrivada>;
}
