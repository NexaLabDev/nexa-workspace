import AreaPrivada from '@/components/acesso/AreaPrivada';
import ReconciliarRelacoes from '@/components/nexa/ReconciliarRelacoes';
import WorkspaceConteudo from '@/components/nexa/WorkspaceConteudo';

// No App Router, o layout compartilhado permanece montado ao trocar de
// módulo. A sessão e os dados remotos deixam de reiniciar em cada navegação.
export const dynamic = 'force-dynamic';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  // O conteúdo de cada aba é carregado no cliente após a checagem inicial da sessão.
  // As rotas originais continuam válidas para recarregar e abrir links diretos.
  return <AreaPrivada><ReconciliarRelacoes /><WorkspaceConteudo /></AreaPrivada>;
}
