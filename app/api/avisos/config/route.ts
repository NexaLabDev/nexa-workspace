// Quando avisar: dias de antecedência, no dia do vencimento e depois de vencida.
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco, lerBanco } from '@/lib/servidor/armazem';
import { atualizarNotificacoes, configDe, configValida } from '@/lib/servidor/notificacoes';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  return NextResponse.json({ config: configDe(lerBanco()) });
}

export async function PUT(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const cfg = configValida(await lerJson<unknown>(req, 2_000));
  if (!cfg) return NextResponse.json({ erro: 'Configuração inválida.' }, { status: 400 });
  alterarBanco((b) => {
    b.configAvisos = cfg;
    atualizarNotificacoes(b);
  });
  return NextResponse.json({ ok: true, config: cfg });
}
