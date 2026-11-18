import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() {
  const chave = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!chave) return NextResponse.json({ erro: 'Push indisponível no servidor.' }, { status: 503 });
  // Chave PUBLICA por definição; nenhuma credencial privada é entregue.
  return NextResponse.json({ chave }, { headers: { 'Cache-Control': 'no-store' } });
}
