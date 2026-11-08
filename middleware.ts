// ============================================
// CONTROLE DE ACESSO DA VERSÃO DE TESTES (online)
// ============================================
// - No próprio computador (localhost) não pede nada: o desenvolvimento local continua igual.
// - Em qualquer outro endereço (ex.: a Vercel), exige usuário e senha (autenticação "Basic"
//   do navegador, sempre por HTTPS). Valores nas variáveis de ambiente da Vercel:
//     ACESSO_TESTE_USUARIO e ACESSO_TESTE_SENHA (nunca no código nem no GitHub).
// - Se as variáveis não existirem, BLOQUEIA tudo (não abre o site sem proteção por engano).
// Provisório até o login com o Supabase (Fase B).
// ============================================

import { NextResponse, type NextRequest } from 'next/server';

const LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Comparação em tempo constante (não revela, pelo tempo de resposta, quantos caracteres acertou). */
function iguais(a: string, b: string): boolean {
  const ta = new TextEncoder().encode(a);
  const tb = new TextEncoder().encode(b);
  let dif = ta.length ^ tb.length;
  const n = Math.max(ta.length, tb.length);
  for (let i = 0; i < n; i++) dif |= (ta[i] ?? 0) ^ (tb[i] ?? 0);
  return dif === 0;
}

function pedirLogin(): NextResponse {
  return new NextResponse('Acesso restrito: Nexa Workspace (versão de testes).', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Nexa Workspace - testes", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

/** Nome do endereço pedido pelo navegador (cabeçalho Host, sem a porta). */
function hostDoPedido(req: NextRequest): string {
  const host = (req.headers.get('host') ?? '').trim().toLowerCase();
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0];
}

export function middleware(req: NextRequest) {
  // Usa o Host pedido pelo navegador (req.nextUrl aponta para o nome interno do servidor)
  // Na Vercel nunca há "localhost": lá a senha vale sempre, mesmo que alguém forje o cabeçalho
  if (!process.env.VERCEL && LOCAIS.has(hostDoPedido(req))) return NextResponse.next();

  const usuario = process.env.ACESSO_TESTE_USUARIO;
  const senha = process.env.ACESSO_TESTE_SENHA;
  if (!usuario || !senha || senha.length < 12) {
    return new NextResponse('Acesso ainda não configurado (defina ACESSO_TESTE_USUARIO e ACESSO_TESTE_SENHA, mínimo 12 caracteres).', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const cabecalho = req.headers.get('authorization') ?? '';
  if (!cabecalho.startsWith('Basic ')) return pedirLogin();
  let decodificado = '';
  try {
    decodificado = new TextDecoder().decode(Uint8Array.from(atob(cabecalho.slice(6)), (c) => c.charCodeAt(0)));
  } catch {
    return pedirLogin();
  }
  const i = decodificado.indexOf(':');
  if (i < 0) return pedirLogin();
  // avalia os dois para não indicar qual dos dois errou
  const okUsuario = iguais(decodificado.slice(0, i), usuario);
  const okSenha = iguais(decodificado.slice(i + 1), senha);
  if (!(okUsuario && okSenha)) return pedirLogin();

  const resp = NextResponse.next();
  // a versão de testes não deve aparecer em buscadores
  resp.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return resp;
}

// Protege tudo: páginas, rotas da API, arquivos do app e o service worker.
export const config = {
  matcher: '/:path*',
};
