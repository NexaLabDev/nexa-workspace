import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { configPublica } from '@/lib/supabase/config';

export async function middleware(req: NextRequest) {
  const caminho = req.nextUrl.pathname;
  const api = caminho.startsWith('/api/');
  if (caminho === '/login' || caminho === '/conta' || /^\/acompanhamento(?:\/[a-zA-Z0-9_-]{22})?$/.test(caminho)) return NextResponse.next();
  if (api && !['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ erro:'Origem não autorizada.' }, {status:403});
  }
  let url: string, chavePublica: string;
  try {
    ({ url, chavePublica } = configPublica());
  } catch {
    // Sem as variáveis do Supabase o site não abre nada (em vez de quebrar ou abrir sem proteção)
    return new NextResponse('Configuração do Supabase ausente no servidor (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  let resp = NextResponse.next({ request:req });
  const db = createServerClient(url,chavePublica,{ cookies:{
    getAll:()=>req.cookies.getAll(),
    setAll:(lista, headers)=>{
      for(const c of lista) req.cookies.set(c.name,c.value);
      resp=NextResponse.next({request:req});
      for(const c of lista) resp.cookies.set(c.name,c.value,c.options);
      for(const [k,v] of Object.entries(headers ?? {})) resp.headers.set(k,v);
    }
  } });
  const { data:{user} }=await db.auth.getUser();
  const ativo = user && await db.rpc('workspace_id_atual');
  if (!user || !ativo?.data) {
    const destino=req.nextUrl.clone();
    destino.pathname='/login'; destino.search='';
    if(user) destino.searchParams.set('vinculo','pendente');
    const falha=api ? NextResponse.json({erro:user?'Sem acesso ao workspace.':'Sessão expirada.'},{status:user?403:401}) : NextResponse.redirect(destino);
    for(const c of resp.cookies.getAll()) falha.cookies.set(c);
    falha.headers.set('Cache-Control','private, no-store');
    return falha;
  }
  resp.headers.set('Cache-Control','private, no-store');
  return resp;
}

export const config={ matcher:['/((?!_next/static|_next/image|dashboard/|favicon.ico|icon.png|sw.js).*)'] };
