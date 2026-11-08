// Proteções das rotas da API local:
//  - só atende pelo próprio computador (localhost);
//  - recusa pedidos vindos de outros sites (Origin diferente) e corpo que não seja JSON,
//    para que uma página aberta no navegador não consiga mexer nos dados.

import { NextResponse } from 'next/server';

const LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function nomeHost(h: string | null): string | null {
  if (!h) return null;
  try {
    return new URL(`http://${h}`).hostname;
  } catch {
    return null;
  }
}

export function recusar(req: Request, exigirJson = true): NextResponse | null {
  const host = req.headers.get('host');
  if (!LOCAIS.has(nomeHost(host) ?? '')) return NextResponse.json({ erro: 'Disponível só neste computador.' }, { status: 403 });
  const origem = req.headers.get('origin');
  if (origem) {
    let hostOrigem = '';
    try {
      hostOrigem = new URL(origem).host;
    } catch {
      /* origem inválida */
    }
    if (hostOrigem !== host) return NextResponse.json({ erro: 'Origem não permitida.' }, { status: 403 });
  }
  if (exigirJson && req.method !== 'GET' && !(req.headers.get('content-type') ?? '').includes('application/json')) {
    return NextResponse.json({ erro: 'Envie JSON.' }, { status: 415 });
  }
  return null;
}

export async function lerJson<T>(req: Request, limiteBytes: number): Promise<T | null> {
  const texto = await req.text();
  if (texto.length > limiteBytes) return null;
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}
