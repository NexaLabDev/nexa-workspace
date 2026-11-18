// Teste real de push, estritamente para um dispositivo do usuário autenticado.
import { NextResponse } from 'next/server';
import { clienteSessao } from '@/lib/supabase/sessao';
import { enviarPush } from '@/lib/servidor/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return NextResponse.json({ erro: 'Envie JSON.' }, { status: 415 });
  const { data: { user } } = await clienteSessao().auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Entre no Nexa novamente.' }, { status: 401 });
  let endpoint: unknown;
  try { endpoint = (await req.json() as { endpoint?: unknown }).endpoint; }
  catch { return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 }); }
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return NextResponse.json({ erro: 'Dispositivo inválido.' }, { status: 400 });
  const db = clienteSessao();
  const { data: insc, error } = await db.from('dispositivos_push').select('endpoint,chaves').eq('endpoint', endpoint).maybeSingle();
  if (error || !insc) return NextResponse.json({ erro: 'Ative as notificações deste dispositivo primeiro.' }, { status: 404 });
  const chaves = insc.chaves as { p256dh: string; auth: string };
  const res = await enviarPush({ endpoint: insc.endpoint, keys: chaves, filtro: null, criadaEm: '' }, {
    titulo: 'Notificações Nexa ativadas',
    corpo: 'O app está pronto para avisar sobre mensagens, leads, tarefas e eventos importantes.',
    url: '/configuracoes',
    tag: 'nexa-push-teste',
  });
  if (res === 'expirada') {
    await db.from('dispositivos_push').delete().eq('endpoint', endpoint);
    return NextResponse.json({ erro: 'Inscrição expirada. Reative as notificações.' }, { status: 410 });
  }
  if (res !== 'ok') return NextResponse.json({ erro: 'O serviço de notificações não aceitou o envio.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
