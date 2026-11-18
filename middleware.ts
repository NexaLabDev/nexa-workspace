import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { configPublica } from '@/lib/supabase/config';

export async function middleware(req: NextRequest) {
  const caminho = req.nextUrl.pathname;
  const api = caminho.startsWith('/api/');
  // /api/supabase/status já se restringe a localhost em lib/servidor/guarda.ts
  if (
    caminho === '/login' ||
    caminho === '/conta' ||
    caminho === '/api/supabase/status' ||
    /^\/acompanhamento(?:\/[a-zA-Z0-9_-]{22})?$/.test(caminho)
  ) {
    return NextResponse.next();
  }
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
  // A navegação entre módulos passa por este middleware em TODA requisição.
  // getUser() consulta sempre o Auth remoto. Com chaves JWT assimétricas,
  // getClaims() valida o token assinado localmente/cache JWKS, evitando um
  // round-trip ao Auth em cada clique. Para APIs, mantém getUser() porque
  // verificações de sessão/revogação no servidor continuam obrigatórias.
  const inicioAuth = performance.now();
  const identidade = api
    ? (await db.auth.getUser()).data.user?.id
    : (await db.auth.getClaims()).data?.claims?.sub;
  const duracaoAuth = performance.now() - inicioAuth;

  // Consulta ativa ao banco em TODA rota protegida: negar acesso imediatamente
  // caso o vínculo tenha sido desativado. Não confiar no papel do JWT/metadata.
  const inicioVinculo = performance.now();
  const ativo = identidade ? await db.rpc('workspace_id_atual') : null;
  const duracaoVinculo = performance.now() - inicioVinculo;
  const tempoServidor = `auth;dur=${duracaoAuth.toFixed(1)}, workspace;dur=${duracaoVinculo.toFixed(1)}`;

  if (!identidade || !ativo?.data) {
    const destino=req.nextUrl.clone();
    destino.pathname='/login'; destino.search='';
    if(identidade) destino.searchParams.set('vinculo','pendente');
    const falha=api ? NextResponse.json({erro:identidade?'Sem acesso ao workspace.':'Sessão expirada.'},{status:identidade?403:401}) : NextResponse.redirect(destino);
    for(const c of resp.cookies.getAll()) falha.cookies.set(c);
    falha.headers.set('Cache-Control','private, no-store');
    falha.headers.set('Server-Timing', tempoServidor);
    return falha;
  }
  resp.headers.set('Cache-Control','private, no-store');
  // Diagnóstico no DevTools > Rede > Timing; não envia dados pessoais.
  resp.headers.set('Server-Timing', tempoServidor);
  return resp;
}

export const config={ matcher:['/((?!_next/static|_next/image|dashboard/|favicon.ico|icon.png|sw.js).*)'] };
