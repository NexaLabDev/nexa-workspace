import { gerarIconeNexa } from '@/lib/branding/icone-nexa';

export const runtime = 'nodejs';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icone() {
  return gerarIconeNexa(512);
}
