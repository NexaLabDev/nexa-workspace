// ============================================
// PÁGINA DO CLIENTE — "Acompanhamento do seu projeto"
// ============================================
// Pública (o cliente abre pelo link). Reproduz o layout aprovado.
// Mostra só nome do projeto, fase, progresso e data. Montada no servidor.
// ============================================

import { CalendarDays, Check, CircleCheck, ClipboardList, CodeXml, FlaskConical, Info, Layers, MessageSquareText, type LucideIcon } from 'lucide-react';
import a from './acompanhamento.module.css';
import { etapasProjeto } from '../dados-exemplo';
import type { RetratoProjeto } from '../acompanhamento';

const ICONE_FASE: Record<string, LucideIcon> = {
  planejamento: ClipboardList,
  desenvolvimento: CodeXml,
  testes: FlaskConical,
  concluido: CircleCheck,
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  const fuso = 'America/Sao_Paulo';
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: fuso });
  const mes = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: fuso }).replace('.', '');
  const ano = d.toLocaleDateString('pt-BR', { year: 'numeric', timeZone: fuso });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: fuso });
  return `${dia} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${ano} às ${hora}`;
}

function Ondas({ posicao }: { posicao: 'topo' | 'base' }) {
  return (
    <svg className={posicao === 'topo' ? a.ondaTopo : a.ondaBase} viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`onda-${posicao}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b6f01e" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c4f03a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#b6f01e" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {posicao === 'topo' ? (
        <>
          <path d="M0 60 C 90 110, 160 20, 260 70 S 360 40, 400 20" fill="none" stroke={`url(#onda-${posicao})`} strokeWidth="2" />
          <path d="M0 80 C 110 120, 190 40, 280 85 S 370 60, 400 45" fill="none" stroke={`url(#onda-${posicao})`} strokeWidth="1" opacity="0.5" />
        </>
      ) : (
        <>
          <path d="M0 70 C 90 20, 170 110, 260 60 S 360 90, 400 40" fill="none" stroke={`url(#onda-${posicao})`} strokeWidth="2" />
          <path d="M0 90 C 110 40, 190 120, 280 80 S 370 100, 400 65" fill="none" stroke={`url(#onda-${posicao})`} strokeWidth="1" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

export default function TelaAcompanhamento({ retrato, erro }: { retrato: RetratoProjeto | null; erro?: string }) {
  if (!retrato) {
    return (
      <main className={a.pagina}>
        <Ondas posicao="topo" />
        <div className={a.coluna}>
          <Marca />
          <section className={a.cartao} style={{ marginTop: 40, textAlign: 'center', padding: 32 }}>
            <h1 className={a.tituloErro}>Link inválido</h1>
            <p className={a.subtitulo}>{erro ?? 'Este link de acompanhamento está incompleto. Peça um novo link à equipe da Nexa Lab.'}</p>
          </section>
        </div>
      </main>
    );
  }

  const indice = etapasProjeto.findIndex((e) => e.id === retrato.etapa);
  const atual = etapasProjeto[indice];
  const proxima = etapasProjeto[indice + 1];
  const IconeAtual = ICONE_FASE[atual.id] ?? Layers;
  const concluido = atual.id === 'concluido';

  return (
    <main className={a.pagina}>
      <Ondas posicao="topo" />
      <div className={a.coluna}>
        <Marca />

        <header className={a.cabecalho}>
          <h1>
            Acompanhamento do seu <span>projeto</span>
          </h1>
          <p className={a.subtitulo}>Acompanhe o andamento do seu projeto.</p>
        </header>

        <section className={`${a.cartao} ${a.linha}`}>
          <span className={a.iconeCaixa}>
            <Layers size={34} strokeWidth={1.8} />
          </span>
          <span className={a.divisor} aria-hidden />
          <div>
            <small>Projeto</small>
            <strong className={a.nomeProjeto}>{retrato.nome}</strong>
          </div>
        </section>

        <section className={a.cartao}>
          {retrato.progresso == null ? (
            <div className={a.progressoTopo}>
              <span>Progresso geral</span>
              <strong className={a.progressoIndisponivel}>Progresso ainda não disponível</strong>
            </div>
          ) : (
            <>
              <div className={a.progressoTopo}>
                <span>Progresso geral</span>
                <strong>{retrato.progresso}%</strong>
              </div>
              <div
                className={a.barra}
                role="progressbar"
                aria-valuenow={retrato.progresso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso geral"
              >
                <i style={{ width: `${retrato.progresso}%` }} />
              </div>
              <p className={a.progressoBase}>
                {retrato.base === 'tarefas' ? 'Calculado pelas tarefas do projeto já concluídas.' : 'Estimado pela fase atual do projeto.'}
              </p>
            </>
          )}
        </section>

        <ol className={a.linhaTempo}>
          {etapasProjeto.map((e, i) => {
            const feito = i <= indice;
            const eAtual = i === indice;
            return (
              <li key={e.id} className={`${feito ? a.feito : ''} ${eAtual ? a.atual : ''}`} aria-current={eAtual ? 'step' : undefined}>
                <span className={a.marcador} aria-hidden>
                  {feito && <Check size={20} strokeWidth={3} />}
                </span>
                <div>
                  <strong>{e.nome}</strong>
                  <p>{e.descricao}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <section className={`${a.cartao} ${a.linha} ${a.status}`}>
          <span className={`${a.iconeCaixa} ${a.iconeGrande}`}>
            <IconeAtual size={40} strokeWidth={2} />
          </span>
          <span className={a.divisor} aria-hidden />
          <div>
            <small>Status atual</small>
            <strong className={a.statusNome}>{atual.nome}</strong>
            <p>{atual.descricao}</p>
          </div>
        </section>

        <section className={`${a.cartao} ${a.linha} ${a.compacto}`}>
          <CalendarDays size={34} strokeWidth={1.6} className={a.iconeSolto} />
          <span className={a.divisor} aria-hidden />
          <div>
            <small>Última atualização</small>
            <strong>{formatarData(retrato.atualizadoEm)}</strong>
          </div>
        </section>

        <section className={`${a.cartao} ${a.linha} ${a.compacto}`}>
          <Info size={34} strokeWidth={1.6} className={a.iconeSolto} />
          <span className={a.divisor} aria-hidden />
          <div>
            <small>Próxima etapa</small>
            <strong>{concluido || !proxima ? 'Projeto entregue' : proxima.nome}</strong>
          </div>
        </section>

        {retrato.observacao && (
          <section className={`${a.cartao} ${a.linha} ${a.compacto}`}>
            <MessageSquareText size={34} strokeWidth={1.6} className={a.iconeSolto} />
            <span className={a.divisor} aria-hidden />
            <div>
              <small>Recado da equipe</small>
              <p className={a.recado}>{retrato.observacao}</p>
            </div>
          </section>
        )}
      </div>
      <Ondas posicao="base" />
    </main>
  );
}

function Marca() {
  return (
    <div className={a.marca}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dashboard/simbolo-nexa.png" alt="" />
      <span>Nexa Lab</span>
    </div>
  );
}
