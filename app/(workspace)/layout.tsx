import AreaPrivada from '@/components/acesso/AreaPrivada';
import ReconciliarRelacoes from '@/components/nexa/ReconciliarRelacoes';

// No App Router, o layout compartilhado permanece montado ao trocar de
// módulo. A sessão e os dados remotos deixam de reiniciar em cada navegação.
export const dynamic = 'force-dynamic';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AreaPrivada><ReconciliarRelacoes />{children}</AreaPrivada>;
}
