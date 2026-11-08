// Envia uma notificação de teste para este navegador (confirma que o push chega de verdade).
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco, lerBanco } from '@/lib/servidor/armazem';
import { enviarPush } from '@/lib/servidor/push';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const corpo = await lerJson<{ endpoint?: unknown }>(req, 2_000);
  const insc = lerBanco().inscricoes.find((i) => i.endpoint === corpo?.endpoint);
  if (!insc) return NextResponse.json({ erro: 'Este navegador não está inscrito.' }, { status: 404 });
  const res = await enviarPush(insc, {
    titulo: 'Avisos do Nexa Workspace ativos',
    corpo: 'Você vai receber aqui os vencimentos de parcelas e mensalidades.',
    url: '/recebimentos',
    tag: 'teste',
  });
  if (res === 'expirada') {
    alterarBanco((b) => {
      b.inscricoes = b.inscricoes.filter((x) => x.endpoint !== insc.endpoint);
    });
    return NextResponse.json({ erro: 'A inscrição expirou. Ative os avisos de novo.' }, { status: 410 });
  }
  if (res === 'erro') return NextResponse.json({ erro: 'O serviço de push recusou o envio. Veja o terminal do servidor.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
