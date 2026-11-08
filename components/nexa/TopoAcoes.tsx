'use client';

// Botões do topo: Agenda, Ajuda, Notificações e Perfil, cada um com seu menu.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Calendar, CalendarClock, CheckSquare, ChevronDown, CircleAlert, CircleHelp, Settings, Target, Users } from 'lucide-react';
import s from './shell.module.css';
import { agendaHoje, mesChave, usuario } from './dados-exemplo';
import { diasPrazoProximo, useConversas, useDiasTrabalho, useLeads, useMetas, usePerfil, usePreferencias, useProjetos, useVendas } from './dados';
import { alertasTarefas, textoPrazoTarefa } from './tarefas';
import { pedirAberturaProjeto } from './util';
import { calcularResumoMeta, reaisCentavos } from './metas';
import { alertasCobranca, dataBr, diasAte, dinheiro as dinheiroFin, textoDias } from './financeiro';
import { useNotificacoes } from './notificacoes';
import { reais } from './util';

export const EVENTO_ABRIR = 'nexa:abrir-menu';
type Menu = 'agenda' | 'ajuda' | 'avisos' | 'perfil';

/** Abre um menu do topo a partir de outra tela (ex.: "Ver agenda" no painel). */
export function abrirMenuTopo(menu: Menu) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: menu }));
}

const ICONE = { strokeWidth: 1.7 } as const;

export default function TopoAcoes({ compacto, iniciais }: { compacto: boolean; iniciais?: string }) {
  const [aberto, setAberto] = useState<Menu | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [leads] = useLeads();
  const [vendas] = useVendas();
  const [perfil] = usePerfil();
  const [metas] = useMetas();
  const [regra] = useDiasTrabalho();

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(null);
    const pedido = (e: Event) => setAberto((e as CustomEvent<Menu>).detail);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    window.addEventListener(EVENTO_ABRIR, pedido);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
      window.removeEventListener(EVENTO_ABRIR, pedido);
    };
  }, []);

  const contatosHoje = leads.filter((l) => l.data === 'Hoje' && !['ganho', 'perdido'].includes(l.etapa));
  const resumo = calcularResumoMeta(mesChave(new Date()), vendas, metas, regra);
  // Central de notificações: vem do servidor; se ele não responder, calcula aqui mesmo
  const central = useNotificacoes();
  const cobrancas: Array<{ id: string; leadId: string; cliente: string; rotulo: string; valor: number; vencimento: string; dias: number; lida: boolean }> =
    central.servidorOk
      ? central.lista.map((n) => ({ ...n, dias: diasAte(n.vencimento), lida: !!n.lida }))
      : alertasCobranca(leads).map((c) => ({ ...c, id: c.chave, vencimento: c.vencimento as string, lida: false }));
  const naoLidas = cobrancas.filter((c) => !c.lida);
  const [conversas] = useConversas();
  const linkLead = (id: string) => (conversas.some((cv) => cv.leadId === id) ? `/conversas?lead=${id}` : `/crm?lead=${id}`);
  // Tarefas vencidas ou com prazo próximo (calculado aqui, sem push)
  const [projetos] = useProjetos();
  const [prefs] = usePreferencias();
  const tarefasAlerta = alertasTarefas(projetos, undefined, diasPrazoProximo(prefs));
  const temAvisos = contatosHoje.length > 0 || resumo.metaDiaria != null || cobrancas.length > 0 || tarefasAlerta.length > 0;

  const alternar = (m: Menu) => setAberto((a) => (a === m ? null : m));
  const tam = compacto ? 24 : 26;

  const botao = (m: Menu, rotulo: string, icone: ReactNode, extra?: ReactNode) => (
    <button
      type="button"
      className={s.btnRedondo}
      aria-label={rotulo}
      aria-expanded={aberto === m}
      aria-haspopup="dialog"
      onClick={() => alternar(m)}
    >
      {icone}
      {extra}
    </button>
  );

  return (
    <div className={s.topoAcoes} ref={caixa}>
      <div className={s.ancora}>
        {botao('agenda', 'Agenda', <Calendar size={tam} {...ICONE} />)}
        {aberto === 'agenda' && (
          <div className={s.menuFlutuante} role="dialog" aria-label="Agenda de hoje">
            <h3>Agenda de hoje</h3>
            <ul className={s.menuLista}>
              {agendaHoje.map((a) => (
                <li key={a.hora}>
                  <span className={s.menuHora}>{a.hora}</span>
                  <span>
                    <strong>{a.titulo}</strong>
                    <small>{a.detalhe}</small>
                  </span>
                </li>
              ))}
            </ul>
            {contatosHoje.length > 0 && (
              <>
                <h4>Retornos marcados para hoje</h4>
                <ul className={s.menuLista}>
                  {contatosHoje.map((l) => (
                    <li key={l.id}>
                      <Link href={`/crm?lead=${l.id}`} className={s.menuLink} onClick={() => setAberto(null)}>
                        <Users size={16} {...ICONE} /> {l.empresa}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className={s.menuNota}>Os compromissos são de exemplo; a agenda completa entra junto com o banco de dados.</p>
          </div>
        )}
      </div>

      <div className={s.ancora}>
        {botao('ajuda', 'Ajuda', <CircleHelp size={tam} {...ICONE} />)}
        {aberto === 'ajuda' && (
          <div className={s.menuFlutuante} role="dialog" aria-label="Ajuda">
            <h3>Atalhos</h3>
            <ul className={s.menuLista}>
              <li>
                <kbd className={s.tecla}>Ctrl</kbd> + <kbd className={s.tecla}>K</kbd> Buscar em todo o sistema
              </li>
              <li>
                <kbd className={s.tecla}>Esc</kbd> Fechar janelas e menus
              </li>
              <li>Arraste os cartões do CRM e do Kanban para mudar de fase.</li>
            </ul>
            <h4>Onde ficam os dados</h4>
            <p className={s.menuNota}>
              Por enquanto, tudo é salvo neste navegador. Em outro computador ou navegador, os dados não aparecem.
            </p>
          </div>
        )}
      </div>

      <div className={s.ancora}>
        {botao(
          'avisos',
          'Notificações',
          <Bell size={tam} {...ICONE} />,
          naoLidas.length ? (
            <span className={s.contadorAviso} aria-label={`${naoLidas.length} notificação(ões) de cobrança não lida(s)`}>
              {naoLidas.length}
            </span>
          ) : temAvisos ? (
            <span className={s.pontoAviso} aria-hidden />
          ) : null
        )}
        {aberto === 'avisos' && (
          <div className={s.menuFlutuante} role="dialog" aria-label="Notificações">
            <h3>Notificações</h3>
            {cobrancas.length > 0 && (
              <>
                <div className={s.tituloLinha}>
                  <h4>Cobranças</h4>
                  {central.servidorOk && naoLidas.length > 0 && (
                    <button type="button" className={s.linkPequeno} onClick={() => central.marcarLidas(naoLidas.map((c) => c.id))}>
                      Marcar como lidas
                    </button>
                  )}
                </div>
                <ul className={s.menuLista}>
                  {cobrancas.slice(0, 8).map((c) => (
                    <li key={c.id} className={c.lida ? s.lida : undefined}>
                      <Link
                        href={linkLead(c.leadId)}
                        className={s.menuLink}
                        onClick={() => {
                          if (central.servidorOk && !c.lida) central.marcarLidas([c.id]);
                          setAberto(null);
                        }}
                      >
                        {c.dias < 0 ? <CircleAlert size={16} className={s.iconeAlerta} /> : <CalendarClock size={16} {...ICONE} />}
                        <span>
                          <strong>
                            {c.cliente} · {c.rotulo}
                          </strong>
                          <small>
                            {dinheiroFin(c.valor)} · vencimento {dataBr(c.vencimento)} · {textoDias(c.dias)}
                          </small>
                        </span>
                        {!c.lida && central.servidorOk && <span className={s.naoLida} aria-label="não lida" />}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/recebimentos" className={s.verTodos} onClick={() => setAberto(null)}>
                  Ver todos os recebimentos
                </Link>
                <h4>Outros avisos</h4>
              </>
            )}
            {tarefasAlerta.length > 0 && (
              <>
                <h4>Tarefas de projetos</h4>
                <ul className={s.menuLista}>
                  {tarefasAlerta.slice(0, 6).map((a) => (
                    <li key={a.tarefaId}>
                      <Link
                        href={`/kanban?projeto=${encodeURIComponent(a.projetoId)}&aba=tarefas`}
                        className={s.menuLink}
                        onClick={() => {
                          pedirAberturaProjeto(a.projetoId, 'tarefas');
                          setAberto(null);
                        }}
                      >
                        {a.dias < 0 ? <CircleAlert size={16} className={s.iconeAlerta} /> : <CheckSquare size={16} {...ICONE} />}
                        <span>
                          <strong>{a.titulo}</strong>
                          <small>
                            {a.cliente} · {a.projeto} · {textoPrazoTarefa(a.dias)}
                            {a.responsavel ? ` · ${a.responsavel}` : ''}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {tarefasAlerta.length > 6 && <p className={s.menuNota}>E mais {tarefasAlerta.length - 6} tarefa(s) no Kanban.</p>}
              </>
            )}
            <ul className={s.menuLista}>
              {resumo.metaDiaria != null && (
                <li>
                  <Link href="/metas" className={s.menuLink} onClick={() => setAberto(null)}>
                    <Target size={16} {...ICONE} />
                    <span>
                      <strong>Meta de hoje: {reaisCentavos(resumo.metaDiaria)}</strong>
                      <small>Realizado hoje: {reais(resumo.realizadoHoje)}</small>
                    </span>
                  </Link>
                </li>
              )}
              {contatosHoje.map((l) => (
                <li key={l.id}>
                  <Link href={`/crm?lead=${l.id}`} className={s.menuLink} onClick={() => setAberto(null)}>
                    <Users size={16} {...ICONE} />
                    <span>
                      <strong>Retornar {l.empresa}</strong>
                      <small>Contato marcado para hoje</small>
                    </span>
                  </Link>
                </li>
              ))}
              {!temAvisos && <li>Nenhuma notificação.</li>}
            </ul>
          </div>
        )}
      </div>

      {compacto && (
        <div className={s.ancora}>
          <button
            type="button"
            className={s.perfil}
            aria-label="Perfil"
            aria-expanded={aberto === 'perfil'}
            aria-haspopup="dialog"
            onClick={() => alternar('perfil')}
          >
            <span className={s.avatarPerfil}>{iniciais}</span>
            <ChevronDown size={18} strokeWidth={2} />
          </button>
          {aberto === 'perfil' && (
            <div className={s.menuFlutuante} role="dialog" aria-label="Perfil">
              <h3>{perfil.nome?.trim() || usuario.nome}</h3>
              <p className={s.menuNota}>Nexa Lab</p>
              <Link href="/configuracoes" className={s.menuLink} onClick={() => setAberto(null)}>
                <Settings size={16} {...ICONE} /> Configurações
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
