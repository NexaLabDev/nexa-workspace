// Teste de Web Push autenticado. A inscrição precisa pertencer à conta logada.
import { NextResponse } from 'next/server';
import { clienteSessao } from '@/lib/supabase/sessao';
import { enviarPush } from '@/lib/servidor/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ erro: 'Envie JSON.' }, { status: 415 });
  }
  const db = clienteSessao();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Sua sessão expirou. Entre no Nexa novamente.' }, { status: 401 });
  let endpoint: unknown;
  try {
    const body = await req.text();
    if (body.length > 2000) return NextResponse.json({ erro: 'Dados muito grandes.' }, { status: 413 });
    endpoint = (JSON.parse(body) as { endpoint?: unknown }).endpoint;
  } catch {
    return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 });
  }
  if (typeof endpoint !== 'string' || endpoint.length > 1000) {
    return NextResponse.json({ erro: 'Dispositivo inválido.' }, { status: 400 });
  }
  // RLS impede consultar ou testar inscrições de outro usuário.
  const { data: insc, error } = await db.from('dispositivos_push')
    .select('endpoint,chaves').eq('endpoint', endpoint).maybeSingle();
  if (error || !insc) {
    return NextResponse.json({ erro: 'Este dispositivo não está inscrito nesta conta.' }, { status: 404 });
  }
  const chaves = insc.chaves as { p256dh: string; auth: string };
  if (!chaves?.p256dh || !chaves?.auth) {
    return NextResponse.json({ erro: 'Chaves do dispositivo inválidas.' }, { status: 400 });
  }
  const resultado = await enviarPush({
    endpoint: insc.endpoint,
    keys: { p256dh: chaves.p256dh, auth: chaves.auth },
    filtro: null, criadaEm: '',
  }, {
    titulo: 'Nexa Workspace — notificações ativas',
    corpo: 'Este é um teste de envio real do servidor para o seu dispositivo.',
    url: '/configuracoes',
    tag: 'nexa-teste-real',
  });
  if (resultado === 'expirada') {
    await db.from('dispositivos_push').delete().eq('endpoint', endpoint);
    return NextResponse.json({ erro: 'Inscrição expirada. Ative as notificações novamente.' }, { status: 410 });
  }
  if (resultado === 'erro') return NextResponse.json({ erro: 'Falha no serviço de push. Tente novamente.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
