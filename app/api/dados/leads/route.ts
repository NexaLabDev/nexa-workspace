// Espelho dos leads no servidor: o navegador envia a lista sempre que ela muda,
// para o agendador conseguir conferir vencimentos mesmo com o Workspace fechado.
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco } from '@/lib/servidor/armazem';
import { atualizarNotificacoes } from '@/lib/servidor/notificacoes';
import type { Lead } from '@/components/nexa/dados-exemplo';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const leads = await lerJson<unknown>(req, 10_000_000);
  if (!Array.isArray(leads) || !leads.every((l) => l && typeof l === 'object' && typeof (l as Lead).id === 'string')) {
    return NextResponse.json({ erro: 'Lista de leads inválida.' }, { status: 400 });
  }
  alterarBanco((b) => {
    b.leads = leads as Lead[];
    b.leadsAtualizadoEm = new Date().toISOString();
    // a central reflete na hora (ex.: cobrança marcada como paga some dos avisos)
    atualizarNotificacoes(b);
  });
  return NextResponse.json({ ok: true });
}
