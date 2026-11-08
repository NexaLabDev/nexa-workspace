import type { Metadata } from 'next';
import TelaCliente from '@/components/nexa/telas/TelaCliente';

export const metadata: Metadata = { title: 'Cliente — Nexa Workspace' };

export default function Pagina({ params }: { params: { id: string } }) {
  return <TelaCliente id={decodeURIComponent(params.id)} />;
}
