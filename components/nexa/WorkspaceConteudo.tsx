'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// As telas já são componentes de cliente e leem os dados compartilhados do
// Supabase. A primeira visita valida o usuário no servidor (AreaPrivada);
// trocas de aba usam a History API nativa do Next 14, sem buscar outro RSC.
const Dashboard = dynamic(() => import('@/components/dashboard-nexa/DashboardNexa'));
const Crm = dynamic(() => import('@/components/nexa/telas/TelaCrm'));
const Conversas = dynamic(() => import('@/components/nexa/telas/TelaConversas'));
const Metas = dynamic(() => import('@/components/nexa/telas/TelaMetas'));
const Recebimentos = dynamic(() => import('@/components/nexa/telas/TelaRecebimentos'));
const Clientes = dynamic(() => import('@/components/nexa/telas/TelaClientes'));
const Cliente = dynamic(() => import('@/components/nexa/telas/TelaCliente'));
const Kanban = dynamic(() => import('@/components/nexa/telas/TelaKanban'));
const Catalogo = dynamic(() => import('@/components/nexa/telas/TelaCatalogo'));
const Calculadora = dynamic(() => import('@/components/nexa/telas/TelaCalculadora'));
const Documentos = dynamic(() => import('@/components/nexa/telas/TelaDocumentos'));
const Configuracoes = dynamic(() => import('@/components/nexa/telas/TelaConfiguracoes'));

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
  '/documentos': 'Gerador de Documentos',
  '/configuracoes': 'Configurações',
};

// Não persiste nem copia dados comerciais. A transição apenas escolhe a tela.
export default function WorkspaceConteudo() {
  const pathname = usePathname();
  const rota = pathname.replace(/\\/+$/, '') || '/';
  const detalheCliente = rota.startsWith('/clientes/') && rota.length > '/clientes/'.length;
  useEffect(() => {
    document.title = `${detalheCliente ? 'Cliente' : (titulos[rota] ?? 'Nexa Workspace')} — Nexa Workspace`;
  }, [rota, detalheCliente]);

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
    case '/documentos': return <Documentos />;
    case '/configuracoes': return <Configuracoes />;
    default:
      if (detalheCliente) {
        let id = rota.slice('/clientes/'.length);
        try { id = decodeURIComponent(id); } catch { return <p>Endereço do cliente inválido.</p>; }
        return <Cliente id={id} />;
      }
      return <p>Esta página não faz parte do Workspace.</p>;
  }
}
