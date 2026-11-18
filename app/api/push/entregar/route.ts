// Supabase pg_net envia apenas eventos assinados para este endpoint.
// Jamais confia em dados de origem sem HMAC + timestamp; não exige cookies do usuário.
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { enviarPush } from '@/lib/servidor/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTPS_PROVIDERS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'push.apple.com',
  'notify.windows.com',
  'wns.windows.com',
] as const;

function provedorValido(endpoint: string) {
  try {
    const u = new URL(endpoint);
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password &&
      (HTTPS_PROVIDERS.includes(h as typeof HTTPS_PROVIDERS[number]) ||
       h.endsWith('.push.apple.com') || h.endsWith('.notify.windows.com') ||
       h.endsWith('.wns.windows.com') || h.endsWith('.push.services.mozilla.com'));
  } catch { return false; }
}

type Corpo = {
  id?: unknown;
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  titulo?: unknown;
  corpo?: unknown;
  url?: unknown;
  tag?: unknown;
};

export async function POST(req: Request) {
  const segredo = process.env.NEXA_PUSH_WEBHOOK_SECRET;
  const assinatura = req.headers.get('x-nexa-sig') ?? '';
  const stamp = req.headers.get('x-nexa-ts') ?? '';
  if (!segredo || !/^\d{10}$/.test(stamp) || !/^[a-f0-9]{64}$/.test(assinatura) ||
      Math.abs(Date.now() / 1000 - Number(stamp)) > 300) {
    return NextResponse.json({ erro: 'Webhook não autorizado.' }, { status: 401 });
  }
  const texto = await req.text();
  if (texto.length > 8000) return NextResponse.json({ erro: 'Evento grande demais.' }, { status: 413 });
  let dados: Corpo;
  try { dados = JSON.parse(texto) as Corpo; } catch {
    return NextResponse.json({ erro: 'JSON inválido.' }, { status: 400 });
  }
  const id = dados.id;
  const endpoint = dados.endpoint;
  const keys = dados.keys;
  if (typeof id !== 'string' || !UUID.test(id) ||
      typeof endpoint !== 'string' || endpoint.length > 1000 || !provedorValido(endpoint) ||
      typeof keys?.p256dh !== 'string' || !BASE64URL.test(keys.p256dh) ||
      typeof keys?.auth !== 'string' || !BASE64URL.test(keys.auth) ||
      keys.p256dh.length > 200 || keys.auth.length > 100) {
    return NextResponse.json({ erro: 'Inscrição inválida.' }, { status: 400 });
  }
  // Supabase assina "id.endpoint.timestamp"; comparação em tempo constante.
  const esperado = createHmac('sha256', segredo).update(id + '.' + endpoint + '.' + stamp).digest();
  const recebido = Buffer.from(assinatura, 'hex');
  if (recebido.length !== esperado.length || !timingSafeEqual(esperado, recebido)) {
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 });
  }

  const url = typeof dados.url === 'string' && dados.url.startsWith('/') &&
    !dados.url.startsWith('//') && !dados.url.includes('\\') &&
    dados.url.length <= 315 ? dados.url : '/';
  const resultado = await enviarPush({
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    filtro: null,
    criadaEm: '',
  }, {
    titulo: typeof dados.titulo === 'string' ? dados.titulo.slice(0, 160) : 'Nexa Workspace',
    corpo: typeof dados.corpo === 'string' ? dados.corpo.slice(0, 300) : '',
    url,
    tag: typeof dados.tag === 'string' ? dados.tag.slice(0, 240) : id,
  });
  if (resultado === 'erro') return NextResponse.json({ ok: false }, { status: 502 });
  return NextResponse.json({ ok: true, resultado });
}
