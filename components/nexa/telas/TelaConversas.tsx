'use client';

// ============================================
// ABA CONVERSAS — "CRM – Conversas"
// ============================================
// Reproduz o layout aprovado: lista de conversas, chat e painel do lead.
// MODO DEMONSTRAÇÃO: sem a API oficial do WhatsApp/Instagram, as mensagens
// ficam salvas só neste navegador e não chegam ao cliente.
// O painel da direita é o mesmo lead do CRM (etapa, responsável, anotações, tarefas).
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  Download,
  FileText,
  Instagram,
  Paperclip,
  Plus,
  Search,
  Send,
  SendHorizontal,
  Smile,
  Tag,
  UserPlus,
  X,
  ListFilter,
} from 'lucide-react';
import NexaShell from '../NexaShell';
import MenuAcoes from '../MenuAcoes';
import c from './conversas.module.css';
import {
  ETAPA_GANHO,
  iniciaisUsuario,
  respostasRapidas,
  type CanalConversa,
  type Conversa,
  type Lead,
  type MensagemConversa,
} from '../dados-exemplo';
import {
  aplicarEtapaLead,
  projetosAposMudanca,
  useConversas,
  useLeads,
  useProjetos,
  useVendas,
} from '../dados';
import { baixarArquivo, guardarArquivo, tamanhoLegivel } from '../arquivos';
import PainelLead from './PainelLead';
import { iniciais, useParametro } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;
const EMOJIS = ['😊', '👍', '🙏', '👏', '🎉', '✅', '📄', '📅', '💡', '🚀', '😉', '🤝'];

// ---------- Ícones dos canais ----------
function IconeWhatsApp({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path
        transform="translate(7.2 7.2) scale(0.4)"
        strokeWidth={4}
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function IconeCanal({ canal, size = 22 }: { canal: CanalConversa; size?: number }) {
  if (canal === 'whatsapp') return <IconeWhatsApp size={size} />;
  if (canal === 'instagram') return <Instagram size={size} color="#e4405f" strokeWidth={1.9} aria-hidden />;
  return <Send size={size} color="#ffffff" strokeWidth={1.9} aria-hidden />;
}

const NOME_CANAL: Record<CanalConversa, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', telegram: 'Telegram' };

// ---------- Datas ----------
function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return 'Hoje';
  if (mesmoDia(d, ontem)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function rotuloLista(iso: string): string {
  const dia = rotuloDia(iso);
  if (dia === 'Hoje') return horaCurta(iso);
  if (dia === 'Ontem') return 'Ontem';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function ultima(conv: Conversa): MensagemConversa | undefined {
  return conv.mensagens[conv.mensagens.length - 1];
}

type Vista = 'lista' | 'chat' | 'lead';

export default function TelaConversas() {
  const [conversas, setConversas] = useConversas();
  const [leads, setLeads] = useLeads();
  const [vendas, setVendas] = useVendas();
  const [projetos, setProjetos] = useProjetos();
  const [canal, setCanal] = useState<CanalConversa | 'todas'>('todas');
  const [busca, setBusca] = useState('');
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('lista');
  const leadUrl = useParametro('lead');

  const leadDe = (conv: Conversa) => leads.find((l) => l.id === conv.leadId);

  const ordenadas = useMemo(
    () => [...conversas].sort((a, b) => (ultima(b)?.em ?? '').localeCompare(ultima(a)?.em ?? '')),
    [conversas]
  );

  const visiveis = ordenadas.filter((cv) => {
    if (canal !== 'todas' && cv.canal !== canal) return false;
    if (soNaoLidas && cv.naoLidas === 0) return false;
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    const lead = leadDe(cv);
    return (
      (lead?.empresa ?? '').toLowerCase().includes(termo) ||
      cv.mensagens.some((m) => (m.texto ?? m.arquivo?.nome ?? '').toLowerCase().includes(termo))
    );
  });

  // Abre a conversa pedida no endereço (?lead=) ou a mais recente.
  // Depende de `leads`/`conversas`: no primeiro paint o sync remoto ainda pode estar
  // carregando — sem isso caíamos na conversa mais antiga e o ?lead= era ignorado.
  useEffect(() => {
    if (leadUrl) {
      const cv = conversas.find((x) => x.leadId === leadUrl);
      if (cv) {
        setSelecionadaId(cv.id);
        setVista('chat');
        return;
      }
      // Lead sem conversa (ex.: aberto pelo CRM): cria uma conversa vazia para abrir o painel
      if (leads.some((l) => l.id === leadUrl)) {
        const nova: Conversa = { id: `cv-${leadUrl}-${Date.now()}`, leadId: leadUrl, canal: 'whatsapp', naoLidas: 0, mensagens: [] };
        setConversas((l) => (l.some((x) => x.leadId === leadUrl) ? l : [...l, nova]));
        setSelecionadaId(nova.id);
        setVista('lead');
        return;
      }
      // Aguarda o lead chegar do remoto; não seleciona outra conversa no meio-tempo.
      return;
    }
    if (!selecionadaId && ordenadas[0]) setSelecionadaId(ordenadas[0].id);
  }, [leadUrl, leads, conversas]); // eslint-disable-line react-hooks/exhaustive-deps

  const selecionada = conversas.find((x) => x.id === selecionadaId) ?? ordenadas[0] ?? null;
  const lead = selecionada ? leadDe(selecionada) : undefined;

  const abrir = (id: string) => {
    setSelecionadaId(id);
    setVista('chat');
    setConversas((l) => l.map((x) => (x.id === id && x.naoLidas ? { ...x, naoLidas: 0 } : x)));
  };

  const atualizarConversa = (id: string, f: (cv: Conversa) => Conversa) =>
    setConversas((l) => l.map((x) => (x.id === id ? f(x) : x)));

  const enviar = (msg: Omit<MensagemConversa, 'id' | 'em' | 'de'>, de: MensagemConversa['de'] = 'equipe') => {
    if (!selecionada) return;
    atualizarConversa(selecionada.id, (cv) => ({
      ...cv,
      mensagens: [...cv.mensagens, { ...msg, id: `m-${Date.now()}`, de, em: new Date().toISOString() }],
    }));
  };

  const atualizarLead = (mudancas: Partial<Lead>) => {
    if (!lead) return;
    if (mudancas.etapa && mudancas.etapa !== lead.etapa) {
      const r = aplicarEtapaLead(lead, mudancas.etapa, vendas, mudancas);
      setLeads((l) => l.map((x) => (x.id === lead.id ? r.lead : x)));
      if (r.vendas !== vendas) setVendas(r.vendas);
      // Venda ganha: nasce o cartão no Kanban com tudo da conversa
      const novos = projetosAposMudanca(lead, r.lead, projetos, conversas);
      if (novos !== projetos) setProjetos(novos);
      return;
    }
    if (lead.etapa === ETAPA_GANHO && mudancas.valor !== undefined && mudancas.valor !== lead.valor) {
      setVendas(aplicarEtapaLead(lead, ETAPA_GANHO, vendas, mudancas).vendas);
    }
    // Dados para documentos: junta com o que já está salvo (vários campos podem salvar seguidos)
    setLeads((l) =>
      l.map((x) =>
        x.id === lead.id
          ? { ...x, ...mudancas, ...(mudancas.cadastro ? { cadastro: { ...x.cadastro, ...mudancas.cadastro } } : {}) }
          : x
      )
    );
  };

  const contagem = (cn: CanalConversa) => conversas.filter((x) => x.canal === cn).length;

  return (
    <NexaShell
      aba="conversas"
      marcaTitulo="CRM – Conversas"
      buscaTexto="Buscar lead, cliente, projeto ou proposta..."
      topoCompacto={{ iniciais: iniciaisUsuario }}
    >
      <div className={`${c.pagina} ${c['vista-' + vista]}`}>
        {/* ===== Lista ===== */}
        <aside className={`${c.coluna} ${c.lista}`} aria-label="Conversas">
          <div className={c.canais} role="tablist" aria-label="Canal">
            <button
              type="button"
              role="tab"
              aria-selected={canal === 'todas'}
              className={`${c.canal} ${canal === 'todas' ? c.canalAtivo : ''}`}
              onClick={() => setCanal('todas')}
            >
              Todas <span className={c.contador}>{conversas.length}</span>
            </button>
            {(['whatsapp', 'instagram', 'telegram'] as CanalConversa[]).map((cn) => (
              <button
                key={cn}
                type="button"
                role="tab"
                aria-selected={canal === cn}
                aria-label={NOME_CANAL[cn]}
                className={`${c.canal} ${canal === cn ? c.canalAtivo : ''}`}
                onClick={() => setCanal(cn)}
              >
                <IconeCanal canal={cn} size={21} /> <span className={c.contador}>{contagem(cn)}</span>
              </button>
            ))}
          </div>

          <div className={c.buscaLinha}>
            <label className={c.busca}>
              <Search size={19} strokeWidth={1.8} aria-hidden />
              <input
                type="search"
                placeholder="Buscar conversas..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar conversas"
              />
            </label>
            <button
              type="button"
              className={`${c.filtro} ${soNaoLidas ? c.filtroAtivo : ''}`}
              onClick={() => setSoNaoLidas((v) => !v)}
              aria-pressed={soNaoLidas}
              aria-label="Mostrar só não lidas"
              title="Só não lidas"
            >
              <ListFilter size={20} strokeWidth={1.8} />
            </button>
          </div>

          <ul className={c.itens}>
            {visiveis.map((cv) => {
              const ld = leadDe(cv);
              // Com mensagens não lidas, a prévia mostra a última mensagem do cliente
              const doCliente = [...cv.mensagens].reverse().find((m) => m.de === 'cliente');
              const msg = cv.naoLidas > 0 && doCliente ? doCliente : ultima(cv);
              const quando = ultima(cv);
              const ativa = selecionada?.id === cv.id;
              return (
                <li key={cv.id}>
                  <button
                    type="button"
                    className={`${c.item} ${ativa ? c.itemAtivo : ''}`}
                    onClick={() => abrir(cv.id)}
                    aria-current={ativa ? 'true' : undefined}
                  >
                    <span className={c.avatar} style={{ background: ld?.cor ?? '#777' }}>
                      {ld ? ld.sigla ?? iniciais(ld.empresa) : '?'}
                      <span className={c.avatarCanal}>
                        <IconeCanal canal={cv.canal} size={13} />
                      </span>
                    </span>
                    <span className={c.itemTexto}>
                      <span className={c.itemTopo}>
                        <strong>{ld?.empresa ?? 'Contato'}</strong>
                        <small>{quando ? rotuloLista(quando.em) : ''}</small>
                      </span>
                      <span className={c.itemBaixo}>
                        <span className={c.previa}>
                          {msg?.de === 'equipe' ? 'Você: ' : ''}
                          {msg?.texto ?? (msg?.arquivo ? `📎 ${msg.arquivo.nome}` : '')}
                        </span>
                        {cv.naoLidas > 0 && <span className={c.naoLidas}>{cv.naoLidas}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {visiveis.length === 0 && <li className={c.vazio}>Nenhuma conversa encontrada.</li>}
          </ul>
        </aside>

        {/* ===== Chat ===== */}
        {selecionada && lead ? (
          <Chat
            conversa={selecionada}
            lead={lead}
            onVoltar={() => setVista('lista')}
            onVerLead={() => setVista('lead')}
            onEnviar={enviar}
            onAtualizarLead={atualizarLead}
            onNaoLida={() => {
              atualizarConversa(selecionada.id, (cv) => ({ ...cv, naoLidas: Math.max(1, cv.naoLidas) }));
              setVista('lista');
            }}
            onExcluir={() => {
              if (!window.confirm(`Excluir a conversa com ${lead.empresa}? O lead continua no CRM.`)) return;
              setConversas((l) => l.filter((x) => x.id !== selecionada.id));
              setSelecionadaId(null);
              setVista('lista');
            }}
          />
        ) : (
          <section className={`${c.coluna} ${c.chat} ${c.chatVazio}`}>
            <p>Selecione uma conversa.</p>
          </section>
        )}

        {/* ===== Painel do lead ===== */}
        {selecionada && lead && (
          <PainelLead
            lead={lead}
            conversa={selecionada}
            projetoCriado={projetos.some((p) => p.leadId === lead.id)}
            onAtualizar={atualizarLead}
            onVoltar={() => setVista('chat')}
            onEnviarMensagem={(texto) => enviar({ texto })}
          />
        )}
      </div>
    </NexaShell>
  );
}

// =====================================================================
function Chat({
  conversa,
  lead,
  onVoltar,
  onVerLead,
  onEnviar,
  onAtualizarLead,
  onNaoLida,
  onExcluir,
}: {
  conversa: Conversa;
  lead: Lead;
  onVoltar: () => void;
  onVerLead: () => void;
  onEnviar: (msg: Omit<MensagemConversa, 'id' | 'em' | 'de'>, de?: MensagemConversa['de']) => void;
  onAtualizarLead: (m: Partial<Lead>) => void;
  onNaoLida: () => void;
  onExcluir: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [painel, setPainel] = useState<'emoji' | 'rapidas' | 'etiquetas' | 'responsavel' | null>(null);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const [responsavel, setResponsavel] = useState(lead.responsavel ?? '');
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [remetente, setRemetente] = useState<MensagemConversa['de']>('equipe');
  const [erroArquivo, setErroArquivo] = useState('');

  const escolherArquivo = (de: MensagemConversa['de']) => {
    setRemetente(de);
    setErroArquivo('');
    arquivo.current?.click();
  };
  const caixaPaineis = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [conversa.id, conversa.mensagens.length]);

  useEffect(() => {
    setResponsavel(lead.responsavel ?? '');
    setPainel(null);
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!painel) return;
    const fora = (e: MouseEvent) => {
      if (caixaPaineis.current && !(e.target as HTMLElement).closest('[data-painel-chat]')) setPainel(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPainel(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [painel]);

  const mandar = () => {
    if (!texto.trim()) return;
    onEnviar({ texto: texto.trim() });
    setTexto('');
    campo.current?.focus();
  };

  // Agrupa por dia
  const grupos: Array<{ dia: string; msgs: MensagemConversa[] }> = [];
  conversa.mensagens.forEach((m) => {
    const dia = rotuloDia(m.em);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.msgs.push(m);
    else grupos.push({ dia, msgs: [m] });
  });

  const etiquetas = lead.etiquetas ?? [];

  return (
    <section className={`${c.coluna} ${c.chat}`} aria-label={`Conversa com ${lead.empresa}`} ref={caixaPaineis}>
      <header className={c.chatTopo}>
        <button type="button" className={`${c.iconeBtn} ${c.soCelular}`} onClick={onVoltar} aria-label="Voltar para a lista">
          <ArrowLeft size={20} />
        </button>
        <button type="button" className={c.chatQuem} onClick={onVerLead} aria-label={`Ver dados de ${lead.empresa}`}>
          <span className={c.avatarGrande} style={{ background: lead.cor }}>
            {lead.sigla ?? iniciais(lead.empresa)}
          </span>
          <span>
            <strong>{lead.empresa}</strong>
            <small>
              {conversa.online ? (
                <>
                  <i className={c.pontoOnline} /> Online
                </>
              ) : (
                NOME_CANAL[conversa.canal]
              )}
            </small>
          </span>
        </button>
        <div className={c.chatAcoes}>
          {etiquetas.length > 0 && (
            <span className={c.etiquetasTopo}>
              {etiquetas.slice(0, 2).map((e) => (
                <span key={e} className={c.etiqueta}>
                  {e}
                </span>
              ))}
            </span>
          )}
          <div className={c.ancora} data-painel-chat>
            <button
              type="button"
              className={c.iconeRedondo}
              aria-label="Etiquetas"
              aria-expanded={painel === 'etiquetas'}
              onClick={() => setPainel((p) => (p === 'etiquetas' ? null : 'etiquetas'))}
            >
              <Tag size={22} {...ICONE} />
            </button>
            {painel === 'etiquetas' && (
              <div className={c.popover} role="dialog" aria-label="Etiquetas">
                <strong>Etiquetas</strong>
                <div className={c.etiquetasLista}>
                  {etiquetas.map((e) => (
                    <span key={e} className={c.etiqueta}>
                      {e}
                      <button
                        type="button"
                        aria-label={`Remover etiqueta ${e}`}
                        onClick={() => onAtualizarLead({ etiquetas: etiquetas.filter((x) => x !== e) })}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {etiquetas.length === 0 && <small>Nenhuma etiqueta.</small>}
                </div>
                <form
                  className={c.popoverForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const t = novaEtiqueta.trim();
                    if (t && !etiquetas.includes(t)) onAtualizarLead({ etiquetas: [...etiquetas, t] });
                    setNovaEtiqueta('');
                  }}
                >
                  <input value={novaEtiqueta} onChange={(e) => setNovaEtiqueta(e.target.value)} placeholder="Ex.: Urgente" aria-label="Nova etiqueta" />
                  <button type="submit">Adicionar</button>
                </form>
              </div>
            )}
          </div>
          <div className={c.ancora} data-painel-chat>
            <button
              type="button"
              className={c.iconeRedondo}
              aria-label="Responsável"
              aria-expanded={painel === 'responsavel'}
              onClick={() => setPainel((p) => (p === 'responsavel' ? null : 'responsavel'))}
            >
              <UserPlus size={22} {...ICONE} />
            </button>
            {painel === 'responsavel' && (
              <div className={c.popover} role="dialog" aria-label="Responsável">
                <strong>Responsável pela conversa</strong>
                <form
                  className={c.popoverForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    onAtualizarLead({ responsavel: responsavel.trim() || undefined });
                    setPainel(null);
                  }}
                >
                  <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" aria-label="Responsável" autoFocus />
                  <button type="submit">Salvar</button>
                </form>
              </div>
            )}
          </div>
          <MenuAcoes
            rotulo="Mais ações"
            acoes={[
              { tipo: 'link', rotulo: 'Abrir ficha no CRM', href: `/crm?lead=${lead.id}` },
              { tipo: 'botao', rotulo: 'Marcar como não lida', onClick: onNaoLida },
              { tipo: 'botao', rotulo: 'Excluir conversa', onClick: onExcluir, perigo: true },
            ]}
          />
        </div>
      </header>

      <div className={c.mensagens} aria-live="polite">
        {grupos.map((g) => (
          <div key={g.dia} className={c.grupo}>
            <span className={c.dia}>{g.dia}</span>
            {g.msgs.map((m) => (
              <div key={m.id} className={`${c.msg} ${m.de === 'equipe' ? c.msgEquipe : c.msgCliente}`}>
                {m.arquivo ? (
                  <div className={c.arquivo}>
                    <FileText size={34} strokeWidth={1.5} aria-hidden />
                    <span>
                      <strong>{m.arquivo.nome}</strong>
                      <small>{m.arquivo.tamanho}</small>
                    </span>
                    <button
                      type="button"
                      className={c.baixar}
                      disabled={!m.arquivo.arquivoId}
                      onClick={() => m.arquivo?.arquivoId && baixarArquivo(m.arquivo.arquivoId, m.arquivo.nome)}
                      aria-label={`Baixar ${m.arquivo.nome}`}
                      title={m.arquivo.arquivoId ? 'Baixar' : 'Arquivo de exemplo (não existe para baixar)'}
                    >
                      <Download size={20} />
                    </button>
                  </div>
                ) : (
                  <p>{m.texto}</p>
                )}
                <span className={c.hora}>
                  {horaCurta(m.em)}
                  {m.de === 'equipe' && <CheckCheck size={17} strokeWidth={2} aria-label="Enviada" />}
                </span>
              </div>
            ))}
          </div>
        ))}
        <div ref={fim} />
      </div>

      {erroArquivo && (
        <p className={c.erroArquivo} role="alert">
          {erroArquivo}
        </p>
      )}
      <p className={c.aviso}>Modo demonstração: as mensagens ficam salvas só neste navegador e não chegam ao cliente.</p>

      <form
        className={c.compositor}
        onSubmit={(e) => {
          e.preventDefault();
          mandar();
        }}
      >
        <div className={c.ancora} data-painel-chat>
          <button
            type="button"
            className={c.mais}
            aria-label="Respostas rápidas"
            aria-expanded={painel === 'rapidas'}
            onClick={() => setPainel((p) => (p === 'rapidas' ? null : 'rapidas'))}
          >
            <Plus size={22} strokeWidth={2} />
          </button>
          {painel === 'rapidas' && (
            <div className={`${c.popover} ${c.popoverCima}`} role="dialog" aria-label="Respostas rápidas">
              <strong>Respostas rápidas</strong>
              <button
                type="button"
                className={`${c.rapida} ${c.rapidaArquivo}`}
                onClick={() => {
                  setPainel(null);
                  escolherArquivo('cliente');
                }}
              >
                📥 Registrar arquivo recebido do cliente
              </button>
              {respostasRapidas.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={c.rapida}
                  onClick={() => {
                    setTexto(r);
                    setPainel(null);
                    campo.current?.focus();
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={c.campoMsg}>
          <textarea
            ref={campo}
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                mandar();
              }
            }}
            placeholder="Digite uma mensagem..."
            aria-label="Mensagem"
          />
          <div className={c.ancora} data-painel-chat>
            <button
              type="button"
              className={c.iconeBtn}
              aria-label="Emojis"
              aria-expanded={painel === 'emoji'}
              onClick={() => setPainel((p) => (p === 'emoji' ? null : 'emoji'))}
            >
              <Smile size={23} {...ICONE} />
            </button>
            {painel === 'emoji' && (
              <div className={`${c.popover} ${c.popoverCima} ${c.emojis}`} role="dialog" aria-label="Emojis">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setTexto((t) => t + em);
                      campo.current?.focus();
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className={c.iconeBtn} aria-label="Anexar arquivo" onClick={() => escolherArquivo('equipe')}>
            <Paperclip size={22} {...ICONE} />
          </button>
          <input
            ref={arquivo}
            type="file"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const arquivoId = await guardarArquivo(f);
                onEnviar({ arquivo: { nome: f.name, tamanho: tamanhoLegivel(f.size), arquivoId } }, remetente);
              } catch (err) {
                setErroArquivo(err instanceof Error ? err.message : 'Não foi possível guardar o arquivo.');
              }
            }}
          />
        </div>
        <button type="submit" className={c.enviar} aria-label="Enviar" disabled={!texto.trim()}>
          <SendHorizontal size={22} strokeWidth={2} />
        </button>
      </form>
    </section>
  );
}
