'use client';

// ============================================
// MOLDURA DO NEXA WORKSPACE
// ============================================
// Barra preta de ícones (no celular, barra embaixo) + barra de busca.
// Foto de fundo: Pexels nº 12701459 (licença Pexels, uso livre), com cor ajustada.
// ============================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavegacaoRapida from './NavegacaoRapida';
import {
  Box,
  BrainCircuit,
  Columns2,
  FileText,
  House,
  LayoutGrid,
  Menu,
  X,
  MessageSquareMore,
  Plus,
  Search,
  Settings,
  Target,
  CalendarClock,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import s from './shell.module.css';
import PaletaBusca from './PaletaBusca';
import { useLeads } from './dados';
import { alertasCobranca } from './financeiro';
import TopoAcoes from './TopoAcoes';
import useRolagemNavegacao from './useRolagemNavegacao';

export type AbaNexa =
  | 'dashboard'
  | 'crm'
  | 'conversas'
  | 'metas'
  | 'recebimentos'
  | 'clientes'
  | 'kanban'
  | 'servicos'
  | 'calculadora'
  | 'intelligence'
  | 'documentos'
  | 'configuracoes';

const TRILHO: Array<{ aba: AbaNexa; nome: string; curto: string; href: string; icone: LucideIcon }> = [
  { aba: 'dashboard', nome: 'Dashboard', curto: 'Início', href: '/', icone: House },
  { aba: 'crm', nome: 'CRM', curto: 'CRM', href: '/crm', icone: LayoutGrid },
  { aba: 'conversas', nome: 'Conversas', curto: 'Chat', href: '/conversas', icone: MessageSquareMore },
  { aba: 'metas', nome: 'Meta Mensal', curto: 'Meta', href: '/metas', icone: Target },
  { aba: 'recebimentos', nome: 'Recebimentos', curto: 'Receber', href: '/recebimentos', icone: CalendarClock },
  { aba: 'clientes', nome: 'Clientes', curto: 'Clientes', href: '/clientes', icone: Users },
  { aba: 'kanban', nome: 'Kanban', curto: 'Kanban', href: '/kanban', icone: Columns2 },
  { aba: 'servicos', nome: 'Serviços', curto: 'Serviços', href: '/catalogo', icone: Box },
  { aba: 'intelligence', nome: 'Nexa Intelligence', curto: 'Nexa IA', href: '/intelligence', icone: BrainCircuit },
  { aba: 'documentos', nome: 'Gerador de Documentos', curto: 'Docs', href: '/documentos', icone: FileText },
];

const ICONE = { strokeWidth: 1.7 } as const;

/** O layout foi desenhado em 1672 × 941. Em telas maiores, amplia tudo na mesma proporção. */
const BASE_LARGURA = 1672;
const BASE_ALTURA = 941;

function useEscala(): number {
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const medir = () =>
      setEscala(Math.max(1, Math.min(window.innerWidth / BASE_LARGURA, window.innerHeight / BASE_ALTURA)));
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  return escala;
}

type Props = {
  aba: AbaNexa;
  children: ReactNode;
  /** Conteúdo fixo no canto superior direito (ex.: cartão de clima do painel inicial) */
  cantoDireito?: ReactNode;
  /** Texto da busca do topo */
  buscaTexto?: string;
  /** Botão verde da busca */
  botaoNovo?: { texto: string; href?: string; onClick?: () => void };
  /** Topo do CRM: ícones sem círculo e avatar do usuário à direita */
  topoCompacto?: { iniciais: string };
  /** Topo com a marca "Nexa Lab | título" e busca simples, sem botão verde (tela de Conversas) */
  marcaTitulo?: string;
  /** Esconde somente as ações superiores da tela atual (calendário, sino, ajuda e perfil). */
  ocultarAcoesTopo?: boolean;
  /** Mantém os atalhos originais em uma navegação lateral que abre sob demanda. */
  menuRetratil?: boolean;
};

export default function NexaShell({
  aba,
  children,
  cantoDireito,
  buscaTexto = 'Buscar clientes, projetos, propostas ou documentos...',
  botaoNovo = { texto: 'Novo', href: '/clientes?novo=1' },
  topoCompacto,
  marcaTitulo,
  ocultarAcoesTopo = false,
  menuRetratil = false,
}: Props) {
  const escala = useEscala();
  // Destaca a aba de destino imediatamente, mas associa o scroll ao
  // componente ainda renderizado durante o carregamento de outro módulo.
  const pathname = usePathname();
  const ativo = (href: string) => pathname === href ||
    (href === '/clientes' && pathname.startsWith('/clientes/'));
  const { raizRef, principalRef, navCelularRef } = useRolagemNavegacao(aba);
  const inicio = aba === 'dashboard';
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [leads] = useLeads();
  const alertas = useMemo(() => alertasCobranca(leads).length, [leads]);

  // Ctrl + K (ou Cmd + K no Mac) abre a busca em qualquer tela
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaAberta(true);
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  useEffect(() => { setMenuAberto(false); }, [pathname]);
  useEffect(() => {
    if (!menuAberto) return;
    const fecharEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuAberto(false); };
    window.addEventListener('keydown', fecharEsc);
    return () => window.removeEventListener('keydown', fecharEsc);
  }, [menuAberto]);

  const conteudoNovo = (
    <>
      <Plus size={18} strokeWidth={2.2} /> {botaoNovo.texto}
    </>
  );

  const configAtiva = ativo('/configuracoes');

  return (
    <div
      ref={raizRef}
      className={`${s.raiz} ${inicio ? '' : s.raizInterna} ${menuRetratil ? s.raizMenuRetratil : ''}`}
      style={escala > 1 ? { zoom: escala } : undefined}
    >
      {/* ===== Barra de ícones / menu lateral recolhível ===== */}
      {menuRetratil && menuAberto && (
        <button type="button" className={s.menuFundo} aria-label="Fechar menu lateral" onClick={() => setMenuAberto(false)} />
      )}
      <nav
        className={`${s.trilho} ${menuRetratil ? s.menuLateral : ''} ${menuAberto ? s.menuLateralAberto : ''}`}
        aria-label="Navegação"
        aria-hidden={menuRetratil && !menuAberto}
      >
        {menuRetratil && (
          <div className={s.menuLateralTopo}>
            <span>Menu Nexa</span>
            <button type="button" aria-label="Fechar menu" onClick={() => setMenuAberto(false)}><X size={19}/></button>
          </div>
        )}
        <NavegacaoRapida href="/" aria-label="Nexa Lab — início" onClick={() => menuRetratil && setMenuAberto(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/simbolo-nexa.png" alt="" className={s.simbolo} />
          {menuRetratil && <span className={s.menuNomeMarca}>Nexa Workspace</span>}
        </NavegacaoRapida>
        {TRILHO.map(({ aba: a, nome, href, icone: Icone }) => (
          <NavegacaoRapida
            key={a}
            href={href}
            onClick={() => menuRetratil && setMenuAberto(false)}
            className={`${s.trilhoBtn} ${ativo(href) ? s.trilhoAtivo : ''}`}
            aria-label={nome}
            title={nome}
            aria-current={ativo(href) ? 'page' : undefined}
          >
            <Icone size={24} {...ICONE} />
            {menuRetratil && <span className={s.menuLateralNome}>{nome}</span>}
            {a === 'recebimentos' && alertas > 0 && <span className={s.pontoTrilho} aria-label={`${alertas} cobrança(s) vencida(s) ou perto do vencimento`} />}
          </NavegacaoRapida>
        ))}
        <span className={s.trilhoDivisor} aria-hidden />
        <NavegacaoRapida
          href="/configuracoes"
          onClick={() => menuRetratil && setMenuAberto(false)}
          className={`${s.trilhoBtn} ${s.trilhoRodape} ${configAtiva ? s.trilhoAtivo : ''}`}
          aria-label="Configurações"
          title="Configurações"
          aria-current={configAtiva ? 'page' : undefined}
        >
          <Settings size={24} {...ICONE} />
          {menuRetratil && <span className={s.menuLateralNome}>Configurações</span>}
        </NavegacaoRapida>
      </nav>

      {/* ===== Área principal ===== */}
      <main ref={principalRef} className={s.principal}>
        <header
          className={`${s.topo} ${cantoDireito ? s.topoComCanto : ''} ${topoCompacto ? s.topoCompacto : ''} ${menuRetratil ? s.topoMenuRetratil : ''}`}
        >
          {menuRetratil && (
            <button type="button" className={s.botaoAbrirMenu} aria-label="Abrir menu lateral" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
              <Menu size={23} strokeWidth={2}/>
            </button>
          )}
          {marcaTitulo ? (
            <>
              <Link href="/" scroll={false} className={s.marca}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/dashboard/simbolo-nexa.png" alt="" />
                <span>Nexa Lab</span>
              </Link>
              <span className={s.marcaSep} aria-hidden />
              <h1 className={s.marcaTitulo}>{marcaTitulo}</h1>
              <button type="button" className={s.buscaSimples} onClick={() => setBuscaAberta(true)}>
                <Search size={20} strokeWidth={1.8} aria-hidden />
                <span>{buscaTexto}</span>
                <kbd className={s.atalhoTecla}>Ctrl + K</kbd>
              </button>
            </>
          ) : (
            <div className={s.busca}>
              <Zap size={26} className={s.buscaRaio} fill="currentColor" strokeWidth={1.2} aria-hidden />
              <button type="button" className={s.buscaGatilho} onClick={() => setBuscaAberta(true)}>
                {buscaTexto}
              </button>
              <kbd className={s.atalhoTecla}>Ctrl + K</kbd>
              <span className={s.buscaSep} aria-hidden />
              {botaoNovo.onClick ? (
                <button type="button" className={s.btnNovo} onClick={botaoNovo.onClick}>
                  {conteudoNovo}
                </button>
              ) : (
                <Link href={botaoNovo.href ?? '/'} scroll={false} className={s.btnNovo}>
                  {conteudoNovo}
                </Link>
              )}
            </div>
          )}
          {topoCompacto && !ocultarAcoesTopo && <span className={s.espaco} aria-hidden />}
          {!ocultarAcoesTopo && <TopoAcoes compacto={!!topoCompacto} iniciais={topoCompacto?.iniciais} />}
        </header>

        {cantoDireito}

        {children}
      </main>

      {/* ===== Navegação no celular ===== */}
      <nav ref={navCelularRef} className={`${s.navCelular} ${menuRetratil ? s.navCelularOculta : ''}`} aria-label="Navegação">
        {[...TRILHO, { aba: 'configuracoes' as AbaNexa, nome: 'Configurações', curto: 'Ajustes', href: '/configuracoes', icone: Settings }].map(
          ({ aba: a, curto, href, icone: Icone }) => (
            <NavegacaoRapida
              key={a}
              href={href}
              className={`${s.navCelularItem} ${ativo(href) ? s.navCelularAtivo : ''}`}
              aria-current={ativo(href) ? 'page' : undefined}
            >
              <Icone size={22} {...ICONE} />
              <span>{curto}</span>
            </NavegacaoRapida>
          )
        )}
      </nav>

      {buscaAberta && <PaletaBusca onFechar={() => setBuscaAberta(false)} />}
    </div>
  );
}
