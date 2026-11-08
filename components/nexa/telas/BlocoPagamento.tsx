'use client';

// ============================================
// PAGAMENTO DO PROJETO (seção própria no painel do lead)
// ============================================
// À vista: forma, valor, data do pagamento e comprovante (sem vencimento nem atraso).
// Entrada + parcelas: entrada com comprovante + parcelas independentes
// (valor editável, vencimento, dias até vencer, paga, data efetiva, comprovante).
// A soma é conferida com o valor negociado. Pagamentos antigos são convertidos.
// A mensalidade recorrente fica em BlocoMensalidade (separada do projeto).
// ============================================

import { useState } from 'react';
import { CircleAlert, CircleCheck, Clock, Wallet } from 'lucide-react';
import p from './pagamento.module.css';
import Comprovante from './Comprovante';
import { type DocumentoLead, type FormaPagamento, type Lead, type PagamentoLead, type ParcelaContrato } from '../dados-exemplo';
import {
  dataBr,
  diasAte,
  diferencaPagamento,
  dinheiro,
  dividir,
  FORMAS_PAGAMENTO,
  hojeIso,
  montarParcelas,
  normalizarPagamento,
  situacaoCobranca,
  somarMeses,
  textoDias,
} from '../financeiro';

function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

function paraTexto(v?: number | null): string {
  return v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Campo de dinheiro que salva ao sair (lê o valor direto do campo). */
function CampoValor({ valor, onSalvar, rotulo, compacto }: { valor?: number | null; onSalvar: (v: number | null) => void; rotulo: string; compacto?: boolean }) {
  const [texto, setTexto] = useState(paraTexto(valor));
  const [chave, setChave] = useState(valor);
  if (chave !== valor) {
    setChave(valor);
    setTexto(paraTexto(valor));
  }
  const invalido = Number.isNaN(lerValor(texto));
  return (
    <input
      className={compacto ? p.valorParcela : undefined}
      inputMode="decimal"
      value={texto}
      placeholder="0,00"
      aria-label={rotulo}
      aria-invalid={invalido}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={(e) => {
        const v = lerValor(e.currentTarget.value);
        if (Number.isNaN(v) || v === (valor ?? null)) return;
        onSalvar(v);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function SeletorForma({ valor, onMudar, rotulo }: { valor?: FormaPagamento; onMudar: (f: FormaPagamento) => void; rotulo: string }) {
  return (
    <select value={valor ?? ''} onChange={(e) => onMudar(e.target.value as FormaPagamento)} aria-label={rotulo}>
      {!valor && <option value="">Escolha…</option>}
      {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
        <option key={f} value={f}>
          {FORMAS_PAGAMENTO[f]}
        </option>
      ))}
    </select>
  );
}

type Props = {
  lead: Lead;
  arquivos: DocumentoLead[];
  onAtualizar: (m: Partial<Lead>) => void;
};

export default function BlocoPagamento({ lead, arquivos, onAtualizar }: Props) {
  const pg = normalizarPagamento(lead.pagamento);
  const hoje = hojeIso();
  const [erro, setErro] = useState('');

  const salvar = (novo: PagamentoLead) => onAtualizar({ pagamento: novo });

  const base: PagamentoLead = pg ?? { versao: 2, modalidade: 'avista', forma: 'pix', valor: lead.valor };

  const mudarModalidade = (modalidade: PagamentoLead['modalidade']) => {
    if (modalidade === base.modalidade && pg) return;
    const temRegistro =
      (base.modalidade === 'avista' && (base.pagoEm || base.comprovante)) ||
      (base.modalidade === 'entrada' && (base.entrada?.pagoEm || (base.parcelas ?? []).some((x) => x.pago || x.comprovante)));
    if (temRegistro && !window.confirm('Trocar a modalidade mantém os dados salvos da outra, mas eles deixam de aparecer. Continuar?')) return;
    // guarda os dois lados no mesmo registro, para nada se perder ao alternar
    salvar(
      modalidade === 'avista'
        ? { ...base, modalidade, forma: base.forma ?? 'pix', valor: base.valor ?? lead.valor }
        : { ...base, modalidade, entrada: base.entrada ?? { valor: null, forma: 'pix' }, formaParcelas: base.formaParcelas ?? 'pix', qtdParcelas: base.qtdParcelas ?? 3 }
    );
  };

  // ---------- Entrada + parcelas ----------
  const parcelas = base.parcelas ?? [];
  const restante = lead.valor != null ? Math.max(0, lead.valor - (base.entrada?.valor ?? 0)) : null;

  const remontar = (mud: Partial<Pick<PagamentoLead, 'qtdParcelas' | 'primeiroVencimento'>>, entradaValor = base.entrada?.valor ?? 0) => {
    const qtd = mud.qtdParcelas ?? base.qtdParcelas ?? 3;
    const primeiro = mud.primeiroVencimento ?? base.primeiroVencimento ?? somarMeses(hoje, 1);
    if (lead.valor == null) return setErro('Preencha o valor negociado em Dados do Lead para montar as parcelas.');
    if (entradaValor >= lead.valor) return setErro('A entrada precisa ser menor que o valor negociado.');
    setErro('');
    salvar({ ...base, ...mud, qtdParcelas: qtd, primeiroVencimento: primeiro, parcelas: montarParcelas(qtd, lead.valor - entradaValor, primeiro, parcelas) });
  };

  const mudarParcela = (id: string, m: Partial<ParcelaContrato>) =>
    salvar({ ...base, parcelas: parcelas.map((x) => (x.id === id ? { ...x, ...m } : x)) });

  const dif = diferencaPagamento(base.modalidade === 'avista' || parcelas.length ? base : undefined, lead.valor);
  const contagem = {
    pagas: parcelas.filter((x) => x.pago).length,
    vencidas: parcelas.filter((x) => situacaoCobranca(x, hoje) === 'vencida').length,
    pendentes: parcelas.filter((x) => !x.pago && situacaoCobranca(x, hoje) !== 'vencida').length,
  };

  /** Ajusta as parcelas em aberto para a soma bater com o valor negociado. */
  const ajustarEmAberto = () => {
    if (lead.valor == null) return;
    const abertas = parcelas.filter((x) => !x.pago);
    if (!abertas.length) return setErro('Todas as parcelas já estão pagas: ajuste o valor manualmente.');
    const pagoParcelas = parcelas.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0);
    const alvo = lead.valor - (base.entrada?.valor ?? 0) - pagoParcelas;
    if (alvo < 0) return setErro('A entrada e as parcelas pagas já passam do valor negociado.');
    const valores = dividir(alvo, abertas.length);
    salvar({ ...base, parcelas: parcelas.map((x) => (x.pago ? x : { ...x, valor: valores[abertas.indexOf(x)] })) });
    setErro('');
  };

  return (
    <div className={p.bloco}>
      <div className={p.segmentado2} role="radiogroup" aria-label="Modalidade de pagamento">
        {(
          [
            ['avista', 'À vista'],
            ['entrada', 'Entrada + parcelas'],
          ] as const
        ).map(([m, nome]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={base.modalidade === m}
            className={`${p.segmento} ${base.modalidade === m ? p.segmentoAtivo : ''}`}
            onClick={() => mudarModalidade(m)}
          >
            {nome}
          </button>
        ))}
      </div>

      {base.observacao && <p className={p.nota}>{base.observacao}</p>}

      {/* ===== À vista ===== */}
      {base.modalidade === 'avista' && (
        <div className={p.cartaoPag}>
          <div className={p.grade3}>
            <label className={p.campo}>
              <span>Forma</span>
              <SeletorForma valor={base.forma} rotulo="Forma do pagamento à vista" onMudar={(f) => salvar({ ...base, forma: f })} />
            </label>
            <label className={p.campo}>
              <span>Valor (R$)</span>
              <CampoValor valor={base.valor ?? null} rotulo="Valor do pagamento à vista" onSalvar={(v) => salvar({ ...base, valor: v })} />
            </label>
            <label className={p.campo}>
              <span>Pago em</span>
              <input type="date" value={base.pagoEm ?? ''} max={hoje} onChange={(e) => salvar({ ...base, pagoEm: e.target.value || undefined })} />
            </label>
          </div>
          <Comprovante
            comprovante={base.comprovante}
            arquivos={arquivos}
            rotulo="pagamento à vista"
            onMudar={(c) => salvar({ ...base, comprovante: c, pagoEm: c && !base.pagoEm ? hoje : base.pagoEm })}
          />
        </div>
      )}

      {/* ===== Entrada + parcelas ===== */}
      {base.modalidade === 'entrada' && (
        <>
          <p className={p.subtitulo}>Entrada</p>
          <div className={p.cartaoPag}>
            <div className={p.grade3}>
              <label className={p.campo}>
                <span>Valor (R$)</span>
                <CampoValor
                  valor={base.entrada?.valor ?? null}
                  rotulo="Valor da entrada"
                  onSalvar={(v) => {
                    const entrada = { ...(base.entrada ?? { forma: 'pix' as FormaPagamento }), valor: v };
                    if (parcelas.length && lead.valor != null && (v ?? 0) < lead.valor) {
                      // recalcula as parcelas em aberto com o novo restante
                      salvar({ ...base, entrada, parcelas: montarParcelas(base.qtdParcelas ?? parcelas.length, lead.valor - (v ?? 0), base.primeiroVencimento ?? parcelas[0].vencimento, parcelas) });
                    } else salvar({ ...base, entrada });
                  }}
                />
              </label>
              <label className={p.campo}>
                <span>Forma</span>
                <SeletorForma valor={base.entrada?.forma} rotulo="Forma da entrada" onMudar={(f) => salvar({ ...base, entrada: { valor: base.entrada?.valor ?? null, ...base.entrada, forma: f } })} />
              </label>
              <label className={p.campo}>
                <span>Pago em</span>
                <input
                  type="date"
                  value={base.entrada?.pagoEm ?? ''}
                  max={hoje}
                  onChange={(e) => salvar({ ...base, entrada: { valor: null, forma: 'pix', ...base.entrada, pagoEm: e.target.value || undefined } })}
                />
              </label>
            </div>
            <Comprovante
              comprovante={base.entrada?.comprovante}
              arquivos={arquivos}
              rotulo="entrada"
              onMudar={(c) =>
                salvar({ ...base, entrada: { valor: null, forma: 'pix', ...base.entrada, comprovante: c, pagoEm: c && !base.entrada?.pagoEm ? hoje : base.entrada?.pagoEm } })
              }
            />
          </div>

          <p className={p.subtitulo}>Parcelas {restante != null && <span>· restante {dinheiro(restante)}</span>}</p>
          <div className={p.grade3}>
            <label className={p.campo}>
              <span>Quantidade</span>
              <input
                type="number"
                min={1}
                max={48}
                defaultValue={base.qtdParcelas ?? 3}
                key={`qtd-${base.qtdParcelas}`}
                aria-label="Quantidade de parcelas"
                onBlur={(e) => {
                  const n = Number(e.currentTarget.value);
                  if (n >= 1 && n <= 48 && (n !== base.qtdParcelas || !parcelas.length)) remontar({ qtdParcelas: n });
                }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </label>
            <label className={p.campo}>
              <span>Forma</span>
              <SeletorForma valor={base.formaParcelas} rotulo="Forma das parcelas" onMudar={(f) => salvar({ ...base, formaParcelas: f })} />
            </label>
            <label className={p.campo}>
              <span>1º vencimento</span>
              <input
                type="date"
                value={base.primeiroVencimento ?? ''}
                onChange={(e) => e.target.value && remontar({ primeiroVencimento: e.target.value })}
              />
            </label>
          </div>
          {!parcelas.length && (
            <button type="button" className={p.montar} onClick={() => remontar({})}>
              Gerar parcelas
            </button>
          )}

          {parcelas.length > 0 && (
            <>
              <div className={p.contagem} aria-label="Situação das parcelas">
                <span className={p.cPaga}>{contagem.pagas} paga(s)</span>
                <span className={p.cPend}>{contagem.pendentes} pendente(s)</span>
                <span className={contagem.vencidas ? p.cVenc : p.cPend}>{contagem.vencidas} vencida(s)</span>
              </div>
              <ul className={p.parcelas}>
                {parcelas.map((x) => {
                  const sit = situacaoCobranca(x, hoje);
                  const dias = diasAte(x.vencimento, hoje);
                  return (
                    <li key={x.id} className={`${p.parcela} ${p['sit-' + (sit === 'paga' ? 'paga' : sit === 'vencida' ? 'atrasada' : sit === 'hoje' || sit === 'proxima' ? 'proxima' : 'pendente')]}`}>
                      <div className={p.parcelaLinha}>
                        <strong>
                          {x.numero}/{parcelas.length}
                        </strong>
                        <CampoValor compacto valor={x.valor} rotulo={`Valor da parcela ${x.numero}`} onSalvar={(v) => v != null && mudarParcela(x.id, { valor: v })} />
                        <input
                          type="date"
                          className={p.dataParcela}
                          value={x.vencimento}
                          aria-label={`Vencimento da parcela ${x.numero}`}
                          onChange={(e) => e.target.value && mudarParcela(x.id, { vencimento: e.target.value })}
                        />
                        <span className={p.situacao} title={sit === 'paga' ? 'Paga' : textoDias(dias)}>
                          {sit === 'paga' ? <CircleCheck size={14} /> : sit === 'vencida' ? <CircleAlert size={14} /> : <Clock size={14} />}
                          {sit === 'paga' ? `paga ${dataBr(x.pagoEm)}` : textoDias(dias)}
                        </span>
                      </div>
                      <div className={p.parcelaLinha2}>
                        <label className={p.marcar}>
                          <input
                            type="checkbox"
                            checked={x.pago}
                            onChange={(e) => mudarParcela(x.id, e.target.checked ? { pago: true, pagoEm: x.pagoEm ?? hoje } : { pago: false, pagoEm: undefined })}
                          />
                          Paga
                        </label>
                        {x.pago && (
                          <input
                            type="date"
                            className={p.dataParcela}
                            value={x.pagoEm ?? ''}
                            max={hoje}
                            aria-label={`Data em que a parcela ${x.numero} foi paga`}
                            onChange={(e) => mudarParcela(x.id, { pagoEm: e.target.value || hoje })}
                          />
                        )}
                        <Comprovante
                          compacto
                          comprovante={x.comprovante}
                          arquivos={arquivos}
                          rotulo={`parcela ${x.numero}`}
                          onMudar={(c) => mudarParcela(x.id, c ? { comprovante: c, pago: true, pagoEm: x.pagoEm ?? hoje } : { comprovante: undefined })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      {/* ===== Conferência com o valor negociado ===== */}
      {dif != null && dif !== 0 && (
        <div className={p.aviso}>
          <CircleAlert size={16} />
          <span>
            {base.modalidade === 'avista' ? 'O valor pago' : 'Entrada + parcelas'} soma {dinheiro((lead.valor ?? 0) + dif)}, mas o valor negociado é{' '}
            {dinheiro(lead.valor ?? 0)} ({dif > 0 ? 'sobram' : 'faltam'} {dinheiro(Math.abs(dif))}).
          </span>
          {base.modalidade === 'entrada' && parcelas.some((x) => !x.pago) && (
            <button type="button" onClick={ajustarEmAberto}>
              Ajustar parcelas em aberto
            </button>
          )}
        </div>
      )}
      {lead.valor == null && <p className={p.nota}><Wallet size={13} /> Preencha o valor negociado em Dados do Lead para conferir a soma.</p>}

      {erro && (
        <p className={p.erro} role="alert">
          {erro}
        </p>
      )}

      {pg && (
        <button
          type="button"
          className={p.remover}
          onClick={() => window.confirm('Remover o pagamento do projeto (com os comprovantes)?') && onAtualizar({ pagamento: undefined })}
        >
          Remover pagamento
        </button>
      )}
    </div>
  );
}
