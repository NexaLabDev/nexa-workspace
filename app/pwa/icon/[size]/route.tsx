import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAMANHOS = [180, 192, 512] as const;

// A arte vem do SVG da marca Nexa. Nenhuma letra N genérica é desenhada.
export async function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!TAMANHOS.some((n) => n === size)) return new Response('Ícone indisponível.', { status: 404 });
  const simbolo = readFileSync(join(process.cwd(), 'public', 'nexa', 'simbolo.svg'), 'utf8');
  const imagem = 'data:image/svg+xml;base64,' + Buffer.from(simbolo).toString('base64');
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0B0C0B', alignItems: 'center', justifyContent: 'center', borderRadius: '23%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imagem} alt="Nexa Lab" style={{ display: 'block', width: '75%', height: '75%', objectFit: 'contain' }} />
    </div>,
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400, must-revalidate' } }
  );
}
