import type { Metadata } from 'next';
import TelaMetas from '@/components/nexa/telas/TelaMetas';

export const metadata: Metadata = { title: 'Meta Mensal — Nexa Workspace' };

export default function Pagina() {
  return <TelaMetas />;
}
