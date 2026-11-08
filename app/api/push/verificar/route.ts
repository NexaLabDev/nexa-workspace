// "Verificar agora": roda a mesma verificação do agendador, sem esperar os 15 minutos.
import { NextResponse } from 'next/server';
import { recusar } from '@/lib/servidor/guarda';
import { verificarVencimentos } from '@/lib/servidor/agendador';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  // Pedido manual: ignora a janela de horário; os avisos já enviados continuam sem repetir.
  return NextResponse.json(await verificarVencimentos(new Date(), true));
}
