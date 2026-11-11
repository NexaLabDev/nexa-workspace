// Link permanente de acompanhamento: consulta o servidor a cada acesso,
// então o cliente sempre vê a fase atual do projeto. Público, sem login.
import type { Metadata } from 'next';
import TelaAcompanhamento from '@/components/nexa/telas/TelaAcompanhamento';
import { CODIGO_PUBLICO_VALIDO } from '@/components/nexa/acompanhamento';
import { createClient } from '@supabase/supabase-js';
import { configPublica } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acompanhamento do projeto — Nexa Lab',
  description: 'Acompanhe a fase do seu projeto com a Nexa Lab.',
  robots: { index: false, follow: false },
};

export default async function Pagina({ params }: { params: { codigo: string } }) {
  const codigo = params.codigo;
  const {url,chavePublica}=configPublica();
  const db=createClient(url,chavePublica,{auth:{persistSession:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
  const {data:retrato}=CODIGO_PUBLICO_VALIDO.test(codigo)?await db.rpc('acompanhamento_projeto',{codigo}):{data:null};
  return (
    <TelaAcompanhamento
      retrato={retrato}
      erro={retrato ? undefined : 'Este link não existe ou foi desativado. Peça um novo link à equipe da Nexa Lab.'}
    />
  );
}
