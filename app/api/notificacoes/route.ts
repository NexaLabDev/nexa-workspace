// Central de notificações: lista as ativas (geradas pelo servidor) e marca como lidas.
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco } from '@/lib/servidor/armazem';
import { atualizarNotificacoes, configDe } from '@/lib/servidor/notificacoes';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  let resposta = {};
  // Atualiza antes de listar: a virada do dia já aparece sem esperar o agendador
  alterarBanco((b) => {
    const ativas = atualizarNotificacoes(b).sort((x, y) => x.vencimento.localeCompare(y.vencimento));
    resposta = { notificacoes: ativas, config: configDe(b), leadsSincronizadosEm: b.leadsAtualizadoEm ?? null };
  });
  return NextResponse.json(resposta);
}

type Corpo = { acao?: unknown; ids?: unknown };

export async function POST(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const corpo = await lerJson<Corpo>(req, 50_000);
  const ids = Array.isArray(corpo?.ids) ? new Set(corpo.ids.filter((x): x is string => typeof x === 'string')) : null;
  if (corpo?.acao !== 'lidas' || !ids) return NextResponse.json({ erro: 'Envie { acao: "lidas", ids: [...] }.' }, { status: 400 });
  alterarBanco((b) => {
    for (const n of b.notificacoes ?? []) if (ids.has(n.id)) n.lida = true;
  });
  return NextResponse.json({ ok: true });
}
