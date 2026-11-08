'use client';

// Ficha do lead: dados, ganho/perdido (motivo obrigatório), comentários internos e histórico.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { History, MessageSquare, MessageSquareMore, RotateCcw, Trash2, Trophy, X, XCircle } from 'lucide-react';
import u from '../ui.module.css';
import f from './ficha.module.css';
import { ETAPA_GANHO, ETAPA_PERDIDO, etapasLead, ORIGENS_LEAD, type Lead } from '../dados-exemplo';
import { nomeEtapaLead, useConversas } from '../dados';
import { iniciais, reais } from '../util';

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** null = vazio; NaN = texto inválido */
function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

type Props = {
  lead: Lead;
  onFechar: () => void;
  onAtualizar: (mudancas: Partial<Lead>) => void;
  onExcluir: () => void;
  /** Lead sem valor sendo marcado como ganho: pede o valor antes */
  onPedirValor: () => void;
};

export default function FichaLead({ lead, onFechar, onAtualizar, onExcluir, onPedirValor }: Props) {
  const [descricao, setDescricao] = useState(lead.descricao);
  const [valor, setValor] = useState(lead.valor == null ? '' : String(lead.valor));
  const [data, setData] = useState(lead.data ?? '');
  const [responsavel, setResponsavel] = useState(lead.responsavel ?? '');
  const [comentario, setComentario] = useState('');
  const [perdendo, setPerdendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const painel = useRef<HTMLElement>(null);
  const [conversas] = useConversas();
  const temConversa = conversas.some((cv) => cv.leadId === lead.id);

  // Ao trocar de lead, recarrega os campos
  useEffect(() => {
    setDescricao(lead.descricao);
    setValor(lead.valor == null ? '' : String(lead.valor));
    setData(lead.data ?? '');
    setResponsavel(lead.responsavel ?? '');
    setPerdendo(false);
    setConfirmarExclusao(false);
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    painel.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const numero = lerValor(valor);
  const valorInvalido = Number.isNaN(numero);
  const ganho = lead.etapa === ETAPA_GANHO;
  const perdido = lead.etapa === ETAPA_PERDIDO;

  const salvarCampo = (mudancas: Partial<Lead>) => onAtualizar(mudancas);

  return (
    <div className={f.fundo} onClick={onFechar}>
      <aside
        ref={painel}
        tabIndex={-1}
        className={f.ficha}
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${lead.empresa}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={f.topo}>
          <span className={f.avatar} style={{ background: lead.cor }}>
            {lead.sigla ?? iniciais(lead.empresa)}
          </span>
          <div className={f.nome}>
            <h2>{lead.empresa}</h2>
            <span className={`${u.status} ${ganho ? u.stLima : perdido ? u.stLaranja : u.stCinza}`}>
              {nomeEtapaLead(lead.etapa)}
            </span>
          </div>
          <Link
            href={`/conversas?lead=${lead.id}`}
            className={u.btnIcone}
            aria-label={temConversa ? 'Abrir conversa e painel completo' : 'Abrir painel completo (dados, pagamento, documentos)'}
            title={temConversa ? 'Abrir conversa e painel completo' : 'Abrir painel completo (dados, pagamento, documentos)'}
          >
            <MessageSquareMore size={20} />
          </Link>
          <button type="button" className={u.btnIcone} onClick={onFechar} aria-label="Fechar ficha">
            <X size={20} />
          </button>
        </header>

        {/* ----- Resultado ----- */}
        {perdido ? (
          <div className={f.resultadoPerdido}>
            <p>
              <strong>Lead perdido.</strong> Motivo: {lead.motivoPerda}
            </p>
            <button type="button" className={u.btnSecundario} onClick={() => onAtualizar({ etapa: 'novo', motivoPerda: undefined })}>
              <RotateCcw size={16} /> Reabrir lead
            </button>
          </div>
        ) : (
          <div className={f.acoes}>
            {!ganho && (
              <button
                type="button"
                className={u.btnPrimario}
                onClick={() => (lead.valor == null ? onPedirValor() : onAtualizar({ etapa: ETAPA_GANHO }))}
              >
                <Trophy size={17} /> Venda ganha
              </button>
            )}
            {ganho && (
              <p className={f.ganhoTexto}>
                <Trophy size={16} /> Venda ganha{lead.ganhoEm ? ` em ${lead.ganhoEm.split('-').reverse().join('/')}` : ''} — conta na
                meta do mês.
              </p>
            )}
            <button type="button" className={u.btnSecundario} onClick={() => setPerdendo(true)}>
              <XCircle size={17} /> Marcar como perdido
            </button>
          </div>
        )}

        {perdendo && (
          <form
            className={f.perda}
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo.trim()) return;
              onAtualizar({ etapa: ETAPA_PERDIDO, motivoPerda: motivo.trim(), contrato: false });
              setPerdendo(false);
              setMotivo('');
            }}
          >
            <label className={u.campo}>
              <span>Por que foi perdido? *</span>
              <textarea
                className={`${u.entrada} ${f.areaTexto}`}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: achou caro, fechou com outra empresa, desistiu do projeto…"
                autoFocus
                required
              />
            </label>
            <div className={f.linhaBotoes}>
              <button type="button" className={u.btnSecundario} onClick={() => setPerdendo(false)}>
                Cancelar
              </button>
              <button type="submit" className={u.btnPrimario} disabled={!motivo.trim()}>
                Confirmar perda
              </button>
            </div>
          </form>
        )}

        {/* ----- Dados ----- */}
        <section className={f.secao}>
          <div className={u.formGrade}>
            <label className={`${u.campo} ${u.formCheia}`}>
              <span>Interesse</span>
              <input
                className={u.entrada}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onBlur={() => descricao.trim() !== lead.descricao && salvarCampo({ descricao: descricao.trim() || '—' })}
              />
            </label>
            <label className={u.campo}>
              <span>Valor (R$)</span>
              <input
                className={u.entrada}
                inputMode="decimal"
                value={valor}
                aria-invalid={valorInvalido}
                onChange={(e) => setValor(e.target.value)}
                onBlur={() => {
                  if (valorInvalido) return;
                  const novo = numero as number | null;
                  if (novo !== lead.valor) salvarCampo({ valor: novo });
                }}
                placeholder="Sem valor"
              />
              {valorInvalido && <small className={f.erro}>Use só números, ex.: 4.500</small>}
              {!valorInvalido && lead.valor != null && <small className={f.dica}>{reais(lead.valor)}</small>}
            </label>
            <label className={u.campo}>
              <span>Etapa</span>
              <select
                className={u.entrada}
                value={perdido ? '' : lead.etapa}
                onChange={(e) => {
                  const etapa = e.target.value;
                  if (etapa === ETAPA_GANHO && lead.valor == null) onPedirValor();
                  else onAtualizar({ etapa });
                }}
              >
                {perdido && <option value="">Perdido</option>}
                {etapasLead.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className={u.campo}>
              <span>Próximo contato</span>
              <input
                className={u.entrada}
                value={data}
                onChange={(e) => setData(e.target.value)}
                onBlur={() => data.trim() !== (lead.data ?? '') && salvarCampo({ data: data.trim() || undefined })}
                placeholder="Ex.: Amanhã"
              />
            </label>
            <label className={u.campo}>
              <span>Origem</span>
              <select
                className={u.entrada}
                value={lead.origem ?? ''}
                onChange={(e) => salvarCampo({ origem: e.target.value || undefined })}
              >
                <option value="">Não informada</option>
                {ORIGENS_LEAD.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label className={`${u.campo} ${u.formCheia}`}>
              <span>Responsável</span>
              <input
                className={u.entrada}
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                onBlur={() =>
                  responsavel.trim() !== (lead.responsavel ?? '') && salvarCampo({ responsavel: responsavel.trim() || undefined })
                }
                placeholder="Quem cuida deste lead"
              />
            </label>
          </div>
        </section>

        {/* ----- Comentários internos ----- */}
        <section className={f.secao}>
          <h3>
            <MessageSquare size={18} /> Comentários internos
          </h3>
          <form
            className={f.novoComentario}
            onSubmit={(e) => {
              e.preventDefault();
              if (!comentario.trim()) return;
              onAtualizar({
                comentarios: [{ texto: comentario.trim(), em: new Date().toISOString() }, ...(lead.comentarios ?? [])],
              });
              setComentario('');
            }}
          >
            <textarea
              className={`${u.entrada} ${f.areaTexto}`}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Anote o que foi conversado. Só a equipe vê."
              aria-label="Novo comentário"
            />
            <button type="submit" className={u.btnSecundario} disabled={!comentario.trim()}>
              Adicionar
            </button>
          </form>
          <ul className={f.lista}>
            {(lead.comentarios ?? []).map((cm, i) => (
              <li key={`${cm.em}-${i}`}>
                <p>{cm.texto}</p>
                <small>{quando(cm.em)}</small>
              </li>
            ))}
            {!(lead.comentarios ?? []).length && <li className={f.vazio}>Nenhum comentário ainda.</li>}
          </ul>
        </section>

        {/* ----- Histórico ----- */}
        <section className={f.secao}>
          <h3>
            <History size={18} /> Histórico de etapas
          </h3>
          <ul className={f.lista}>
            {[...(lead.historico ?? [])].reverse().map((h, i) => (
              <li key={`${h.em}-${i}`}>
                <p>
                  {nomeEtapaLead(h.de)} → <strong>{nomeEtapaLead(h.para)}</strong>
                </p>
                <small>{quando(h.em)}</small>
              </li>
            ))}
            {!(lead.historico ?? []).length && <li className={f.vazio}>Ainda não mudou de etapa.</li>}
          </ul>
        </section>

        <footer className={f.rodape}>
          {confirmarExclusao ? (
            <div className={f.linhaBotoes}>
              <span>Excluir {lead.empresa} de vez?</span>
              <button type="button" className={u.btnSecundario} onClick={() => setConfirmarExclusao(false)}>
                Não
              </button>
              <button type="button" className={f.btnPerigo} onClick={onExcluir}>
                Sim, excluir
              </button>
            </div>
          ) : (
            <button type="button" className={f.excluir} onClick={() => setConfirmarExclusao(true)}>
              <Trash2 size={16} /> Excluir lead
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
