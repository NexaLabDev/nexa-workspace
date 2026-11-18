import { ImageResponse } from 'next/og';

// Ícone gerado em PNG no tamanho exato solicitado pelo navegador.
// Logomarca geométrica N em preto, branco e verde-limão da Nexa.
const TAMANHOS = [180, 192, 512] as const;

export async function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!TAMANHOS.some((t) => t === size)) {
    return new Response('Tamanho de ícone indisponível.', { status: 404 });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="112" fill="#141617"/>
    <rect x="11" y="11" width="490" height="490" rx="102" fill="none" stroke="#2C3531" stroke-width="10"/>
    <path d="M135 360V151h54v209z" fill="#FFFFFF"/>
    <path d="M171 151h61l131 209h-61z" fill="#FFFFFF"/>
    <path d="M308 151h59v209h-59z" fill="#C4F03A"/>
  </svg>`;
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#141617' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="Nexa" style={{ width: '100%', height: '100%' }} />
    </div>,
    { width: size, height: size }
  );
}
