import type { Metadata } from 'next';
import TelaCatalogo from '@/components/nexa/telas/TelaCatalogo';

export const metadata: Metadata = { title: 'Serviços — Nexa Workspace' };

export default function Pagina() {
  return <TelaCatalogo />;
}
