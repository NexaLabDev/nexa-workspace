import { gerarIconeNexa } from '@/lib/branding/icone-nexa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { size: string } }) {
  const tamanho = Number(params.size);
  if (![180, 192, 512].includes(tamanho)) return new Response('Ícone indisponível.', { status: 404 });
  return gerarIconeNexa(tamanho);
}
