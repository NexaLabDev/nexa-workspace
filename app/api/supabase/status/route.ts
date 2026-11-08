// Diagnóstico da conexão com o Supabase (só neste computador).
// Testa a chave publicável e a chave secreta de verdade; nunca devolve as chaves.
import { NextResponse } from 'next/server';
import { recusar } from '@/lib/servidor/guarda';
import { configPublica } from '@/lib/supabase/config';
import { supabaseServidor } from '@/lib/supabase/servidor';

export const dynamic = 'force-dynamic';

type Teste = { ok: boolean; detalhe: string };

export async function GET(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;

  let url: string;
  let chavePublica: string;
  try {
    ({ url, chavePublica } = configPublica());
  } catch (e) {
    return NextResponse.json({ configurado: false, erro: (e as Error).message }, { status: 500 });
  }

  // 1) Chave publicável: lê as configurações públicas de login do projeto
  let publicavel: Teste;
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: chavePublica }, cache: 'no-store' });
    publicavel = r.ok ? { ok: true, detalhe: 'aceita pelo Supabase' } : { ok: false, detalhe: `Supabase respondeu ${r.status}` };
  } catch (e) {
    publicavel = { ok: false, detalhe: `sem conexão: ${(e as Error).message}` };
  }

  // 2) Chave secreta: operação que só a chave secreta pode fazer (listar 1 usuário, sem devolver dados)
  let secreta: Teste;
  try {
    const { error } = await supabaseServidor().auth.admin.listUsers({ page: 1, perPage: 1 });
    secreta = error ? { ok: false, detalhe: error.message } : { ok: true, detalhe: 'acesso de administrador confirmado' };
  } catch (e) {
    secreta = { ok: false, detalhe: (e as Error).message };
  }

  return NextResponse.json({ configurado: true, projeto: new URL(url).host, publicavel, secreta }, { status: publicavel.ok && secreta.ok ? 200 : 502 });
}
