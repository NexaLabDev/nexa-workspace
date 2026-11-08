import type { Metadata } from 'next';
import TelaCrm from '@/components/nexa/telas/TelaCrm';

export const metadata: Metadata = { title: 'CRM de Leads — Nexa Workspace' };

export default function Pagina() {
  return <TelaCrm />;
}
