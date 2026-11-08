import type { Metadata } from 'next';
import TelaCalculadora from '@/components/nexa/telas/TelaCalculadora';

export const metadata: Metadata = { title: 'Calculadora de Serviço — Nexa Workspace' };

export default function Pagina() {
  return <TelaCalculadora />;
}
