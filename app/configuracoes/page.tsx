import type { Metadata } from 'next';
import TelaConfiguracoes from '@/components/nexa/telas/TelaConfiguracoes';

export const metadata: Metadata = { title: 'Configurações — Nexa Workspace' };

export default function Pagina() {
  return <TelaConfiguracoes />;
}
