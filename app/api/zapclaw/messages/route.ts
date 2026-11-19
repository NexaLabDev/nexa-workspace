import { NextResponse } from 'next/server';
import {
  autorizadoParaConversas, configuracaoZapclaw, normalizarMensagem, requisicaoZapclaw
} from '@/lib/servidor/zapclaw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!(await autorizadoParaConversas('ler'))) {
    return NextResponse.json({ erro: 'Acesso não autorizado.' }, { status: 403, headers });
  }
  const config = await configuracaoZapclaw();
  if (!config) {
    return NextResponse.json({
      configurado: false,
      erro: 'Configure ZAPCLAW_API_KEY na Vercel. Se houver vários números na ZapClaw, defina também ZAPCLAW_FROM.'
    }, { status: 503, headers });
  }

  try {
    const params = new URLSearchParams({ from: config.numero, limit: '100' });
    const resposta = await requisicaoZapclaw('/send/messages', config.chave, { params });
    if (!resposta.ok) {
      const erro = resposta.status === 401 ? 'Chave de API inválida ou revogada.'
        : resposta.status === 402 ? 'Limite ou saldo da ZapClaw indisponível.'
        : resposta.status === 429 ? 'Muitas consultas. Tente novamente em instantes.'
        : 'Não foi possível consultar a ZapClaw (HTTP ' + resposta.status + ').';
      return NextResponse.json({ erro }, { status: resposta.status === 401 ? 502 : 503, headers });
    }
    const mensagens = Array.isArray(resposta.dados.messages)
      ? resposta.dados.messages.map((m) => normalizarMensagem(m)).filter(Boolean)
      : [];
    return NextResponse.json({
      configurado: true,
      numero: config.numero,
      mensagens,
      limitado: typeof resposta.dados.nextCursor === 'string',
    }, { headers });
  } catch {
    return NextResponse.json({ erro: 'ZapClaw não respondeu. Tente novamente.' }, { status: 502, headers });
  }
}
