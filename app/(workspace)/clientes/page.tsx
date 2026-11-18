import type { Metadata } from 'next';
import TelaClientes from '@/components/nexa/telas/TelaClientes';

export const metadata: Metadata = { title: 'Clientes — Nexa Workspace' };

export default function Pagina() {
  return <TelaClientes />;
}
