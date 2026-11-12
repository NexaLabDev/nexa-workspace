import type { Metadata } from 'next';
import TelaDocumentos from '@/components/nexa/telas/TelaDocumentos';

export const metadata: Metadata = { title: 'Gerador de Documentos — Nexa Workspace' };

import AreaPrivada from "@/components/acesso/AreaPrivada";
export const dynamic = "force-dynamic";
export default function Pagina() {
  return <AreaPrivada><TelaDocumentos /></AreaPrivada>;
}
