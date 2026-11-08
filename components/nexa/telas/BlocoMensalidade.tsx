'use client';

// ============================================
// MENSALIDADE RECORRENTE (opcional, separada do pagamento do projeto)
// ============================================
// Serve para serviços só por mensalidade ou projeto + mensalidade
// (ex.: CRM com R$ 3.000 de implantação e R$ 299/mês de manutenção).
// Os ciclos são gerados automaticamente; não há quantidade limitada:
// continua até ser pausada ou encerrada.
// ============================================

import { useEffect, useState } from 'react';
import { CalendarClock, CircleAlert, CircleCheck, Clock, Pause, Pencil, Play, Repeat } from 'lucide-react';
import p from './pagamento.module.css';
import Comprovante from './Comprovante';
import type { DocumentoLead, FormaPagamento, Lead, MensalidadeLead, RegistroMensalidade } from '../dados-exemplo';
import {
  ciclosMensalidade,
  dataBr,
  diasAte,
  dinheiro,
  faixaDoMes,
  faixasMensalidade,
  FORMAS_PAGAMENTO,
  hojeIso,
  mensalidadeAtiva,
  nomeCompetencia,
  reajustarMensalidade,
  situacaoCobranca,
  somarMeses,
  textoDias,
} from '../financeiro';

function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

type Props = {
  lead: Lead;
  arquivos: DocumentoLead[];
  /** Mensalidade cadastrada no serviço escolhido (sugestão) */
  sugestao?: number | null;
  onAtualizar: (m: Partial<Lead>) => void;
};

export default function BlocoMensalidade({ lead, arquivos, sugestao, onAtualizar }: Props) {
  const hoje = hojeIso();
  const m = lead.mensalidade;
  const [valorTexto, setValorTexto] = useState(m?.valor != null ? String(m.valor).replace('.', ',') : '');
  const [verTodas, setVerTodas] = useState(false);
  const [reajusteAberto, setReajusteAberto] = useState(false);
  const [reajuste, setReajuste] = useState({ valor: '', dia: '', desde: '' });
  // Valor preenchido por fora (sugestão do serviço, outra aba): mostra no campo
  const valorSalvo = m?.valor ?? null;
  useEffect(() => {
    setValorTexto(valorSalvo != null ? String(valorSalvo).replace('.', ',') : '');
  }, [valorSalvo, lead.id]);

  const salvar = (novo: MensalidadeLead) => onAtualizar({ mensalidade: novo });
  const base: MensalidadeLead = m ?? {
    ativa: false,
    valor: sugestao ?? null,
    forma: 'pix',
    diaVencimento: Number(hoje.slice(8, 10)),
    inicio: hoje,
    registros: [],
  };

  const ciclos = ciclosMensalidade(m, hoje);
  const proximo = ciclos.find((c) => !c.pago && c.vencimento >= hoje) ?? null;
  // anteriores = já venceram ou já foram pagas (as futuras ficam escondidas até chegar a vez)
  const anteriores = ciclos.filter((c) => c !== proximo && (c.vencimento < hoje || c.pago)).reverse();
  const listados = verTodas ? anteriores : anteriores.slice(0, 4);

  // Ao registrar um mês, congela o valor e o vencimento dele (reajustes depois não mexem)
  const registrar = (competencia: string, mud: Partial<RegistroMensalidade>) => {
    if (!m) return;
    const ciclo = ciclos.find((c) => c.competencia === competencia);
    const congelado = ciclo ? { valor: ciclo.valor, vencimento: ciclo.vencimento } : {};
    const existe = m.registros.find((r) => r.competencia === competencia);
    const registros = existe
      ? m.registros.map((r) => (r.competencia === competencia ? { ...congelado, ...r, ...mud } : r))
      : [...m.registros, { competencia, pago: false, ...congelado, ...mud }];
    salvar({ ...m, registros });
  };

  const ativa = mensalidadeAtiva(m, hoje);
  // Depois que a primeira cobrança venceu ou foi paga, valor e dia só mudam por reajuste "a partir de"
  const cobrancaIniciada = ciclos.some((c) => c.pago || c.vencimento <= hoje);
  const faixas = faixasMensalidade(m);
  const vigente = faixaDoMes(faixas, hoje.slice(0, 7));
  const futuras = faixas.filter((f) => f.desde > hoje.slice(0, 7));
  const mesesReajuste = Array.from({ length: 13 }, (_, i) => somarMeses(`${(proximo?.competencia ?? hoje.slice(0, 7))}-01`, i).slice(0, 7));

  /** Antes de começar a cobrar: editar valor/dia muda tudo (não há mês passado a preservar). */
  const editarDireto = (mud: { valor?: number | null; dia?: number; inicio?: string }) => {
    if (!m) return;
    const valor = mud.valor !== undefined ? mud.valor : m.valor;
    const dia = mud.dia ?? m.diaVencimento;
    const inicio = mud.inicio ?? m.inicio;
    salvar({ ...m, valor, diaVencimento: dia, inicio, faixas: valor == null ? undefined : [{ desde: inicio.slice(0, 7), valor, dia }] });
  };

  const salvarReajuste = () => {
    if (!m) return;
    const v = lerValor(reajuste.valor);
    const d = Number(reajuste.dia);
    if (v == null || Number.isNaN(v) || !(d >= 1 && d <= 31) || !reajuste.desde) return;
    salvar(reajustarMensalidade(m, reajuste.desde, v, d));
    setReajusteAberto(false);
  };

  return (
    <div className={p.bloco}>
      <label className={p.interruptorLinha}>
        <input
          type="checkbox"
          checked={!!m?.ativa}
          onChange={(e) => salvar({ ...base, ativa: e.target.checked, valor: base.valor ?? sugestao ?? null })}
        />
        <Repeat size={16} /> Ativar mensalidade recorrente
      </label>

      {m?.ativa && (
        <>
          <div className={p.grade3}>
            {cobrancaIniciada ? (
              <div className={p.campo}>
                <span>Valor mensal</span>
                <strong className={p.valorFixo}>{dinheiro(vigente?.valor ?? m.valor ?? 0)}</strong>
              </div>
            ) : (
              <label className={p.campo}>
                <span>Valor mensal (R$)</span>
                <input
                  inputMode="decimal"
                  value={valorTexto}
                  placeholder={sugestao != null ? String(sugestao).replace('.', ',') : '0,00'}
                  aria-invalid={Number.isNaN(lerValor(valorTexto))}
                  onChange={(e) => setValorTexto(e.target.value)}
                  onBlur={(e) => {
                    const v = lerValor(e.currentTarget.value);
                    if (!Number.isNaN(v) && v !== m.valor) editarDireto({ valor: v });
                  }}
                />
              </label>
            )}
            <label className={p.campo}>
              <span>Forma</span>
              <select value={m.forma} onChange={(e) => salvar({ ...m, forma: e.target.value as FormaPagamento })} aria-label="Forma de pagamento da mensalidade">
                {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMAS_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </label>
            {cobrancaIniciada ? (
              <div className={p.campo}>
                <span>Dia do vencimento</span>
                <strong className={p.valorFixo}>todo dia {vigente?.dia ?? m.diaVencimento}</strong>
              </div>
            ) : (
              <label className={p.campo}>
                <span>Dia do vencimento</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={m.diaVencimento}
                  key={`dia-${m.diaVencimento}`}
                  onBlur={(e) => {
                    const d = Number(e.currentTarget.value);
                    if (d >= 1 && d <= 31 && d !== m.diaVencimento) editarDireto({ dia: d });
                  }}
                />
              </label>
            )}
            <label className={p.campo}>
              <span>Início da cobrança</span>
              <input
                type="date"
                value={m.inicio}
                disabled={cobrancaIniciada}
                title={cobrancaIniciada ? 'A cobrança já começou: para mudar valor ou dia, use o reajuste' : undefined}
                onChange={(e) => e.target.value && editarDireto({ inicio: e.target.value })}
              />
            </label>
            <label className={p.campo}>
              <span>Encerramento (opcional)</span>
              <input type="date" value={m.fim ?? ''} min={m.inicio} onChange={(e) => salvar({ ...m, fim: e.target.value || undefined })} />
            </label>
            <label className={`${p.campo} ${p.campoLargo}`}>
              <span>Descrição</span>
              <input
                defaultValue={m.descricao ?? ''}
                key={`desc-${m.descricao ?? ''}`}
                placeholder="Ex.: Manutenção e suporte do CRM"
                onBlur={(e) => e.currentTarget.value.trim() !== (m.descricao ?? '') && salvar({ ...m, descricao: e.currentTarget.value.trim() || undefined })}
              />
            </label>
          </div>
          {!cobrancaIniciada && sugestao != null && m.valor !== sugestao && (
            <button type="button" className={p.linkAcao} onClick={() => { editarDireto({ valor: sugestao }); setValorTexto(String(sugestao).replace('.', ',')); }}>
              Usar a mensalidade do serviço ({dinheiro(sugestao)})
            </button>
          )}

          {cobrancaIniciada && (
            <div className={p.reajuste}>
              {futuras.map((f) => (
                <p key={f.desde} className={p.explica}>
                  <span>
                    Reajuste programado: a partir de <b>{nomeCompetencia(f.desde)}</b>, {dinheiro(f.valor)} todo dia {f.dia}.
                  </span>
                </p>
              ))}
              {reajusteAberto ? (
                <div className={p.cartaoPag}>
                  <div className={p.grade3}>
                    <label className={p.campo}>
                      <span>Novo valor (R$)</span>
                      <input
                        inputMode="decimal"
                        value={reajuste.valor}
                        aria-invalid={Number.isNaN(lerValor(reajuste.valor))}
                        onChange={(e) => setReajuste((r) => ({ ...r, valor: e.target.value }))}
                        autoFocus
                      />
                    </label>
                    <label className={p.campo}>
                      <span>Dia do vencimento</span>
                      <input type="number" min={1} max={31} value={reajuste.dia} onChange={(e) => setReajuste((r) => ({ ...r, dia: e.target.value }))} />
                    </label>
                    <label className={p.campo}>
                      <span>A partir de</span>
                      <select value={reajuste.desde} onChange={(e) => setReajuste((r) => ({ ...r, desde: e.target.value }))} aria-label="Mês a partir do qual vale o reajuste">
                        {mesesReajuste.map((mes) => (
                          <option key={mes} value={mes}>
                            {nomeCompetencia(mes)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className={p.explica}>
                    <span>Os meses anteriores continuam com o valor que tinham. Meses já pagos nunca mudam.</span>
                  </p>
                  <div className={p.acoesLinha}>
                    <button type="button" className={p.linkAcao} onClick={() => setReajusteAberto(false)}>
                      Cancelar
                    </button>
                    <button type="button" className={p.botaoPrimario} onClick={salvarReajuste} disabled={!lerValor(reajuste.valor) || Number.isNaN(lerValor(reajuste.valor))}>
                      Salvar reajuste
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={p.linkAcao}
                  onClick={() => {
                    setReajuste({
                      valor: String(vigente?.valor ?? m.valor ?? '').replace('.', ','),
                      dia: String(vigente?.dia ?? m.diaVencimento),
                      desde: mesesReajuste[0],
                    });
                    setReajusteAberto(true);
                  }}
                >
                  <Pencil size={13} /> Reajustar valor ou dia (vale a partir de um mês)
                </button>
              )}
            </div>
          )}

          <div className={p.mensalStatus}>
            <span className={ativa ? p.cPaga : p.cPend}>
              {m.pausadaEm ? `Pausada desde ${dataBr(m.pausadaEm)}` : m.fim && m.fim < hoje ? `Encerrada em ${dataBr(m.fim)}` : 'Ativa'}
            </span>
            {m.pausadaEm ? (
              <button type="button" className={p.linkAcao} onClick={() => salvar({ ...m, pausadaEm: undefined })}>
                <Play size={13} /> Retomar
              </button>
            ) : (
              <button type="button" className={p.linkAcao} onClick={() => window.confirm('Pausar a mensalidade? Não serão criadas novas cobranças até retomar.') && salvar({ ...m, pausadaEm: hoje })}>
                <Pause size={13} /> Pausar
              </button>
            )}
          </div>

          {m.valor == null ? (
            <p className={p.nota}>Informe o valor mensal para gerar as cobranças.</p>
          ) : (
            <>
              {proximo && (
                <div className={`${p.proximo}`}>
                  <CalendarClock size={16} />
                  <span>
                    Próximo vencimento: <b>{dataBr(proximo.vencimento)}</b> · {dinheiro(proximo.valor)} · {textoDias(diasAte(proximo.vencimento, hoje))}
                  </span>
                </div>
              )}
              <ul className={p.parcelas}>
                {(proximo ? [proximo, ...listados] : listados).map((c) => {
                  const sit = situacaoCobranca(c, hoje);
                  return (
                    <li key={c.competencia} className={`${p.parcela} ${p['sit-' + (sit === 'paga' ? 'paga' : sit === 'vencida' ? 'atrasada' : sit === 'hoje' || sit === 'proxima' ? 'proxima' : 'pendente')]}`}>
                      <div className={p.parcelaLinha}>
                        <strong>{nomeCompetencia(c.competencia)}</strong>
                        <span>{dinheiro(c.valor)}</span>
                        <span className={p.vencTexto}>vence {dataBr(c.vencimento)}</span>
                        <span className={p.situacao}>
                          {sit === 'paga' ? <CircleCheck size={14} /> : sit === 'vencida' ? <CircleAlert size={14} /> : <Clock size={14} />}
                          {sit === 'paga' ? `paga ${dataBr(c.pagoEm)}` : textoDias(diasAte(c.vencimento, hoje))}
                        </span>
                      </div>
                      <div className={p.parcelaLinha2}>
                        <label className={p.marcar}>
                          <input
                            type="checkbox"
                            checked={c.pago}
                            onChange={(e) => registrar(c.competencia, e.target.checked ? { pago: true, pagoEm: c.pagoEm ?? hoje } : { pago: false, pagoEm: undefined })}
                          />
                          Paga
                        </label>
                        {c.pago && (
                          <input
                            type="date"
                            className={p.dataParcela}
                            value={c.pagoEm ?? ''}
                            max={hoje}
                            aria-label={`Data do pagamento de ${nomeCompetencia(c.competencia)}`}
                            onChange={(e) => registrar(c.competencia, { pagoEm: e.target.value || hoje })}
                          />
                        )}
                        <Comprovante
                          compacto
                          comprovante={c.comprovante}
                          arquivos={arquivos}
                          rotulo={`mensalidade de ${nomeCompetencia(c.competencia)}`}
                          onMudar={(cp) => registrar(c.competencia, cp ? { comprovante: cp, pago: true, pagoEm: c.pagoEm ?? hoje } : { comprovante: undefined })}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {anteriores.length > 4 && (
                <button type="button" className={p.linkAcao} onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? 'Mostrar menos' : `Ver as ${anteriores.length} mensalidades anteriores`}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
