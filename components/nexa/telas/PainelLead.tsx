'use client';

// ============================================
// PAINEL DO LEAD (direita da tela de Conversas)
// ============================================
// Ficha editável: Dados do Lead (negociação + cadastro dos documentos),
// Pagamento (projeto + mensalidade recorrente), Documentos, Anotações e Tarefas.
// Na Venda ganha, tudo isso vai para o cartão do Kanban.
// ============================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlarmClock,
  ArrowLeft,
  ChartColumn,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  ExternalLink,
  FilePen,
  History,
  FileText,
  Instagram,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Send,
  Square,
  SquareCheck,
  Tag,
  Target,
  Trash2,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import c from './conversas.module.css';
import BlocoPagamento from './BlocoPagamento';
import BlocoMensalidade from './BlocoMensalidade';
import GeradorDocumentos from './GeradorDocumentos';
import type { Pendencia } from '../documentos/modelos';
import {
  ETAPA_GANHO,
  ETAPA_PERDIDO,
  etapasLead,
  ORIGENS_LEAD,
  type CanalConversa,
  type Conversa,
  type DadosCadastro,
  type DocumentoLead,
  type Lead,
} from '../dados-exemplo';
import { documentoValido, documentosDoLead, nomeEtapaLead, useServicos } from '../dados';
import { apagarArquivoSeSemUso, baixarArquivo, guardarArquivo, tamanhoLegivel } from '../arquivos';
import { cobrancasDoLead } from '../financeiro';
import { iniciais, reais, useParametro } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;
const NOME_CANAL: Record<CanalConversa, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', telegram: 'Telegram' };

function IconeCanal({ canal }: { canal: CanalConversa }) {
  if (canal === 'instagram') return <Instagram size={22} color="#e4405f" strokeWidth={1.9} aria-hidden />;
  if (canal === 'telegram') return <Send size={22} strokeWidth={1.9} aria-hidden />;
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path
        transform="translate(7.2 7.2) scale(0.4)"
        strokeWidth={4}
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ---------- Campo editável: salva ao sair do campo ou apertar Enter ----------
function Campo({
  rotulo,
  valor,
  onSalvar,
  icone,
  placeholder,
  tipo = 'texto',
  aviso,
  largo,
  idCampo,
}: {
  idCampo?: string;
  rotulo: string;
  valor: string;
  onSalvar: (novo: string) => void;
  icone?: ReactNode;
  placeholder?: string;
  tipo?: 'texto' | 'email' | 'tel' | 'dinheiro';
  aviso?: string;
  largo?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  const invalido = tipo === 'dinheiro' && Number.isNaN(lerValor(texto));
  // Lê o valor direto do campo na hora de salvar (não depende de a tela já ter atualizado)
  const salvar = (atual: string) => {
    if ((tipo === 'dinheiro' && Number.isNaN(lerValor(atual))) || atual.trim() === valor.trim()) return;
    onSalvar(atual.trim());
  };
  return (
    <label className={`${c.campo} ${largo ? c.campoLargo : ''}`}>
      <span className={c.campoRotulo}>
        {icone}
        {rotulo}
      </span>
      <input
        id={idCampo}
        className={c.campoEntrada}
        value={texto}
        type={tipo === 'email' ? 'email' : tipo === 'tel' ? 'tel' : 'text'}
        inputMode={tipo === 'dinheiro' ? 'decimal' : undefined}
        placeholder={placeholder ?? '—'}
        aria-invalid={invalido || !!aviso}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={(e) => salvar(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setTexto(valor);
        }}
      />
      {invalido && <small className={c.campoErro}>Use só números, ex.: 4.500</small>}
      {!invalido && aviso && <small className={c.campoErro}>{aviso}</small>}
    </label>
  );
}

/** Linha do tempo do lead: etapas, anotações, documentos e pagamentos recebidos. */
function atividadesDoLead(lead: Lead): Array<{ em: string; texto: string }> {
  const lista: Array<{ em: string; texto: string }> = [];
  (lead.historico ?? []).forEach((h) => lista.push({ em: h.em, texto: `Etapa: ${nomeEtapaLead(h.de)} → ${nomeEtapaLead(h.para)}` }));
  (lead.comentarios ?? []).forEach((cm) => lista.push({ em: cm.em, texto: `Anotação: ${cm.texto}` }));
  (lead.documentos ?? []).forEach((d) => lista.push({ em: d.em, texto: `${d.tipo === 'gerado' ? 'Documento gerado' : 'Arquivo anexado'}: ${d.nome}` }));
  cobrancasDoLead(lead)
    .filter((cb) => cb.pago && cb.pagoEm)
    .forEach((cb) => lista.push({ em: `${cb.pagoEm}T12:00:00`, texto: `Recebido: ${cb.rotulo} — ${reais(cb.valor)}` }));
  return lista.filter((a) => !Number.isNaN(new Date(a.em).getTime())).sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
}

function quandoAtividade(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Secao({
  titulo,
  icone,
  children,
  destaque,
  abrirQuando,
  id,
  fechada,
}: {
  titulo: ReactNode;
  icone?: ReactNode;
  children: ReactNode;
  destaque?: boolean;
  /** Muda de valor → a seção abre e rola até aparecer */
  abrirQuando?: string;
  id?: string;
  /** Começa recolhida (seções longas e de consulta) */
  fechada?: boolean;
}) {
  const [aberta, setAberta] = useState(!fechada);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!abrirQuando) return;
    setAberta(true);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [abrirQuando]);
  return (
    <section ref={ref} id={id} className={`${c.secao} ${destaque ? c.secaoDestaque : ''}`}>
      <button type="button" className={c.secaoTopo} onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
        {icone}
        <span>{titulo}</span>
        {aberta ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {aberta && <div className={c.secaoCorpo}>{children}</div>}
    </section>
  );
}

type Props = {
  lead: Lead;
  conversa: Conversa;
  projetoCriado: boolean;
  onAtualizar: (m: Partial<Lead>) => void;
  onVoltar: () => void;
  /** Envia uma mensagem na conversa (ex.: link de pagamento) */
  onEnviarMensagem?: (texto: string) => void;
};

export default function PainelLead({ lead, conversa, projetoCriado, onAtualizar, onVoltar, onEnviarMensagem }: Props) {
  const [servicos] = useServicos();
  const [anotacao, setAnotacao] = useState('');
  const [tarefa, setTarefa] = useState('');
  const [prazo, setPrazo] = useState('');
  const [novaTarefaAberta, setNovaTarefaAberta] = useState(false);
  const [avisoDoc, setAvisoDoc] = useState('');
  const [pulsoDados, setPulsoDados] = useState<string | undefined>();
  const [pulsoPagamento, setPulsoPagamento] = useState<string | undefined>();
  const pedirDocumentos = useParametro('documentos');
  const [verTodasAtividades, setVerTodasAtividades] = useState(false);
  const atividades = atividadesDoLead(lead);

  /** "Preencher": abre a seção certa e coloca o cursor no campo que falta */
  const irPara = (p: Pendencia) => {
    const agora = String(Date.now());
    if (p.onde === 'lead') setPulsoDados(agora);
    if (p.onde === 'pagamento') setPulsoPagamento(agora);
    window.setTimeout(() => {
      const el = p.alvo ? (document.getElementById(p.alvo) as HTMLElement | null) : document.getElementById('secao-pagamento');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el && 'focus' in el) (el as HTMLInputElement).focus({ preventScroll: true });
    }, 250);
  };
  const anexo = useRef<HTMLInputElement>(null);

  const tarefas = lead.tarefas ?? [];
  const pendentes = tarefas.filter((t) => !t.feita).length;
  const emAndamento = lead.etapa !== ETAPA_GANHO && lead.etapa !== ETAPA_PERDIDO;
  const fechamento = lead.etapa === 'fechamento' || lead.etapa === ETAPA_GANHO;
  const cadastro = lead.cadastro ?? {};
  const documentos = documentosDoLead(lead, conversa);
  const servicoAtual =
    servicos.find((s) => s.id === cadastro.servicoId) ?? servicos.find((s) => cadastro.servico && s.nome === cadastro.servico) ?? null;

  /** Escolhe o serviço do cadastro e sugere o valor (se o lead ainda não tiver valor). */
  const escolherServico = (id: string) => {
    if (id === '__texto__') return;
    const s = servicos.find((x) => x.id === id);
    if (!s) return onAtualizar({ cadastro: { servicoId: undefined, servico: undefined } });
    onAtualizar({
      cadastro: { servicoId: s.id, servico: s.nome },
      ...(lead.valor == null && s.precoBase != null ? { valor: s.precoBase } : {}),
    });
  };

  // Envia só o campo alterado; quem salva junta com o que já existe
  const salvarCadastro = (chave: keyof DadosCadastro, valor: string) =>
    onAtualizar({ cadastro: { [chave]: valor || undefined } });

  const salvarValor = (texto: string) => {
    const v = lerValor(texto);
    if (!Number.isNaN(v)) onAtualizar({ valor: v });
  };

  const anexar = async (arquivo: File) => {
    try {
      const arquivoId = await guardarArquivo(arquivo);
      onAtualizar({
        documentos: [
          ...(lead.documentos ?? []),
          {
            id: `doc-${arquivoId}`,
            nome: arquivo.name,
            tamanho: tamanhoLegivel(arquivo.size),
            tipo: 'arquivo',
            origem: 'equipe',
            arquivoId,
            em: new Date().toISOString(),
          },
        ],
      });
      setAvisoDoc('');
    } catch (err) {
      setAvisoDoc(err instanceof Error ? err.message : 'Não foi possível anexar o arquivo.');
    }
  };

  const removerDocumento = (d: DocumentoLead) => {
    if (!window.confirm(`Remover "${d.nome}" da ficha?`)) return;
    onAtualizar({ documentos: (lead.documentos ?? []).filter((x) => x.id !== d.id) });
    // só apaga o conteúdo se nenhum outro lugar usa (ex.: cópia no projeto, biblioteca de anexos)
    if (d.arquivoId) apagarArquivoSeSemUso(d.arquivoId).catch(() => undefined);
  };

  const origemTexto = (d: DocumentoLead) =>
    d.origem === 'cliente' ? 'Enviado pelo cliente' : d.origem === 'sistema' ? 'Rascunho gerado' : 'Anexado pela equipe';

  return (
    <aside className={`${c.coluna} ${c.painel}`} aria-label={`Ficha de ${lead.empresa}`}>
      <header className={c.painelTopo}>
        <button type="button" className={`${c.iconeBtn} ${c.soCelular}`} onClick={onVoltar} aria-label="Voltar para a conversa">
          <ArrowLeft size={20} />
        </button>
        <span className={c.avatarGrande} style={{ background: lead.cor }}>
          {lead.sigla ?? iniciais(lead.empresa)}
        </span>
        <span className={c.painelNome}>
          <strong>{lead.empresa}</strong>
          <small>
            Lead <i className={emAndamento ? c.pontoLaranja : lead.etapa === ETAPA_GANHO ? c.pontoVerde : c.pontoCinza} />{' '}
            {emAndamento ? 'Em negociação' : nomeEtapaLead(lead.etapa)}
          </small>
        </span>
        <Link href={`/crm?lead=${lead.id}`} className={c.iconeBtn} aria-label="Abrir no CRM" title="Abrir no CRM">
          <ExternalLink size={21} />
        </Link>
      </header>

      <div className={c.contatos}>
        <span className={`${c.contato} ${c.contatoAtivo}`} title={`Conversa pelo ${NOME_CANAL[conversa.canal]}`}>
          <IconeCanal canal={conversa.canal} />
        </span>
        {lead.telefone ? (
          <a className={c.contato} href={`tel:${lead.telefone.replace(/[^\d+]/g, '')}`} aria-label="Ligar">
            <Phone size={21} {...ICONE} />
          </a>
        ) : (
          <span className={`${c.contato} ${c.contatoOff}`} title="Preencha o telefone na ficha" aria-label="Sem telefone">
            <Phone size={21} {...ICONE} />
          </span>
        )}
        {lead.email ? (
          <a className={c.contato} href={`mailto:${lead.email}`} aria-label="Enviar e-mail">
            <Mail size={21} {...ICONE} />
          </a>
        ) : (
          <span className={`${c.contato} ${c.contatoOff}`} title="Preencha o e-mail na ficha" aria-label="Sem e-mail">
            <Mail size={21} {...ICONE} />
          </span>
        )}
        <button type="button" className={c.contato} aria-label="Nova tarefa" title="Nova tarefa" onClick={() => setNovaTarefaAberta(true)}>
          <Plus size={22} strokeWidth={2} />
        </button>
      </div>

      <div className={c.painelRolagem}>
        {lead.etapa === ETAPA_GANHO && (
          <div className={c.vendaGanha}>
            <Trophy size={20} />
            <span>
              Venda ganha.{' '}
              {projetoCriado ? (
                <>
                  O projeto foi criado no <Link href="/kanban">Kanban</Link> com os dados, documentos e anotações.
                </>
              ) : (
                'O projeto não foi encontrado no Kanban.'
              )}
            </span>
          </div>
        )}

        {/* ----- Dados do Lead (negociação + cadastro usado nos documentos) ----- */}
        <Secao titulo="Dados do Lead" id="dados-do-lead" abrirQuando={pulsoDados}>
          <div className={c.camposGrade}>
            <Campo rotulo="Responsável" icone={<Users size={17} {...ICONE} />} valor={lead.responsavel ?? ''} onSalvar={(v) => onAtualizar({ responsavel: v || undefined })} />
            <label className={c.campo}>
              <span className={c.campoRotulo}>
                <ChartColumn size={17} {...ICONE} /> Etapa
              </span>
              <span className={c.etapaSel}>
                <select
                  value={lead.etapa === ETAPA_PERDIDO ? '' : lead.etapa}
                  onChange={(e) => onAtualizar({ etapa: e.target.value })}
                  aria-label="Etapa do lead"
                >
                  {lead.etapa === ETAPA_PERDIDO && <option value="">Perdido</option>}
                  {etapasLead.map((e) => (
                    <option key={e.id} value={e.id} disabled={e.id === ETAPA_GANHO && lead.valor == null}>
                      {e.nome}
                      {e.id === ETAPA_GANHO && lead.valor == null ? ' (preencha o valor)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden />
              </span>
            </label>
            <Campo rotulo="Próximo contato" icone={<AlarmClock size={17} {...ICONE} />} valor={lead.data ?? ''} placeholder="Ex.: Hoje, 14:00" onSalvar={(v) => onAtualizar({ data: v || undefined })} />
            <label className={c.campo}>
              <span className={c.campoRotulo}>
                <Tag size={17} {...ICONE} /> Origem
              </span>
              <span className={c.etapaSel}>
                <select value={lead.origem ?? ''} onChange={(e) => onAtualizar({ origem: e.target.value || undefined })} aria-label="Origem">
                  <option value="">Não informada</option>
                  {ORIGENS_LEAD.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden />
              </span>
            </label>
            <Campo rotulo="Interesse" icone={<Target size={17} {...ICONE} />} valor={lead.descricao} onSalvar={(v) => onAtualizar({ descricao: v || '—' })} largo idCampo="campo-interesse" />
          </div>

          <p className={c.subtituloFicha}>Cadastro (usado nos documentos)</p>
          <div className={c.camposGrade}>
            <Campo rotulo="Nome completo ou razão social" valor={cadastro.nomeCompleto ?? ''} onSalvar={(v) => salvarCadastro('nomeCompleto', v)} largo idCampo="campo-nomeCompleto" />
            <Campo
              rotulo="CPF ou CNPJ"
              valor={cadastro.documento ?? ''}
              aviso={cadastro.documento && !documentoValido(cadastro.documento) ? 'Confira: CPF tem 11 números e CNPJ tem 14.' : undefined}
              onSalvar={(v) => salvarCadastro('documento', v)}
              idCampo="campo-documento"
            />
            <Campo rotulo="Quem assina" valor={cadastro.assinante ?? ''} onSalvar={(v) => salvarCadastro('assinante', v)} idCampo="campo-assinante" />
            <Campo rotulo="Endereço completo" valor={cadastro.endereco ?? ''} onSalvar={(v) => salvarCadastro('endereco', v)} largo idCampo="campo-endereco" />
            <label className={`${c.campo} ${c.campoLargo}`}>
              <span className={c.campoRotulo}>Serviço contratado</span>
              <span className={c.etapaSel}>
                <select id="campo-servico" value={servicoAtual?.id ?? (cadastro.servico ? '__texto__' : '')} onChange={(e) => escolherServico(e.target.value)} aria-label="Serviço contratado">
                  <option value="">Escolha um serviço…</option>
                  {cadastro.servico && !servicoAtual && <option value="__texto__">{cadastro.servico} (texto anterior)</option>}
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden />
              </span>
              {servicoAtual && servicoAtual.precoBase != null && lead.valor !== servicoAtual.precoBase && (
                <button type="button" className={c.usarValor} onClick={() => onAtualizar({ valor: servicoAtual.precoBase })}>
                  Usar o valor de implantação do serviço ({reais(servicoAtual.precoBase)})
                </button>
              )}
              {servicos.length === 0 && <small className={c.campoErro}>Nenhum serviço cadastrado na aba Serviços.</small>}
            </label>
            <Campo rotulo="Prazo de entrega" valor={cadastro.prazo ?? ''} placeholder="Ex.: 30 dias" onSalvar={(v) => salvarCadastro('prazo', v)} idCampo="campo-prazo" />
            <Campo rotulo="Valor (R$)" tipo="dinheiro" valor={lead.valor == null ? '' : String(lead.valor)} onSalvar={salvarValor} idCampo="campo-valor" />
            <Campo rotulo="E-mail" tipo="email" valor={lead.email ?? ''} onSalvar={(v) => onAtualizar({ email: v || undefined })} largo idCampo="campo-email" />
            <Campo rotulo="Telefone" tipo="tel" valor={lead.telefone ?? ''} onSalvar={(v) => onAtualizar({ telefone: v || undefined })} idCampo="campo-telefone" />
          </div>
        </Secao>

        {/* ----- Pagamento (projeto) + mensalidade recorrente ----- */}
        <Secao
          titulo="Pagamento"
          icone={<Wallet size={21} {...ICONE} />}
          id="secao-pagamento"
          destaque={fechamento}
          abrirQuando={pulsoPagamento ?? (lead.etapa === 'fechamento' ? `fechamento-${lead.id}` : undefined)}
        >
          <BlocoPagamento lead={lead} arquivos={documentos} onAtualizar={onAtualizar} />
          <div className={c.divisorPag} />
          <BlocoMensalidade lead={lead} arquivos={documentos} sugestao={servicoAtual?.mensalidade ?? null} onAtualizar={onAtualizar} />
        </Secao>

        {/* ----- Documentos ----- */}
        <Secao
          titulo={
            <>
              Documentos <span className={c.tarefasQtd}>({documentos.length})</span>
            </>
          }
          icone={<Paperclip size={21} {...ICONE} />}
          id="secao-documentos"
          abrirQuando={pedirDocumentos ? `docs-${lead.id}` : undefined}
        >
          <GeradorDocumentos lead={lead} onAtualizar={onAtualizar} onIrPara={irPara} />
          <ul className={c.docs}>
            {documentos.map((d) => {
              const proprio = (lead.documentos ?? []).some((x) => x.id === d.id);
              return (
                <li key={d.id}>
                  <span className={`${c.docIcone} ${d.origem === 'cliente' ? c.docCliente : ''}`}>
                    {d.tipo === 'gerado' ? <FilePen size={18} /> : <FileText size={18} />}
                  </span>
                  <span className={c.docTexto}>
                    <strong>{d.nome}</strong>
                    <small>
                      {origemTexto(d)}
                      {d.tamanho ? ` · ${d.tamanho}` : ''} · {quando(d.em)}
                    </small>
                  </span>
                  {d.arquivoId && (
                    <button type="button" className={c.docAcao} onClick={() => baixarArquivo(d.arquivoId!, d.nome)} aria-label={`Baixar ${d.nome}`}>
                      <Download size={17} />
                    </button>
                  )}
                  {d.documentoId && (
                    <Link href="/documentos" className={c.docAcao} aria-label={`Abrir ${d.nome} no Gerador`} title="Abrir no Gerador">
                      <ExternalLink size={17} />
                    </Link>
                  )}
                  {proprio && (
                    <button type="button" className={c.docAcao} onClick={() => removerDocumento(d)} aria-label={`Remover ${d.nome}`}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              );
            })}
            {documentos.length === 0 && <li className={c.vazio}>Nenhum documento ainda. Os arquivos trocados na conversa aparecem aqui.</li>}
          </ul>
          <button type="button" className={c.novaTarefa} onClick={() => anexo.current?.click()}>
            <Plus size={16} /> Anexar documento
          </button>
          <input
            ref={anexo}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) anexar(f);
            }}
          />
          {avisoDoc && (
            <p className={c.notaDoc} role="status">
              {avisoDoc}
            </p>
          )}
        </Secao>

        {/* ----- Anotações ----- */}
        <Secao titulo="Anotações" icone={<FileText size={21} {...ICONE} />}>
          <ul className={c.anotacoes}>
            {(lead.comentarios ?? []).map((cm, i) => (
              <li key={`${cm.em}-${i}`}>
                <span>↳ {cm.texto}</span>
                <button
                  type="button"
                  className={c.removerTarefa}
                  aria-label="Remover anotação"
                  onClick={() => onAtualizar({ comentarios: (lead.comentarios ?? []).filter((_, j) => j !== i) })}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
            {!(lead.comentarios ?? []).length && <li className={c.vazio}>Nenhuma anotação.</li>}
          </ul>
          <form
            className={c.miniForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (!anotacao.trim()) return;
              onAtualizar({ comentarios: [{ texto: anotacao.trim(), em: new Date().toISOString() }, ...(lead.comentarios ?? [])] });
              setAnotacao('');
            }}
          >
            <input value={anotacao} onChange={(e) => setAnotacao(e.target.value)} placeholder="Nova anotação" aria-label="Nova anotação" />
            <button type="submit" disabled={!anotacao.trim()}>
              Salvar
            </button>
          </form>
        </Secao>

        {/* ----- Tarefas ----- */}
        <Secao
          titulo={
            <>
              Tarefas <span className={c.tarefasQtd}>({pendentes})</span>
            </>
          }
          icone={<ClipboardCheck size={21} {...ICONE} />}
        >
          <ul className={c.tarefas}>
            {tarefas.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={c.check}
                  role="checkbox"
                  aria-checked={t.feita}
                  aria-label={t.texto}
                  onClick={() => onAtualizar({ tarefas: tarefas.map((x) => (x.id === t.id ? { ...x, feita: !x.feita } : x)) })}
                >
                  {t.feita ? <SquareCheck size={24} /> : <Square size={24} />}
                </button>
                <span className={t.feita ? c.tarefaFeita : ''}>
                  {t.texto}
                  {t.prazo && (
                    <small>
                      <AlarmClock size={14} /> {t.prazo}
                    </small>
                  )}
                </span>
                <button
                  type="button"
                  className={c.removerTarefa}
                  aria-label={`Remover tarefa ${t.texto}`}
                  onClick={() => onAtualizar({ tarefas: tarefas.filter((x) => x.id !== t.id) })}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
            {tarefas.length === 0 && <li className={c.vazio}>Nenhuma tarefa.</li>}
          </ul>
          {novaTarefaAberta ? (
            <form
              className={c.miniForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (!tarefa.trim()) return;
                onAtualizar({
                  tarefas: [...tarefas, { id: `t-${Date.now()}`, texto: tarefa.trim(), prazo: prazo.trim() || undefined, feita: false }],
                });
                setTarefa('');
                setPrazo('');
                setNovaTarefaAberta(false);
              }}
            >
              <input value={tarefa} onChange={(e) => setTarefa(e.target.value)} placeholder="O que fazer" aria-label="Tarefa" autoFocus />
              <input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Prazo (ex.: Hoje, 14:00)" aria-label="Prazo" />
              <button type="submit" disabled={!tarefa.trim()}>
                Adicionar
              </button>
            </form>
          ) : (
            <button type="button" className={c.novaTarefa} onClick={() => setNovaTarefaAberta(true)}>
              <Plus size={16} /> Nova tarefa
            </button>
          )}
        </Secao>

        {/* ----- Histórico de atividades (só leitura, reúne o que aconteceu no lead) ----- */}
        <Secao titulo="Histórico de atividades" icone={<History size={21} {...ICONE} />} fechada>
          <ul className={c.atividades}>
            {(verTodasAtividades ? atividades : atividades.slice(0, 8)).map((a, i) => (
              <li key={`${a.em}-${i}`}>
                <span>{a.texto}</span>
                <small>{quandoAtividade(a.em)}</small>
              </li>
            ))}
            {!atividades.length && <li className={c.vazio}>Nada registrado ainda.</li>}
          </ul>
          {atividades.length > 8 && (
            <button type="button" className={c.novaTarefa} onClick={() => setVerTodasAtividades((v) => !v)}>
              {verTodasAtividades ? 'Mostrar menos' : `Ver todas (${atividades.length})`}
            </button>
          )}
        </Secao>
      </div>
    </aside>
  );
}
