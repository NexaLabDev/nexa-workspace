import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Símbolo vetorial oficial corrigido da Nexa: branco e verde sobre preto.
// Fonte única para iPhone, favicon, manifesto PWA e notificações.
let imagem: string | null = null;
export function gerarIconeNexa(tamanho: number): ImageResponse {
  if (!imagem) {
    const svg = readFileSync(join(process.cwd(), 'public', 'branding', 'nexa-simbolo-oficial.svg'), 'utf8');
    imagem = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  }
  return new ImageResponse(
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0B0B0B', width: '100%', height: '100%'
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imagem} alt="Nexa Lab" style={{ width: '84%', height: '84%', objectFit: 'contain' }} />
    </div>,
    { width: tamanho, height: tamanho,
      headers: { 'Cache-Control': 'public, max-age=3600, must-revalidate' } },
  );
}
