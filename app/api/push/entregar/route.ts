// Webhook assinado pelo banco: envia push sem expor chave privada ao navegador.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enviarPush } from '@/lib/servidor/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Entrega = {
  id?: unknown;
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  titulo?: unknown;
  corpo?: unknown;
  url?: unknown;
  tag?: unknown;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const b64 = /^[a-zA-Z0-9_-]+=*$/;

function endpointSeguro(valor: unknown): valor is string {
  if (typeof valor !== 'string' || valor.length > 1000) return false;
  try {
    const u = new URL(valor);
    return u.protocol === 'https:' && !u.username && !u.password && u.port === '' &&
      !['localhost', '127.0.0.1'].includes(u.hostname) && !u.hostname.endsWith('.localhost');
  } catch { return false; }
}

export async function POST(req: Request) {
  const segredo = process.env.NEXA_PUSH_WEBHOOK_SECRET?.trim();
  if (!segredo || segredo.length < 24) return NextResponse.json({ erro: 'Webhook indisponível.' }, { status: 503 });
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ erro: 'Formato inválido.' }, { status: 415 });
  }
  const ts = req.headers.get('x-nexa-ts') ?? '';
  const sig = req.headers.get('x-nexa-sig') ?? '';
  if (!/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300 || !/^[0-9a-f]{64}$/i.test(sig)) {
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 });
  }
  const texto = await req.text();
  if (texto.length > 8000) return NextResponse.json({ erro: 'Requisição muito grande.' }, { status: 413 });
  let corpo: Entrega;
  try { corpo = JSON.parse(texto) as Entrega; }
  catch { return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 }); }

  if (!uuid.test(String(corpo.id)) || !endpointSeguro(corpo.endpoint) ||
      typeof corpo.keys?.p256dh !== 'string' || typeof corpo.keys?.auth !== 'string' ||
      corpo.keys.p256dh.length > 200 || corpo.keys.auth.length > 100 ||
      !b64.test(corpo.keys.p256dh) || !b64.test(corpo.keys.auth) ||
      typeof corpo.titulo !== 'string' || typeof corpo.corpo !== 'string' ||
      typeof corpo.url !== 'string' || !corpo.url.startsWith('/') || corpo.url.startsWith('//') ||
      typeof corpo.tag !== 'string') {
    return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 });
  }

  // O mesmo texto que o gatilho pg_net assina; comparar em tempo constante.
  const esperado = createHmac('sha256', segredo)
    .update(String(corpo.id) + '.' + corpo.endpoint + '.' + ts).digest();
  const recebido = Buffer.from(sig, 'hex');
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 });
  }
  const resultado = await enviarPush(
    { endpoint: corpo.endpoint, keys: { p256dh: corpo.keys.p256dh, auth: corpo.keys.auth }, filtro: null, criadaEm: '' },
    { titulo: corpo.titulo.slice(0, 160), corpo: corpo.corpo.slice(0, 300), url: corpo.url.slice(0, 320), tag: corpo.tag.slice(0, 240) },
  );
  return NextResponse.json({ ok: resultado === 'ok', estado: resultado }, { status: resultado === 'erro' ? 502 : 200 });
}
