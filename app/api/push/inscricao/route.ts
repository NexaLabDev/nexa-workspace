// Inscrições de push: cada navegador que ativou os avisos de vencimento.
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco, lerBanco, type InscricaoPush } from '@/lib/servidor/armazem';

export const dynamic = 'force-dynamic';

const MAX_INSCRICOES = 20;
const base64url = /^[A-Za-z0-9_-]+=*$/;

function endpointValido(e: unknown): e is string {
  if (typeof e !== 'string' || e.length > 1000) return false;
  try {
    return new URL(e).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Situação deste navegador: ?endpoint=... */
export function GET(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const endpoint = new URL(req.url).searchParams.get('endpoint');
  const b = lerBanco();
  const insc = endpoint ? b.inscricoes.find((i) => i.endpoint === endpoint) : undefined;
  return NextResponse.json({
    inscrita: !!insc,
    filtro: insc?.filtro ?? null,
    totalInscricoes: b.inscricoes.length,
    ultimaVerificacao: b.ultimaVerificacao ?? null,
    leadsSincronizadosEm: b.leadsAtualizadoEm ?? null,
  });
}

type Corpo = { inscricao?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; filtro?: unknown };

export async function POST(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const corpo = await lerJson<Corpo>(req, 10_000);
  const endpoint = corpo?.inscricao?.endpoint;
  const p256dh = corpo?.inscricao?.keys?.p256dh;
  const auth = corpo?.inscricao?.keys?.auth;
  const filtro = typeof corpo?.filtro === 'string' && corpo.filtro.trim() ? corpo.filtro.trim().slice(0, 120) : null;
  if (
    !endpointValido(endpoint) ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    !base64url.test(p256dh) ||
    !base64url.test(auth) ||
    p256dh.length > 200 ||
    auth.length > 100
  ) {
    return NextResponse.json({ erro: 'Inscrição inválida.' }, { status: 400 });
  }
  let cheio = false;
  alterarBanco((b) => {
    const nova: InscricaoPush = { endpoint, keys: { p256dh, auth }, filtro, criadaEm: new Date().toISOString() };
    const i = b.inscricoes.findIndex((x) => x.endpoint === endpoint);
    if (i >= 0) b.inscricoes[i] = { ...nova, criadaEm: b.inscricoes[i].criadaEm };
    else if (b.inscricoes.length >= MAX_INSCRICOES) cheio = true;
    else b.inscricoes.push(nova);
  });
  if (cheio) return NextResponse.json({ erro: 'Limite de navegadores inscritos atingido.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const corpo = await lerJson<{ endpoint?: unknown }>(req, 2_000);
  if (typeof corpo?.endpoint !== 'string') return NextResponse.json({ erro: 'Informe o endpoint.' }, { status: 400 });
  alterarBanco((b) => {
    b.inscricoes = b.inscricoes.filter((x) => x.endpoint !== corpo.endpoint);
  });
  return NextResponse.json({ ok: true });
}
