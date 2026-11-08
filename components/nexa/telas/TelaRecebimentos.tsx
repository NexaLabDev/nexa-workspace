'use client';

// ============================================
// RECEBIMENTOS — calendário do que a Nexa tem a receber
// ============================================
// Previsto, recebido, pendente e vencido no mês, juntando pagamentos à vista,
// entradas, parcelas e mensalidades de todos os clientes.
// "Recebido" é dinheiro que entrou (pela data do pagamento): não se soma às metas de vendas.
// ============================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronDown, CircleAlert, CircleCheck, Clock, Repeat, Wallet } from 'lucide-react';
import NexaShell from '../NexaShell';
import r from './recebimentos.module.css';
import { mesChave } from '../dados-exemplo';
import { useConversas, useLeads } from '../dados';
import { dataBr, dinheiro, hojeIso, receitaRecorrente, resumoRecebimentos, textoDias, diasAte, type ItemRecebimento } from '../financeiro';
import { nomeMes } from '../metas';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function opcoesDeMes(): string[] {
  const hoje = new Date();
  return Array.from({ length: 10 }, (_, i) => mesChave(new Date(hoje.getFullYear(), hoje.getMonth() - 4 + i, 1)));
}

export default function TelaRecebimentos() {
  const [leads] = useLeads();
  const [conversas] = useConversas();
  const [mes, setMes] = useState(() => mesChave(new Date()));
  const [diaFiltro, setDiaFiltro] = useState<string | null>(null);
  const hoje = hojeIso();

  const resumo = useMemo(() => resumoRecebimentos(leads, mes, hoje), [leads, mes, hoje]);
  const mrr = useMemo(() => receitaRecorrente(leads, mes, hoje), [leads, mes, hoje]);
  const meses = useMemo(opcoesDeMes, []);

  const linkDo = (leadId: string) =>
    conversas.some((c) => c.leadId === leadId) ? `/conversas?lead=${leadId}` : `/crm?lead=${leadId}`;

  // Calendário do mês
  const [ano, m] = mes.split('-').map(Number);
  const primeiroDia = new Date(ano, m - 1, 1).getDay();
  const diasNoMes = new Date(ano, m, 0).getDate();
  const porDia = new Map<string, ItemRecebimento[]>();
  resumo.itens.forEach((i) => porDia.set(i.dataReferencia, [...(porDia.get(i.dataReferencia) ?? []), i]));

  const lista = diaFiltro ? resumo.itens.filter((i) => i.dataReferencia === diaFiltro) : resumo.itens;
  const grupos: Array<[string, ItemRecebimento[]]> = [];
  lista.forEach((i) => {
    const g = grupos[grupos.length - 1];
    if (g && g[0] === i.dataReferencia) g[1].push(i);
    else grupos.push([i.dataReferencia, [i]]);
  });

  const chip = (i: ItemRecebimento) => {
    if (i.situacao === 'paga') return <span className={`${r.chip} ${r.chipPaga}`}><CircleCheck size={13} /> Recebido{i.pagoEm ? ` ${dataBr(i.pagoEm).slice(0, 5)}` : ''}</span>;
    if (i.situacao === 'vencida') return <span className={`${r.chip} ${r.chipVencida}`}><CircleAlert size={13} /> {textoDias(diasAte(i.vencimento as string, hoje))}</span>;
    if (i.situacao === 'hoje' || i.situacao === 'proxima') return <span className={`${r.chip} ${r.chipProxima}`}><Clock size={13} /> {textoDias(diasAte(i.vencimento as string, hoje))}</span>;
    return <span className={`${r.chip}`}><Clock size={13} /> {i.vencimento ? textoDias(diasAte(i.vencimento, hoje)) : 'a receber'}</span>;
  };

  return (
    <NexaShell aba="recebimentos">
      <div className={r.pagina}>
        <div className={r.cabecalho}>
          <span className={r.iconeTitulo} aria-hidden>
            <CalendarClock size={36} strokeWidth={1.8} />
          </span>
          <div className={r.titulo}>
            <h1>Recebimentos</h1>
            <p>O que a Nexa tem previsto para receber, o que já entrou e o que está pendente.</p>
          </div>
          <label className={r.seletorMes}>
            <select value={mes} onChange={(e) => { setMes(e.target.value); setDiaFiltro(null); }} aria-label="Mês">
              {meses.map((op) => (
                <option key={op} value={op}>
                  {nomeMes(op)}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden />
          </label>
        </div>

        <div className={r.numeros}>
          <div className={r.numero}>
            <Wallet size={26} />
            <div>
              <span>Previsto no mês</span>
              <strong>{dinheiro(resumo.previsto)}</strong>
            </div>
          </div>
          <div className={`${r.numero} ${r.numeroVerde}`}>
            <CircleCheck size={26} />
            <div>
              <span>Recebido</span>
              <strong>{dinheiro(resumo.recebido)}</strong>
            </div>
          </div>
          <div className={r.numero}>
            <Clock size={26} />
            <div>
              <span>Pendente</span>
              <strong>{dinheiro(resumo.pendente)}</strong>
            </div>
          </div>
          <div className={`${r.numero} ${resumo.vencido ? r.numeroAlerta : ''}`}>
            <CircleAlert size={26} />
            <div>
              <span>Vencido</span>
              <strong>{dinheiro(resumo.vencido)}</strong>
            </div>
          </div>
          <div className={r.numero}>
            <Repeat size={26} />
            <div>
              <span>Mensalidades ({mrr.clientes} {mrr.clientes === 1 ? 'cliente' : 'clientes'})</span>
              <strong>
                {dinheiro(mrr.recebido)} <small>de {dinheiro(mrr.previsto)}</small>
              </strong>
            </div>
          </div>
        </div>

        {resumo.atrasadasAntes.length > 0 && (
          <p className={r.alerta}>
            <CircleAlert size={16} /> {resumo.atrasadasAntes.length} cobrança(s) vencida(s) de meses anteriores somam{' '}
            {dinheiro(resumo.atrasadasAntes.reduce((s, c) => s + c.valor, 0))}:{' '}
            {resumo.atrasadasAntes.slice(0, 3).map((c, i) => (
              <span key={c.chave}>
                {i > 0 && ', '}
                <Link href={linkDo(c.leadId)}>
                  {c.cliente} ({c.rotulo})
                </Link>
              </span>
            ))}
            {resumo.atrasadasAntes.length > 3 ? '…' : ''}
          </p>
        )}

        <div className={r.corpo}>
          {/* ----- Calendário ----- */}
          <section className={r.calendario} aria-label="Calendário do mês">
            <div className={r.semana}>
              {SEMANA.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className={r.dias}>
              {Array.from({ length: primeiroDia }, (_, i) => (
                <span key={`v-${i}`} />
              ))}
              {Array.from({ length: diasNoMes }, (_, i) => {
                const dia = `${mes}-${String(i + 1).padStart(2, '0')}`;
                const itens = porDia.get(dia) ?? [];
                const total = itens.reduce((s, x) => s + x.valor, 0);
                const temVencida = itens.some((x) => x.situacao === 'vencida');
                const tudoPago = itens.length > 0 && itens.every((x) => x.pago);
                return (
                  <button
                    key={dia}
                    type="button"
                    className={`${r.dia} ${dia === hoje ? r.diaHoje : ''} ${diaFiltro === dia ? r.diaAtivo : ''} ${temVencida ? r.diaVencida : tudoPago ? r.diaPago : itens.length ? r.diaPrevisto : ''}`}
                    onClick={() => setDiaFiltro((d) => (d === dia ? null : dia))}
                    aria-pressed={diaFiltro === dia}
                    aria-label={`${dataBr(dia)}: ${itens.length ? `${itens.length} cobrança(s), ${dinheiro(total)}` : 'sem cobranças'}`}
                    disabled={!itens.length}
                  >
                    <b>{i + 1}</b>
                    {itens.length > 0 && <small>{total >= 1000 ? `${(total / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : dinheiro(total).replace(',00', '')}</small>}
                  </button>
                );
              })}
            </div>
            <p className={r.legenda}>
              <i className={r.lgPrevisto} /> previsto <i className={r.lgPago} /> recebido <i className={r.lgVencida} /> vencido
            </p>
          </section>

          {/* ----- Lista ----- */}
          <section className={r.lista} aria-label="Cobranças do mês">
            <header className={r.listaTopo}>
              <h2>{diaFiltro ? `Dia ${dataBr(diaFiltro)}` : 'Cobranças do mês'}</h2>
              {diaFiltro && (
                <button type="button" onClick={() => setDiaFiltro(null)}>
                  Ver o mês todo
                </button>
              )}
            </header>
            {grupos.length === 0 && <p className={r.vazio}>Nenhuma cobrança neste mês. Os pagamentos e mensalidades são registrados no painel do lead (Conversas ou CRM).</p>}
            {grupos.map(([dia, itens]) => (
              <div key={dia} className={r.grupo}>
                <p className={r.diaTitulo}>
                  {new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </p>
                <ul>
                  {itens.map((i) => (
                    <li key={i.chave}>
                      <Link href={linkDo(i.leadId)} className={r.item}>
                        <span className={r.itemTexto}>
                          <strong>{i.cliente}</strong>
                          <small>
                            {i.rotulo}
                            {i.tipo === 'mensalidade' ? ' · recorrente' : ''}
                          </small>
                        </span>
                        <b>{dinheiro(i.valor)}</b>
                        {chip(i)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {resumo.semData.length > 0 && (
              <div className={r.grupo}>
                <p className={r.diaTitulo}>A receber sem data definida</p>
                <ul>
                  {resumo.semData.map((i) => (
                    <li key={i.chave}>
                      <Link href={linkDo(i.leadId)} className={r.item}>
                        <span className={r.itemTexto}>
                          <strong>{i.cliente}</strong>
                          <small>{i.rotulo}</small>
                        </span>
                        <b>{dinheiro(i.valor)}</b>
                        <span className={r.chip}>aguardando pagamento</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </NexaShell>
  );
}
