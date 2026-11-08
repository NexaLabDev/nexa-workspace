// Chave pública VAPID: o navegador precisa dela para se inscrever nos avisos.
import { NextResponse } from 'next/server';
import { recusar } from '@/lib/servidor/guarda';
import { chavePublica } from '@/lib/servidor/push';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const chave = chavePublica();
  if (!chave) return NextResponse.json({ erro: 'Chaves de push não configuradas no servidor (.env.local).' }, { status: 503 });
  return NextResponse.json({ chave });
}
