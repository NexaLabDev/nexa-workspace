// Chave VAPID pública: inscrição do dispositivo autenticado no navegador.
import { NextResponse } from 'next/server';
import { chavePublica } from '@/lib/servidor/push';

export const dynamic = 'force-dynamic';
export function GET() {
  const chave = chavePublica();
  if (!chave) return NextResponse.json({ erro: 'Notificações indisponíveis no servidor.' }, { status: 503 });
  return NextResponse.json({ chave }, { headers: { 'Cache-Control': 'private, no-store' } });
}
