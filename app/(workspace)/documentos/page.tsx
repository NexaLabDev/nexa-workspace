import type { Metadata } from 'next';
import TelaDocumentos from '@/components/nexa/telas/TelaDocumentos';

export const metadata: Metadata = { title: 'Gerador de Documentos — Nexa Workspace' };

export default function Pagina() {
  return <TelaDocumentos />;
}
