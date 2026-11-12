'use client';

// ============================================
// PAINEL INICIAL — NEXA WORKSPACE
// ============================================
// Reproduz o layout aprovado (fundo de montanhas, vidro escuro, verde-limão).
// Relógio, data e saudação são reais; os demais números são de exemplo
// (ver components/nexa/dados-exemplo.ts).
// ============================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUp,
  Calculator,
  Calendar,
  FilePlus,
  Folder,
  Moon,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import NexaShell from '@/components/nexa/NexaShell';
import s from './dashboard.module.css';
import { agendaHoje, clima, indicadores, mesChave, usuario } from '@/components/nexa/dados-exemplo';
import { useDiasTrabalho, useMetas, useVendas } from '@/components/nexa/dados';
import { calcularResumoMeta } from '@/components/nexa/metas';
import { abrirMenuTopo } from '@/components/nexa/TopoAcoes';
import { reais } from '@/components/nexa/util';

function capitalizar(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatarData(d: Date): string {
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${capitalizar(semana)}, ${d.getDate()} de ${capitalizar(mes)}`;
}

function saudacao(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Relógio isolado: atualiza a cada segundo sem re-renderizar o restante do dashboard. */
function RelogioDashboard() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <section className={s.heroi}>
      <div className={s.relogio}>
        <time className={s.hora} suppressHydrationWarning>
          {hora}
        </time>
        <p className={s.data} suppressHydrationWarning>
          {formatarData(agora)}
        </p>
      </div>
      <div className={s.saudacao}>
        <h1 suppressHydrationWarning>
          {saudacao(agora)}, <span className={s.nome}>{usuario.nome}!</span>
        </h1>
        <p>Aqui está o resumo das suas atividades hoje.</p>
        <span className={s.sublinhado} aria-hidden />
      </div>
    </section>
  );
}

const ICONE = { strokeWidth: 1.7 } as const;

export default function DashboardNexa() {
  // Meta do mês: recalcula no máximo 1×/minuto (não a cada tick do relógio)
  const [agoraMeta, setAgoraMeta] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgoraMeta(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [vendas] = useVendas();
  const [metas] = useMetas();
  const [regra] = useDiasTrabalho();
  const meta = calcularResumoMeta(mesChave(agoraMeta), vendas, metas, regra, agoraMeta);

  const cartaoClima = (
    <section className={s.clima} aria-label="Clima">
      <Moon size={56} className={s.climaLua} fill="currentColor" strokeWidth={0} aria-hidden />
      <div className={s.climaTexto}>
        <span className={s.climaTemp}>{clima.temperatura}</span>
        <span>{clima.descricao}</span>
        <span>{clima.cidade}</span>
      </div>
    </section>
  );

  return (
    <NexaShell aba="dashboard" cantoDireito={cartaoClima}>
      <RelogioDashboard />

      <section className={s.indicadores} aria-label="Indicadores">
        <article className={s.cartao}>
          <Folder size={34} className={s.iconeVerde} {...ICONE} />
          <div>
            <h2>Projetos ativos</h2>
            <p className={s.valor}>
              {indicadores.projetosAtivos.valor}
              <span className={s.variacao}>
                <ArrowUp size={15} strokeWidth={2.2} />
                {indicadores.projetosAtivos.variacao}
              </span>
            </p>
          </div>
        </article>
        <article className={s.cartao}>
          <Users size={34} {...ICONE} />
          <div>
            <h2>Clientes</h2>
            <p className={s.valor}>
              {indicadores.clientes.valor}
              <span className={s.variacao}>
                <ArrowUp size={15} strokeWidth={2.2} />
                {indicadores.clientes.variacao}
              </span>
            </p>
          </div>
        </article>
        <article className={s.cartao}>
          <FilePlus size={34} {...ICONE} />
          <div>
            <h2>Propostas</h2>
            <p className={s.valor}>
              {indicadores.propostas.valor}
              <span className={s.variacao}>
                <ArrowUp size={15} strokeWidth={2.2} />
                {indicadores.propostas.variacao}
              </span>
            </p>
          </div>
        </article>
        <article className={`${s.cartao} ${s.cartaoBrilho}`}>
          <Target size={34} className={s.iconeVerde} {...ICONE} />
          <div>
            <h2>Faturamento (mês)</h2>
            <p className={`${s.valor} ${s.valorDinheiro}`}>{reais(meta.realizado)}</p>
          </div>
        </article>
      </section>

      <section className={s.paineis}>
        <article className={`${s.painel} ${s.agenda}`}>
          <header className={s.painelTopo}>
            <Calendar size={30} {...ICONE} />
            <h2>Agenda de Hoje</h2>
            <button type="button" className={s.verMais} onClick={() => abrirMenuTopo('agenda')}>
              Ver agenda <ArrowRight size={17} strokeWidth={2} />
            </button>
          </header>
          <ul className={s.agendaLista}>
            {agendaHoje.map((item) => (
              <li key={item.hora} className={s.agendaItem}>
                <span className={`${s.horario} ${item.destaque ? s.horarioAtivo : ''}`}>{item.hora}</span>
                <span className={s.linhaTempo} aria-hidden />
                <div className={s.agendaTexto}>
                  <strong>{item.titulo}</strong>
                  <span>{item.detalhe}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className={s.painel}>
          <header className={s.painelTopo}>
            <Users size={30} {...ICONE} />
            <h2>Ações do CRM</h2>
          </header>
          <div className={s.acoes}>
            <Link href="/clientes?novo=1" className={`${s.acao} ${s.acaoAtiva}`}>
              <UserPlus size={36} strokeWidth={1.6} />
              <span>
                Novo
                <br />
                cliente
              </span>
            </Link>
            <Link href="/documentos?novo=Proposta" className={s.acao}>
              <FilePlus size={36} strokeWidth={1.6} />
              <span>
                Nova
                <br />
                proposta
              </span>
            </Link>
            <Link href="/calculadora" className={s.acao}>
              <Calculator size={36} strokeWidth={1.6} />
              <span>
                Calcular
                <br />
                serviço
              </span>
            </Link>
          </div>
        </article>

        <article className={s.painel}>
          <header className={s.painelTopo}>
            <Target size={30} className={s.iconeVerde} {...ICONE} />
            <h2>Meta do mês</h2>
            <Link href="/metas" className={s.verMais}>
              Ver meta <ArrowRight size={17} strokeWidth={2} />
            </Link>
          </header>
          <div className={s.meta}>
            <span className={s.metaPct}>{meta.meta == null ? '—' : `${meta.percentual}%`}</span>
            <div className={s.metaValores}>
              <strong>{reais(meta.realizado)}</strong>
              <span>{meta.meta == null ? 'meta não definida' : `de ${reais(meta.meta)}`}</span>
            </div>
          </div>
          <div
            className={s.barra}
            role="progressbar"
            aria-valuenow={Math.min(100, meta.percentual)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Meta do mês"
          >
            <span style={{ width: `${Math.min(100, meta.percentual)}%` }} />
          </div>
        </article>
      </section>
    </NexaShell>
  );
}
