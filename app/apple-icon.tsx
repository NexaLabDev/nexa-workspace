import { gerarIconeNexa } from '@/lib/branding/icone-nexa';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function IconeApple() {
  return gerarIconeNexa(180);
}
