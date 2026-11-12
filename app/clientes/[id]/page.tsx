import type { Metadata } from 'next';
import TelaCliente from '@/components/nexa/telas/TelaCliente';

export const metadata: Metadata = { title: 'Cliente — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina({ params }: { params: { id: string } }) {
  return <AreaPrivada><TelaCliente id={decodeURIComponent(params.id)} /></AreaPrivada>;
}
