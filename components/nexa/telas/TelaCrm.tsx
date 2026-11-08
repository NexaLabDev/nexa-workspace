'use client';

// ============================================
// ABA CRM — "CRM de Leads"
// ============================================
// Funil com arrastar e soltar. Levar um lead para "Venda ganha" registra a
// venda e atualiza a Meta Mensal. Clicar num cartão abre a ficha do lead.
// Dados salvos neste navegador (ver store.ts).
// ============================================

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  Building2,
  CalendarDays,
  ChartColumn,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  Columns3,
  Filter,
  LayoutDashboard,
  List,
  Plus,
  Search,
  Target,
  Trophy,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import NexaShell from '../NexaShell';
import Modal from '../Modal';
import FichaLead from './FichaLead';
import u from '../ui.module.css';
import c from './crm.module.css';
import {
  ETAPA_GANHO,
  ETAPA_PERDIDO,
  etapasLead,
  iniciaisUsuario,
  mesChave,
  ORIGENS_LEAD,
  type Lead,
} from '../dados-exemplo';
import {
  aplicarEtapaLead,
  nomeEtapaLead,
  projetosAposMudanca,
  useConversas,
  useDiasTrabalho,
  useLeads,
  useMetas,
  useProjetos,
  useVendas,
} from '../dados';
import { calcularResumoMeta } from '../metas';
import { iniciais, reais, useParametro } from '../util';

type AbaCrm = 'funil' | 'lista' | 'automacao' | 'relatorios';

const ABAS: Array<{ id: AbaCrm; nome: string; icone: LucideIcon }> = [
  { id: 'funil', nome: 'Funil de Vendas', icone: Filter },
  { id: 'lista', nome: 'Lista de Leads', icone: List },
  { id: 'automacao', nome: 'Automação', icone: Workflow },
  { id: 'relatorios', nome: 'Relatórios', icone: ChartColumn },
];

const ICONE = { strokeWidth: 1.7 } as const;
const NAO_INFORMADO = '__nao-informado__';

function valorTexto(v: number | null): string {
  return v == null ? 'R$ –' : reais(v);
}

export default function TelaCrm() {
  const [leads, setLeads] = useLeads();
  const [vendas, setVendas] = useVendas();
  const [metas] = useMetas();
  const [regra] = useDiasTrabalho();
  const [projetos, setProjetos] = useProjetos();
  const [conversas] = useConversas();
  const [aba, setAba] = useState<AbaCrm>('funil');
  const [busca, setBusca] = useState('');
  const [responsavel, setResponsavel] = useState('todos');
  const [origem, setOrigem] = useState('todas');
  const [novaEtapa, setNovaEtapa] = useState<string | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [pedirValor, setPedirValor] = useState<{ id: string; posicao: number } | null>(null);
  const leadUrl = useParametro('lead');

  useEffect(() => {
    if (leadUrl) setFichaId(leadUrl);
  }, [leadUrl]);

  const responsaveis = useMemo(
    () => Array.from(new Set(leads.map((l) => l.responsavel?.trim()).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const temSemResponsavel = leads.some((l) => !l.responsavel?.trim());
  const temSemOrigem = leads.some((l) => !l.origem);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (termo && !l.empresa.toLowerCase().includes(termo) && !l.descricao.toLowerCase().includes(termo)) return false;
      if (responsavel === NAO_INFORMADO && l.responsavel?.trim()) return false;
      if (responsavel !== 'todos' && responsavel !== NAO_INFORMADO && l.responsavel?.trim() !== responsavel) return false;
      if (origem === NAO_INFORMADO && l.origem) return false;
      if (origem !== 'todas' && origem !== NAO_INFORMADO && l.origem !== origem) return false;
      return true;
    });
  }, [leads, busca, responsavel, origem]);

  const filtrando = !!busca.trim() || responsavel !== 'todos' || origem !== 'todas';

  // Números do topo
  const ativos = leads.filter((l) => l.etapa !== ETAPA_GANHO && l.etapa !== ETAPA_PERDIDO);
  const ocultosTotal = etapasLead.reduce((s, e) => s + e.ocultos, 0);
  const emNegociacao = ativos.reduce((s, l) => s + (l.valor ?? 0), 0);
  const resumo = calcularResumoMeta(mesChave(new Date()), vendas, metas, regra);

  /** Move o lead (e mantém as vendas da meta em sincronia). */
  const mover = (id: string, etapa: string, posicao?: number, extras: Partial<Lead> = {}) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const r = aplicarEtapaLead(lead, etapa, vendas, extras);
    setLeads((lista) => {
      const sem = lista.filter((l) => l.id !== id);
      if (posicao == null) return [...sem, r.lead];
      const daEtapa = sem.filter((l) => l.etapa === etapa);
      const ancora = daEtapa[posicao];
      const idx = ancora ? sem.indexOf(ancora) : daEtapa.length ? sem.indexOf(daEtapa[daEtapa.length - 1]) + 1 : sem.length;
      return [...sem.slice(0, idx), r.lead, ...sem.slice(idx)];
    });
    if (r.vendas !== vendas) setVendas(r.vendas);
    // Venda ganha: nasce o cartão no Kanban com tudo da conversa
    const novos = projetosAposMudanca(lead, r.lead, projetos, conversas);
    if (novos !== projetos) setProjetos(novos);
  };

  const aoSoltar = (r: DropResult) => {
    if (!r.destination) return;
    const { droppableId: etapa, index } = r.destination;
    if (etapa === r.source.droppableId && index === r.source.index) return;
    const lead = leads.find((l) => l.id === r.draggableId);
    if (etapa === ETAPA_GANHO && lead && lead.etapa !== ETAPA_GANHO && lead.valor == null) {
      setPedirValor({ id: lead.id, posicao: index }); // venda sem valor: pergunta antes
      return;
    }
    mover(r.draggableId, etapa, index);
  };

  const atualizarLead = (id: string, mudancas: Partial<Lead>) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    if (mudancas.etapa && mudancas.etapa !== lead.etapa) {
      const { etapa, ...resto } = mudancas;
      mover(id, etapa, undefined, resto);
      return;
    }
    if (lead.etapa === ETAPA_GANHO && mudancas.valor !== undefined && mudancas.valor !== lead.valor) {
      const r = aplicarEtapaLead(lead, ETAPA_GANHO, vendas, mudancas);
      setVendas(r.vendas);
    }
    setLeads((lista) => lista.map((l) => (l.id === id ? { ...l, ...mudancas } : l)));
  };

  const excluirLead = (id: string) => {
    setLeads((lista) => lista.filter((l) => l.id !== id));
    setVendas((lista) => lista.filter((v) => v.leadId !== id));
    setFichaId(null);
  };

  const leadFicha = fichaId ? leads.find((l) => l.id === fichaId) ?? null : null;
  const leadValor = pedirValor ? leads.find((l) => l.id === pedirValor.id) ?? null : null;

  return (
    <NexaShell
      aba="crm"
      buscaTexto="Buscar leads, negócios ou contatos..."
      botaoNovo={{ texto: 'Novo Lead', onClick: () => setNovaEtapa(etapasLead[0].id) }}
      topoCompacto={{ iniciais: iniciaisUsuario }}
    >
      <div className={c.pagina}>
        {/* ----- Cabeçalho ----- */}
        <div className={c.cabecalho}>
          <span className={c.iconeTitulo} aria-hidden>
            <Users size={36} strokeWidth={1.8} />
          </span>
          <div className={c.titulo}>
            <h1>CRM de Leads</h1>
            <p>Gerencie seus leads e acompanhe cada negociação.</p>
          </div>
          <div className={c.numeros}>
            <div className={c.numero}>
              <Users size={36} {...ICONE} />
              <div>
                <strong>{ativos.length + ocultosTotal}</strong>
                <span>Leads ativos</span>
              </div>
            </div>
            <div className={c.numero}>
              <ChartColumnIncreasing size={36} {...ICONE} />
              <div>
                <strong>{reais(emNegociacao)}</strong>
                <span>Em negociação</span>
              </div>
            </div>
            <Link href="/metas" className={`${c.numero} ${c.numeroLink}`}>
              <Target size={36} {...ICONE} />
              <div>
                <strong>{resumo.meta == null ? '—' : `${resumo.percentual}%`}</strong>
                <span>Meta do mês</span>
              </div>
            </Link>
          </div>
        </div>

        {/* ----- Abas ----- */}
        <nav className={c.abas} role="tablist" aria-label="Seções do CRM">
          {ABAS.map(({ id, nome, icone: Icone }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              className={`${c.aba} ${aba === id ? c.abaAtiva : ''}`}
              onClick={() => setAba(id)}
            >
              <Icone size={20} {...ICONE} /> {nome}
            </button>
          ))}
        </nav>

        {(aba === 'funil' || aba === 'lista') && (
          <>
            {/* ----- Filtros ----- */}
            <div className={c.filtros}>
              <label className={c.seletor}>
                <span>Funil:</span>
                <select aria-label="Funil" defaultValue="comercial">
                  <option value="comercial">Comercial</option>
                </select>
                <ChevronDown size={18} strokeWidth={2} aria-hidden />
              </label>
              <label className={c.seletor}>
                <span>Responsável:</span>
                <select aria-label="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                  <option value="todos">Todos</option>
                  {responsaveis.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  {temSemResponsavel && <option value={NAO_INFORMADO}>Sem responsável</option>}
                </select>
                <ChevronDown size={18} strokeWidth={2} aria-hidden />
              </label>
              <label className={c.seletor}>
                <span>Origem:</span>
                <select aria-label="Origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                  <option value="todas">Todas</option>
                  {ORIGENS_LEAD.filter((o) => leads.some((l) => l.origem === o)).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  {temSemOrigem && <option value={NAO_INFORMADO}>Não informada</option>}
                </select>
                <ChevronDown size={18} strokeWidth={2} aria-hidden />
              </label>
              <label className={c.buscaFunil}>
                <Search size={20} strokeWidth={1.8} aria-hidden />
                <input
                  type="search"
                  placeholder="Buscar no funil..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar no funil"
                />
              </label>
              <div className={c.visoes} role="group" aria-label="Modo de exibição">
                <button
                  type="button"
                  className={`${c.visao} ${aba === 'funil' ? c.visaoAtiva : ''}`}
                  onClick={() => setAba('funil')}
                  aria-pressed={aba === 'funil'}
                  aria-label="Ver em colunas"
                >
                  <Columns3 size={20} {...ICONE} />
                </button>
                <button
                  type="button"
                  className={`${c.visao} ${aba === 'lista' ? c.visaoAtiva : ''}`}
                  onClick={() => setAba('lista')}
                  aria-pressed={aba === 'lista'}
                  aria-label="Ver em lista"
                >
                  <LayoutDashboard size={20} {...ICONE} />
                </button>
              </div>
            </div>

            {aba === 'funil' ? (
              <DragDropContext onDragEnd={aoSoltar}>
                <div className={c.quadro}>
                  {etapasLead.map((etapa) => {
                    const daEtapa = visiveis.filter((l) => l.etapa === etapa.id);
                    const total = daEtapa.reduce((s, l) => s + (l.valor ?? 0), 0);
                    const qtd = daEtapa.length + (filtrando ? 0 : etapa.ocultos);
                    const final = etapa.id === 'fechamento';
                    const ganho = etapa.id === ETAPA_GANHO;
                    return (
                      <section
                        key={etapa.id}
                        className={`${c.coluna} ${final ? c.colunaFinal : ''} ${ganho ? c.colunaGanho : ''}`}
                        aria-label={etapa.nome}
                      >
                        <header className={c.colunaTopo}>
                          <h3>
                            {ganho && <Trophy size={17} strokeWidth={2} className={c.trofeu} aria-hidden />}
                            {etapa.nome} <span>({qtd})</span>
                          </h3>
                          <button
                            type="button"
                            className={c.colunaMais}
                            onClick={() => setNovaEtapa(etapa.id)}
                            aria-label={`Adicionar lead em ${etapa.nome}`}
                          >
                            <Plus size={22} strokeWidth={1.8} />
                          </button>
                          <strong className={c.colunaValor}>{reais(total)}</strong>
                        </header>

                        <Droppable droppableId={etapa.id}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.droppableProps}
                              className={`${c.lista} ${snap.isDraggingOver ? c.listaAlvo : ''}`}
                            >
                              {daEtapa.map((lead, index) => (
                                <Draggable key={lead.id} draggableId={lead.id} index={index}>
                                  {(p, s) => (
                                    <article
                                      ref={p.innerRef}
                                      {...p.draggableProps}
                                      {...p.dragHandleProps}
                                      className={`${c.cartao} ${s.isDragging ? c.cartaoArrastando : ''}`}
                                      onClick={() => setFichaId(lead.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') setFichaId(lead.id);
                                      }}
                                      aria-label={`${lead.empresa}. Enter abre a ficha; espaço para arrastar.`}
                                    >
                                      <span className={c.avatar} style={{ background: lead.cor }}>
                                        {lead.sigla ?? iniciais(lead.empresa)}
                                      </span>
                                      <div className={c.cartaoTexto}>
                                        <strong>
                                          {lead.empresaPJ && <Building2 size={15} strokeWidth={1.8} aria-label="Empresa" />}
                                          {lead.empresa}
                                        </strong>
                                        <span>{lead.descricao}</span>
                                      </div>
                                      <div className={c.cartaoRodape}>
                                        <b>{valorTexto(lead.valor)}</b>
                                        {lead.contrato ? (
                                          <span className={c.seloContrato}>
                                            <Check size={14} strokeWidth={2.4} /> Contrato
                                          </span>
                                        ) : lead.data ? (
                                          <span className={c.data}>
                                            <CalendarDays size={16} strokeWidth={1.7} /> {lead.data}
                                          </span>
                                        ) : null}
                                      </div>
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {prov.placeholder}
                            </div>
                          )}
                        </Droppable>

                        <button type="button" className={c.adicionar} onClick={() => setNovaEtapa(etapa.id)}>
                          <Plus size={20} strokeWidth={1.8} /> Adicionar lead
                        </button>
                      </section>
                    );
                  })}
                </div>
              </DragDropContext>
            ) : (
              <section className={`${u.painel} ${c.painelLista}`}>
                <div className={u.tabelaCaixa}>
                  <table className={u.tabela}>
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Etapa</th>
                        <th>Valor</th>
                        <th>Origem</th>
                        <th>Próximo contato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <tr key={l.id} className={c.linhaClicavel} onClick={() => setFichaId(l.id)}>
                          <td>
                            <div className={u.entidade}>
                              <span className={u.avatar} style={{ background: l.cor }}>
                                {l.sigla ?? iniciais(l.empresa)}
                              </span>
                              <div>
                                <strong>{l.empresa}</strong>
                                <span>{l.descricao}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${u.status} ${
                                l.etapa === ETAPA_GANHO ? u.stLima : l.etapa === ETAPA_PERDIDO ? u.stLaranja : u.stCinza
                              }`}
                            >
                              {nomeEtapaLead(l.etapa)}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{valorTexto(l.valor)}</td>
                          <td style={{ color: '#d6d6d6' }}>{l.origem ?? '—'}</td>
                          <td style={{ color: '#d6d6d6', whiteSpace: 'nowrap' }}>
                            {l.etapa === ETAPA_PERDIDO ? `Perdido: ${l.motivoPerda ?? ''}` : l.contrato ? 'Contrato fechado' : l.data ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visiveis.length === 0 && <p className={u.vazio}>Nenhum lead encontrado.</p>}
                </div>
              </section>
            )}
          </>
        )}

        {(aba === 'automacao' || aba === 'relatorios') && (
          <section className={`${u.painel} ${c.painelVazio}`}>
            {aba === 'automacao' ? <Workflow size={40} {...ICONE} /> : <ChartColumn size={40} {...ICONE} />}
            <h2>{aba === 'automacao' ? 'Automação' : 'Relatórios'}</h2>
            <p>
              {aba === 'automacao'
                ? 'As regras de automação do funil ainda não foram definidas [A DEFINIR].'
                : 'Os relatórios do CRM ainda não foram definidos [A DEFINIR].'}
            </p>
          </section>
        )}
      </div>

      {novaEtapa && (
        <ModalLead
          etapaInicial={novaEtapa}
          onFechar={() => setNovaEtapa(null)}
          onSalvar={(l) => {
            if (l.etapa === ETAPA_GANHO) {
              // criado já como venda ganha: registra a venda também
              const r = aplicarEtapaLead({ ...l, etapa: 'novo' }, ETAPA_GANHO, vendas);
              setLeads((lista) => [...lista, { ...r.lead, historico: [] }]);
              setVendas(r.vendas);
              setProjetos(projetosAposMudanca({ ...l, etapa: 'novo' }, r.lead, projetos, conversas));
            } else {
              setLeads((lista) => [...lista, l]);
            }
            setNovaEtapa(null);
            setAba('funil');
          }}
        />
      )}

      {leadValor && pedirValor && (
        <ModalValorVenda
          lead={leadValor}
          onFechar={() => setPedirValor(null)}
          onConfirmar={(valor) => {
            mover(leadValor.id, ETAPA_GANHO, pedirValor.posicao, { valor });
            setPedirValor(null);
          }}
        />
      )}

      {leadFicha && (
        <FichaLead
          lead={leadFicha}
          onFechar={() => setFichaId(null)}
          onAtualizar={(mudancas) => atualizarLead(leadFicha.id, mudancas)}
          onExcluir={() => excluirLead(leadFicha.id)}
          onPedirValor={() => setPedirValor({ id: leadFicha.id, posicao: 0 })}
        />
      )}
    </NexaShell>
  );
}

function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

function ModalValorVenda({
  lead,
  onFechar,
  onConfirmar,
}: {
  lead: Lead;
  onFechar: () => void;
  onConfirmar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState('');
  const valor = lerValor(texto);
  const valido = valor != null && !Number.isNaN(valor) && valor > 0;
  return (
    <Modal
      titulo="Valor da venda"
      descricao={`${lead.empresa} ainda não tem valor. Informe quanto foi fechado para entrar na meta do mês.`}
      onFechar={onFechar}
      textoEnviar="Registrar venda ganha"
      podeEnviar={valido}
      onEnviar={() => valido && onConfirmar(valor as number)}
    >
      <label className={u.campo}>
        <span>Valor fechado (R$) *</span>
        <input
          className={u.entrada}
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 4.500"
          autoFocus
        />
      </label>
    </Modal>
  );
}

function ModalLead({
  etapaInicial,
  onFechar,
  onSalvar,
}: {
  etapaInicial: string;
  onFechar: () => void;
  onSalvar: (l: Lead) => void;
}) {
  const [empresa, setEmpresa] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [origem, setOrigem] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [etapa, setEtapa] = useState(etapaInicial);
  const numero = lerValor(valor);
  const valorOk = numero == null || !Number.isNaN(numero);
  const precisaValor = etapa === ETAPA_GANHO && (numero == null || Number.isNaN(numero) || numero <= 0);

  return (
    <Modal
      titulo="Novo lead"
      descricao="Registre um contato no funil de vendas."
      onFechar={onFechar}
      textoEnviar="Adicionar lead"
      podeEnviar={!!empresa.trim() && valorOk && !precisaValor}
      onEnviar={() =>
        onSalvar({
          id: `l-${Date.now()}`,
          empresa: empresa.trim(),
          descricao: descricao.trim() || '—',
          valor: numero == null || Number.isNaN(numero) ? null : numero,
          data: data.trim() || undefined,
          origem: origem || undefined,
          responsavel: responsavel.trim() || undefined,
          cor: '#777878',
          etapa,
          historico: [],
          comentarios: [],
        })
      }
    >
      <div className={u.formGrade}>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Empresa ou contato *</span>
          <input className={u.entrada} value={empresa} onChange={(e) => setEmpresa(e.target.value)} required autoFocus />
        </label>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Interesse</span>
          <input
            className={u.entrada}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: CRM + Automação"
          />
        </label>
        <label className={u.campo}>
          <span>Valor (R$){etapa === ETAPA_GANHO ? ' *' : ''}</span>
          <input
            className={u.entrada}
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Deixe vazio se ainda não sabe"
          />
        </label>
        <label className={u.campo}>
          <span>Próximo contato</span>
          <input className={u.entrada} value={data} onChange={(e) => setData(e.target.value)} placeholder="Ex.: Amanhã" />
        </label>
        <label className={u.campo}>
          <span>Origem</span>
          <select className={u.entrada} value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Não informada</option>
            {ORIGENS_LEAD.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className={u.campo}>
          <span>Responsável</span>
          <input className={u.entrada} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: Luiza" />
        </label>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Etapa</span>
          <select className={u.entrada} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            {etapasLead.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}
