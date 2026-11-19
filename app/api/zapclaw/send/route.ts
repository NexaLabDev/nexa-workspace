import { NextResponse } from 'next/server';
import {
  autorizadoParaConversas, configuracaoZapclaw, normalizarMensagem, requisicaoZapclaw
} from '@/lib/servidor/zapclaw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export async function POST(req: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!(await autorizadoParaConversas('criar'))) {
    return NextResponse.json({ erro: 'Sua conta não tem permissão para enviar mensagens.' }, { status: 403, headers });
  }
  const config = configuracaoZapclaw();
  if (!config) {
    return NextResponse.json({ erro: 'Configure a chave da ZapClaw na Vercel primeiro.' }, { status: 503, headers });
  }
  const tamanho = Number(req.headers.get('content-length') ?? '0');
  if (tamanho > 6000) {
    return NextResponse.json({ erro: 'Mensagem muito grande.' }, { status: 413, headers });
  }
  let entrada: unknown;
  try { entrada = await req.json(); } catch {
    return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400, headers });
  }
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400, headers });
  }
  const dados = entrada as Record<string, unknown>;
  const para = typeof dados.to === 'string' ? dados.to.replace(/\D/g, '') : '';
  const texto = typeof dados.text === 'string' ? dados.text.trim() : '';
  const idempotencia = typeof dados.idempotencyKey === 'string' ? dados.idempotencyKey : '';
  if (!/^\d{10,15}$/.test(para) || !texto || texto.length > 4096 || !UUID.test(idempotencia)) {
    return NextResponse.json({ erro: 'Contato, texto ou identificador inválido.' }, { status: 400, headers });
  }

  // Primeiro ciclo: somente resposta manual a alguém que escreveu nas últimas 24 horas.
  // Não abre conversas novas nem dispara templates pagos.
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const consulta = await requisicaoZapclaw('/send/messages', config.chave, {
      params: new URLSearchParams({ from: config.numero, direction: 'inbound', since: desde, limit: '100' }),
    });
    if (!consulta.ok || !Array.isArray(consulta.dados.messages)) {
      return NextResponse.json({ erro: 'Não foi possível confirmar a janela de atendimento. Nenhuma mensagem foi enviada.' }, { status: 503, headers });
    }
    const contatos = consulta.dados.messages.map((m) => normalizarMensagem(m)).filter((m) => m?.direction === 'inbound');
    const ehContatoAtendido = contatos.some((m) => m?.to === para);
    if (!ehContatoAtendido) {
      return NextResponse.json({
        erro: 'Para este teste, aguarde o contato enviar uma mensagem primeiro (janela de 24 horas).'
      }, { status: 403, headers });
    }
    const enviado = await requisicaoZapclaw('/send/text', config.chave, {
      corpo: { from: config.numero, to: para, text: texto },
      idempotencyKey: idempotencia,
    });
    if (!enviado.ok) {
      const erro = enviado.status === 402 ? 'A ZapClaw/Meta exige saldo ou ajuste de cobrança.'
        : enviado.status === 429 ? 'Limite de envio atingido.'
        : enviado.status === 403 ? 'A Meta ou a ZapClaw bloqueou este envio.'
        : 'Envio recusado pela ZapClaw (HTTP ' + enviado.status + ').';
      return NextResponse.json({ erro }, { status: 502, headers });
    }
    // A ZapClaw pode devolver 202, quando o resultado é indeterminado.
    return NextResponse.json({
      enviado: enviado.status === 201,
      indeterminado: enviado.status === 202,
      aviso: enviado.status === 202 ? 'A Meta não confirmou a entrega. Não reenvie automaticamente.' : undefined,
    }, { headers });
  } catch {
    return NextResponse.json({
      erro: 'A ZapClaw não respondeu. Confira o histórico antes de tentar novamente.'
    }, { status: 502, headers });
  }
}
