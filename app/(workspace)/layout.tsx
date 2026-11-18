import AreaPrivada from '@/components/acesso/AreaPrivada';

// No App Router, o layout compartilhado permanece montado ao trocar de
// módulo. A sessão e os dados remotos deixam de reiniciar em cada navegação.
export const dynamic = 'force-dynamic';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AreaPrivada>{children}</AreaPrivada>;
}
