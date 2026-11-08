'use client';

// ============================================
// ABA META MENSAL
// ============================================
// Reproduz o layout "Meta Mensal". Tudo é calculado:
// - Realizado = vendas ganhas do mês (cartões levados para "Venda ganha" no CRM).
// - Meta diária = quanto falta ÷ dias de trabalho que restam no mês.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Info,
  Pencil,
  Repeat,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  UsersRound,
  Wallet,
} from 'lucide-react';
import NexaShell from '../NexaShell';
import Modal from '../Modal';
import u from '../ui.module.css';
import m from './metas.module.css';
import rc from './recebimentos.module.css';
import { useDiasTrabalho, useLeads, useMetas, useVendas } from '../dados';
import { indicadoresFinanceiros, receitaRecorrente } from '../financeiro';
import { mesChave, type DiasTrabalho } from '../dados-exemplo';
import { calcularResumoMeta, nomeMes, NOMES_DIAS_TRABALHO, reaisCentavos } from '../metas';
import { reais } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;

function opcoesDeMes(): string[] {
  const hoje = new Date();
  const lista: string[] = [];
  for (let i = -6; i <= 3; i++) lista.push(mesChave(new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)));
  return lista;
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor == null) return null;
  const negativa = valor < 0;
  return (
    <span className={`${m.selo} ${negativa ? m.seloNegativo : ''}`}>
      {negativa ? <ArrowDown size={15} strokeWidth={2.4} /> : <ArrowUp size={15} strokeWidth={2.4} />}
      {valor > 0 ? '+' : ''}
      {valor}%
    </span>
  );
}

export default function TelaMetas() {
  const [vendas] = useVendas();
  const [leads] = useLeads();
  const [metas, setMetas] = useMetas();
  const [regra, setRegra] = useDiasTrabalho();
  const [mes, setMes] = useState(() => mesChave(new Date()));
  const [editando, setEditando] = useState(false);
  const [infoAberta, setInfoAberta] = useState(false);
  const info = useRef<HTMLDivElement>(null);

  // Atualiza o "hoje" a cada minuto (virada do dia muda a meta diária)
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (info.current && !info.current.contains(e.target as Node)) setInfoAberta(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const r = useMemo(() => calcularResumoMeta(mes, vendas, metas, regra, agora), [mes, vendas, metas, regra, agora]);
  const mrr = useMemo(() => receitaRecorrente(leads, mes), [leads, mes]);
  const fin = useMemo(() => indicadoresFinanceiros(leads, vendas, mes), [leads, vendas, mes]);
  const meses = useMemo(opcoesDeMes, []);

  // Anel de progresso
  const raio = 96;
  const circ = 2 * Math.PI * raio;
  const fracao = Math.min(1, r.meta ? r.realizado / r.meta : 0);

  // Escala do gráfico: múltiplos de R$ 10 mil acima da meta e do maior acumulado
  const maiorValor = Math.max(r.meta ?? 0, ...r.semanas.map((s) => s.acumulado ?? 0), 10000);
  const passo = maiorValor > 100000 ? 25000 : 10000;
  const topo = Math.ceil((maiorValor * 1.15) / passo) * passo;
  const linhas = Array.from({ length: topo / passo + 1 }, (_, i) => topo - i * passo);
  const ultimaComValor = r.semanas.reduce((acc, s, i) => (s.acumulado != null ? i : acc), -1);

  const textoSituacao = {
    'sem-meta': { titulo: 'Defina a meta do mês', sub: 'Sem meta, não há como calcular a meta diária.' },
    batida: { titulo: 'Meta batida!', sub: 'Você alcançou a meta deste mês.' },
    'no-ritmo': { titulo: 'Meta em andamento', sub: 'Você está no caminho certo!' },
    abaixo: { titulo: 'Meta em andamento', sub: 'O ritmo está abaixo do necessário. Vale acelerar.' },
  }[r.situacao];

  return (
    <NexaShell aba="metas">
      <div className={m.pagina}>
        {/* ----- Cabeçalho ----- */}
        <div className={m.cabecalho}>
          <span className={m.iconeTitulo} aria-hidden>
            <Target size={38} strokeWidth={1.8} />
          </span>
          <div className={m.titulo}>
            <h1>Meta Mensal</h1>
            <p>Acompanhe sua meta de vendas e o progresso em tempo real.</p>
          </div>
          <label className={m.seletorMes}>
            <CalendarDays size={22} {...ICONE} aria-hidden />
            <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
              {meses.map((op) => (
                <option key={op} value={op}>
                  {nomeMes(op)}
                </option>
              ))}
            </select>
            <ChevronDown size={20} strokeWidth={2} aria-hidden />
          </label>
        </div>

        {/* ----- Linha 1 ----- */}
        <div className={m.linha1}>
          <section className={`${m.cartao} ${m.cartaoAnel}`} aria-label="Progresso da meta">
            <div className={m.anel}>
              <svg viewBox="0 0 240 240" aria-hidden>
                <defs>
                  <linearGradient id="nx-anel" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#d9fb4c" />
                    <stop offset="1" stopColor="#a8e010" />
                  </linearGradient>
                </defs>
                <circle cx="120" cy="120" r={raio} className={m.anelTrilho} />
                <circle
                  cx="120"
                  cy="120"
                  r={raio}
                  className={m.anelValor}
                  strokeDasharray={`${circ * fracao} ${circ}`}
                  transform="rotate(-90 120 120)"
                />
              </svg>
              <div className={m.anelTexto}>
                <strong>{r.meta ? `${r.percentual}%` : '—'}</strong>
                <span>da meta</span>
              </div>
            </div>
            <div className={m.anelDados}>
              <div>
                <span className={m.rotulo}>
                  Meta mensal
                  <button type="button" className={m.editar} onClick={() => setEditando(true)} aria-label="Editar meta do mês">
                    <Pencil size={15} />
                  </button>
                </span>
                <strong className={m.valorGrande}>{r.meta == null ? 'Não definida' : reais(r.meta)}</strong>
              </div>
              <div>
                <span className={m.rotulo}>Realizado</span>
                <strong className={`${m.valorMedio} ${m.verde}`}>{reais(r.realizado)}</strong>
              </div>
              <div>
                <span className={m.rotulo}>Falta</span>
                <strong className={`${m.valorMedio} ${m.cinza}`}>{r.meta == null ? '—' : reais(r.falta)}</strong>
              </div>
            </div>
          </section>

          <div className={m.gradeMini}>
            <article className={m.cartao}>
              <Trophy size={40} className={m.icone} {...ICONE} />
              <div className={m.miniTexto}>
                <span>Vendas ganhas</span>
                <strong>{r.vendas}</strong>
              </div>
              <Variacao valor={r.variacaoVendas} />
            </article>
            <article className={m.cartao}>
              <UsersRound size={40} className={m.icone} {...ICONE} />
              <div className={m.miniTexto}>
                <span>Ticket médio</span>
                <strong>{reais(r.ticketMedio)}</strong>
              </div>
              <Variacao valor={r.variacaoTicket} />
            </article>
            <article className={m.cartao}>
              <CalendarDays size={40} className={m.icone} {...ICONE} />
              <div className={m.miniTexto}>
                <span>Meta diária (automática)</span>
                <strong>{r.metaDiaria == null ? '—' : reaisCentavos(r.metaDiaria)}</strong>
              </div>
              <div className={m.infoCaixa} ref={info}>
                <button
                  type="button"
                  className={m.info}
                  onClick={() => setInfoAberta((v) => !v)}
                  aria-label="Como a meta diária é calculada"
                  aria-expanded={infoAberta}
                >
                  <Info size={26} strokeWidth={1.6} />
                </button>
                {infoAberta && (
                  <div className={m.infoBalao} role="dialog" aria-label="Como a meta diária é calculada">
                    <strong>Como é calculada</strong>
                    <p>
                      {r.meta == null
                        ? 'Defina a meta do mês para calcular.'
                        : `Falta ${reais(r.falta)} ÷ ${r.diasRestantes} ${r.diasRestantes === 1 ? 'dia' : 'dias'} de trabalho restantes${r.mesAtual ? ' (contando hoje)' : ''}.`}
                    </p>
                    <p>Ela se atualiza sozinha a cada venda ganha no CRM.</p>
                    <label className={u.campo}>
                      <span>Dias de trabalho</span>
                      <select className={u.entrada} value={regra} onChange={(e) => setRegra(e.target.value as DiasTrabalho)}>
                        {(Object.keys(NOMES_DIAS_TRABALHO) as DiasTrabalho[]).map((k) => (
                          <option key={k} value={k}>
                            {NOMES_DIAS_TRABALHO[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </article>
            <article className={`${m.cartao} ${m.cartaoBrilho}`}>
              <CalendarCheck size={40} className={m.icone} {...ICONE} />
              <div className={m.miniTexto}>
                <span>Realizado hoje</span>
                <strong>{r.mesAtual ? reais(r.realizadoHoje) : '—'}</strong>
              </div>
              <Variacao valor={r.variacaoHoje} />
            </article>
          </div>
        </div>

        {/* ----- Linha 2 ----- */}
        <div className={m.linha2}>
          <section className={`${m.cartao} ${m.grafico}`} aria-label="Evolução no mês">
            <h2>Evolução no mês</h2>
            <div className={m.graficoArea}>
              <div className={m.eixoY} aria-hidden>
                {linhas.map((v) => (
                  <span key={v}>{v === 0 ? 'R$ 0' : `R$ ${v / 1000}k`}</span>
                ))}
              </div>
              <div className={m.plot}>
                {linhas.map((v) => (
                  <span key={v} className={m.grade} style={{ bottom: `${(v / topo) * 100}%` }} aria-hidden />
                ))}
                {r.meta != null && (
                  <div className={m.linhaMeta} style={{ bottom: `${(r.meta / topo) * 100}%` }}>
                    <span>Meta: {reais(r.meta)}</span>
                  </div>
                )}
                <div className={m.barras} role="list">
                  {r.semanas.map((s, i) => (
                    <div key={s.rotulo} className={m.colunaBarra} role="listitem" aria-label={`${s.rotulo}: ${s.acumulado == null ? 'ainda não chegou' : reais(s.acumulado)}`}>
                      {s.acumulado != null && (
                        <div
                          className={`${m.barra} ${i === ultimaComValor ? m.barraAtual : ''}`}
                          style={{ height: `${(s.acumulado / topo) * 100}%` }}
                        >
                          <span className={m.rotuloBarra}>{reais(s.acumulado)}</span>
                        </div>
                      )}
                      <span className={m.semana}>{s.rotulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className={m.legenda}>Valor acumulado de vendas ganhas até o fim de cada semana.</p>
          </section>

          <section className={`${m.cartao} ${m.andamento}`} aria-label="Situação da meta">
            <header className={m.andamentoTopo}>
              <span className={m.andamentoIcone} aria-hidden>
                <TrendingUp size={34} strokeWidth={2} />
              </span>
              <div>
                <h2>{textoSituacao.titulo}</h2>
                <p>{textoSituacao.sub}</p>
              </div>
            </header>
            <ul className={m.andamentoLista}>
              <li>
                <Target size={26} {...ICONE} /> Meta mensal <strong>{r.meta == null ? '—' : reais(r.meta)}</strong>
              </li>
              <li>
                <CircleCheck size={26} {...ICONE} /> Realizado <strong>{reais(r.realizado)}</strong>
              </li>
              <li>
                <Timer size={26} {...ICONE} /> Falta para bater <strong>{r.meta == null ? '—' : reais(r.falta)}</strong>
              </li>
              <li>
                <CalendarDays size={26} {...ICONE} /> Meta diária atual{' '}
                <strong>{r.metaDiaria == null ? '—' : reaisCentavos(r.metaDiaria)}</strong>
              </li>
            </ul>
            <Link href="/crm" className={m.irCrm}>
              Registrar vendas no CRM →
            </Link>
          </section>
        </div>

        {/* ----- Financeiro do mês: quatro visões separadas, das mesmas cobranças de Recebimentos ----- */}
        <section aria-label="Financeiro do mês" className={m.financeiro}>
          <div className={m.financeiroTopo}>
            <h2>Financeiro de {nomeMes(mes)}</h2>
            <p>Vendas fechadas é o valor dos contratos; recebido é o dinheiro que entrou. São visões diferentes e não se somam.</p>
          </div>
          <div className={`${rc.numeros} ${rc.numeros4}`}>
            <div className={rc.numero}>
              <Trophy size={26} {...ICONE} />
              <div>
                <span>Vendas fechadas</span>
                <strong>{reais(fin.vendasFechadas)}</strong>
                <small>{fin.qtdVendas} venda(s) no mês</small>
              </div>
            </div>
            <div className={`${rc.numero} ${rc.numeroVerde}`}>
              <CircleCheck size={26} {...ICONE} />
              <div>
                <span>Valores recebidos</span>
                <strong>{reais(fin.recebido)}</strong>
                <small>pagamentos com data no mês</small>
              </div>
            </div>
            <div className={`${rc.numero} ${fin.vencidoTotal ? rc.numeroAlerta : ''}`}>
              <Wallet size={26} {...ICONE} />
              <div>
                <span>Valores a receber</span>
                <strong>{reais(fin.aReceberMes)}</strong>
                <small>
                  no mês · {reais(fin.aReceberTotal)} em aberto{fin.vencidoTotal ? ` (${reais(fin.vencidoTotal)} vencido)` : ''}
                </small>
              </div>
            </div>
            <div className={rc.numero}>
              <Repeat size={26} {...ICONE} />
              <div>
                <span>Receita recorrente</span>
                <strong>{reais(fin.recorrente.previsto)}</strong>
                <small>{fin.recorrente.clientes} cliente(s) com mensalidade ativa</small>
              </div>
            </div>
          </div>
        </section>

        {/* ----- Receita recorrente: só acompanhamento, separada da meta de vendas ----- */}
        <section className={`${m.cartao} ${m.recorrente}`} aria-label="Receita recorrente">
          <span className={m.recorrenteIcone} aria-hidden>
            <Repeat size={24} strokeWidth={2} />
          </span>
          <div className={m.recorrenteTexto}>
            <h2>Receita recorrente (mensalidades)</h2>
            <p>Acompanhamento separado: não entra na meta de vendas de projetos acima.</p>
          </div>
          <div className={m.recorrenteNumeros}>
            <div>
              <span>Clientes ativos</span>
              <strong>{mrr.clientes}</strong>
            </div>
            <div>
              <span>Previsto no mês</span>
              <strong>{reais(mrr.previsto)}</strong>
            </div>
            <div>
              <span>Recebido no mês</span>
              <strong className={m.verde}>{reais(mrr.recebido)}</strong>
            </div>
          </div>
          <Link href="/recebimentos" className={m.irCrm}>
            Ver recebimentos →
          </Link>
        </section>
      </div>

      {editando && (
        <ModalMeta
          mes={mes}
          atual={r.meta}
          onFechar={() => setEditando(false)}
          onSalvar={(valor) => {
            setMetas((atuais) => {
              const novo = { ...atuais };
              if (valor == null) delete novo[mes];
              else novo[mes] = valor;
              return novo;
            });
            setEditando(false);
          }}
        />
      )}
    </NexaShell>
  );
}

function ModalMeta({
  mes,
  atual,
  onFechar,
  onSalvar,
}: {
  mes: string;
  atual: number | null;
  onFechar: () => void;
  onSalvar: (valor: number | null) => void;
}) {
  const [texto, setTexto] = useState(atual == null ? '' : String(atual));
  const numero = texto.trim() ? Number(texto.replace(/\./g, '').replace(',', '.')) : null;
  const valido = numero == null || (Number.isFinite(numero) && numero > 0);

  return (
    <Modal
      titulo={`Meta de ${nomeMes(mes)}`}
      descricao="Valor total de vendas que você quer fechar no mês. Deixe vazio para remover a meta."
      onFechar={onFechar}
      textoEnviar="Salvar meta"
      podeEnviar={valido}
      onEnviar={() => onSalvar(numero == null ? null : Math.round(numero))}
    >
      <label className={u.campo}>
        <span>Meta do mês (R$)</span>
        <input
          className={u.entrada}
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 50.000"
          autoFocus
        />
      </label>
    </Modal>
  );
}
