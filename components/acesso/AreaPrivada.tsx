import DadosWorkspace from './DadosWorkspace';
import { redirect } from 'next/navigation';
import { perfilAtivo } from '@/lib/supabase/sessao';
export const dynamic='force-dynamic';
export default async function AreaPrivada({children}:{children: React.ReactNode}) {
  const perfil = await perfilAtivo();
  if (!perfil) redirect('/login');
  return <DadosWorkspace perfil={perfil}>{children}</DadosWorkspace>;
}
