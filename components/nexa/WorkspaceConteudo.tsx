'use client';

import { lazy, Suspense, useDeferredValue, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// As telas já são componentes de cliente e leem os dados compartilhados do
// Supabase. A primeira visita valida o usuário no servidor (AreaPrivada);
// trocas de aba usam a History API nativa do Next 14, sem buscar outro RSC.
const Dashboard = lazy(() => import('@/components/dashboard-nexa/DashboardNexa'));
const Crm = lazy(() => import('@/components/nexa/telas/TelaCrm'));
const Conversas = lazy(() => import('@/components/nexa/telas/TelaConversas'));
const Metas = lazy(() => import('@/components/nexa/telas/TelaMetas'));
const Recebimentos = lazy(() => import('@/components/nexa/telas/TelaRecebimentos'));
const Clientes = lazy(() => import('@/components/nexa/telas/TelaClientes'));
const Cliente = lazy(() => import('@/components/nexa/telas/TelaCliente'));
const Kanban = lazy(() => import('@/components/nexa/telas/TelaKanban'));
const Catalogo = lazy(() => import('@/components/nexa/telas/TelaCatalogo'));
const Calculadora = lazy(() => import('@/components/nexa/telas/TelaCalculadora'));
const Intelligence = lazy(() => import('@/components/nexa/telas/TelaIntelligence'));
const IntelligenceGestao = lazy(() => import('@/components/nexa/telas/TelaIntelligenceGestao'));
const Documentos = lazy(() => import('@/components/nexa/telas/TelaDocumentos'));
const Configuracoes = lazy(() => import('@/components/nexa/telas/TelaConfiguracoes'));

const titulos: Record<string, string> = {
  '/': 'Dashboard',
  '/crm': 'CRM de Leads',
  '/conversas': 'Conversas',
  '/metas': 'Meta Mensal',
  '/recebimentos': 'Recebimentos',
  '/clientes': 'Clientes',
  '/kanban': 'Kanban',
  '/catalogo': 'Serviços',
  '/calculadora': 'Calculadora de Serviço',
  '/intelligence': 'Nexa Intelligence',
  '/intelligence/gestao': 'Nexa Intelligence — Gestão',
  '/documentos': 'Gerador de Documentos',
  '/configuracoes': 'Configurações',
};

// React.lazy suspende apenas enquanto o módulo ainda não foi carregado.
// useDeferredValue mantém a aba anterior visível durante esse carregamento,
// evitando que o fundo preto do body apareça entre duas telas.
function ModuloAtual({ rota }: { rota: string }) {
  switch (rota) {
    case '/': return <Dashboard />;
    case '/crm': return <Crm />;
    case '/conversas': return <Conversas />;
    case '/metas': return <Metas />;
    case '/recebimentos': return <Recebimentos />;
    case '/clientes': return <Clientes />;
    case '/kanban': return <Kanban />;
    case '/catalogo': return <Catalogo />;
    case '/calculadora': return <Calculadora />;
    case '/intelligence': return <Intelligence />;
    case '/intelligence/gestao': return <IntelligenceGestao />;
    case '/documentos': return <Documentos />;
    case '/configuracoes': return <Configuracoes />;
    default:
      if (rota.startsWith('/clientes/') && rota.length > '/clientes/'.length) {
        let id = rota.slice('/clientes/'.length);
        try { id = decodeURIComponent(id); }
        catch { return <p>Endereço do cliente inválido.</p>; }
        return <Cliente id={id} />;
      }
      return <p>Esta página não faz parte do Workspace.</p>;
  }
}

export default function WorkspaceConteudo() {
  const pathname = usePathname();
  const rota = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const rotaVisivel = useDeferredValue(rota);
  const detalheCliente = rota.startsWith('/clientes/') && rota.length > '/clientes/'.length;

  useEffect(() => {
    document.title = `${detalheCliente ? 'Cliente' : (titulos[rota] ?? 'Nexa Workspace')} — Nexa Workspace`;
  }, [rota, detalheCliente]);

  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            background: '#f4f5f6',
            color: '#374151',
            fontSize: '14px',
          }}
        >
          Carregando módulo…
        </div>
      }
    >
      <ModuloAtual rota={rotaVisivel} />
    </Suspense>
  );
}
