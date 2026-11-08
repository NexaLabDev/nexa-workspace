// Link permanente de acompanhamento: consulta o servidor a cada acesso,
// então o cliente sempre vê a fase atual do projeto. Público, sem login.
import type { Metadata } from 'next';
import TelaAcompanhamento from '@/components/nexa/telas/TelaAcompanhamento';
import { CODIGO_PUBLICO_VALIDO } from '@/components/nexa/acompanhamento';
import { lerBanco } from '@/lib/servidor/armazem';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acompanhamento do projeto — Nexa Lab',
  description: 'Acompanhe a fase do seu projeto com a Nexa Lab.',
  robots: { index: false, follow: false },
};

export default function Pagina({ params }: { params: { codigo: string } }) {
  const codigo = params.codigo;
  const retrato = CODIGO_PUBLICO_VALIDO.test(codigo) ? lerBanco().acompanhamentos?.[codigo] ?? null : null;
  return (
    <TelaAcompanhamento
      retrato={retrato}
      erro={retrato ? undefined : 'Este link não existe ou foi desativado. Peça um novo link à equipe da Nexa Lab.'}
    />
  );
}
