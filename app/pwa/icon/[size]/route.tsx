import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TAMANHOS = [180, 192, 512] as const;

// Redimensiona a imagem OFICIAL fornecida pela Nexa, nunca desenha outro N.
export async function GET(req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!TAMANHOS.some((t) => t === size)) {
    return new Response('Tamanho indisponível.', { status: 404 });
  }
  const imagem = await fetch(new URL('/branding/nexa-app.png', req.url), { cache: 'force-cache' });
  if (!imagem.ok) return new Response('Ícone indisponível.', { status: 503 });
  const bytes = Buffer.from(await imagem.arrayBuffer());
  const fonte = 'data:image/png;base64,' + bytes.toString('base64');
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fonte} alt="Nexa Workspace" style={{ width: '100%', height: '100%' }} />
    </div>,
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
