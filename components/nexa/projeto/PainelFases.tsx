'use client';

// Painel fixo à direita (cartão): andamento do projeto.
// Fase atual · Avançar · lista de fases (clique numa fase para mover direto) · Voltar
// · Progresso (por fase ou por tarefas — nunca ajustado à mão) · responsável, datas e dias restantes.
// As fases são as do Kanban: mudar aqui atualiza o card e o link do cliente na hora.

import { ArrowLeft, ArrowRight, CalendarCheck, CalendarDays, Check, Flag, Infinity as Sempre, UserRound } from 'lucide-react';
import j from './janela.module.css';
import { useJanela } from './salvamento';
import { CampoData, CampoTexto } from './campos';
import { etapasProjeto } from '../dados-exemplo';
import { mudarFaseProjeto, nomeEtapaProjeto } from '../dados';
import { dataBr } from '../financeiro';
import { mudarModoProgresso, progressoPorTarefas } from '../tarefas';
import { infoPrazo } from './prazo';

export default function PainelFases({ responsaveis }: { responsaveis: string[] }) {
  const { projeto, salvar, salvarComAtividade, autor } = useJanela();
  const idx = Math.max(
    0,
    etapasProjeto.findIndex((e) => e.id === projeto.etapa),
  );
  const atual = etapasProjeto[idx];
  const anterior = etapasProjeto[idx - 1];
  const proxima = etapasProjeto[idx + 1];
  const concluido = atual?.id === etapasProjeto[etapasProjeto.length - 1].id;
  const prazo = infoPrazo(projeto.prazoEntrega, concluido);
  const modo = projeto.modoProgresso ?? 'fase';
  const porTarefas = progressoPorTarefas(projeto);
  const pct = modo === 'fase' ? (atual?.progresso ?? projeto.progresso) : porTarefas.pct;

  const irPara = (etapa: string) => etapa !== projeto.etapa && salvar((p) => mudarFaseProjeto(p, etapa, autor), 'fase');

  return (
    <aside className={j.painel} aria-label="Andamento do projeto">
      <h3 className={j.painelTitulo}>
        <Flag size={17} aria-hidden /> Fase atual
      </h3>
      <span className={j.fase} style={{ ['--cor-fase' as string]: atual?.cor ?? '#a8a8a8' }}>
        {atual?.nome ?? nomeEtapaProjeto(projeto.etapa)}
      </span>
      <p className={j.faseDescricao}>{atual?.descricao}</p>

      <button type="button" className={j.btnFaseAvancar} disabled={!proxima} onClick={() => proxima && irPara(proxima.id)}>
        {proxima ? (
          <>
            Avançar para {proxima.nome} <ArrowRight size={16} aria-hidden />
          </>
        ) : (
          <>
            <Check size={16} aria-hidden /> Última fase
          </>
        )}
      </button>

      <ol className={j.etapas} aria-label="Fases do projeto (clique para mover)">
        {etapasProjeto.map((e, i) => (
          <li key={e.id} className={i < idx ? j.etapaFeita : i === idx ? j.etapaAtual : ''}>
            <button
              type="button"
              onClick={() => irPara(e.id)}
              aria-current={i === idx ? 'step' : undefined}
              title={i === idx ? 'Fase atual' : `Mover para ${e.nome}`}
            >
              <i aria-hidden />
              <span>{e.nome}</span>
              <small>{e.progresso}%</small>
            </button>
          </li>
        ))}
      </ol>
      {anterior && (
        <button type="button" className={j.linkAcao} onClick={() => irPara(anterior.id)}>
          <ArrowLeft size={14} aria-hidden /> Voltar para {anterior.nome}
        </button>
      )}

      <hr className={j.painelDivisor} />

      <div className={j.progressoTopo}>
        <span id="rotulo-progresso">Progresso</span>
        {pct != null && <b>{pct}%</b>}
      </div>
      <div className={j.modoProgresso} role="group" aria-labelledby="rotulo-progresso">
        {(['fase', 'tarefas'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() =>
              modo !== m &&
              salvarComAtividade(
                (p) => mudarModoProgresso(p, m),
                'dado',
                `Progresso agora é calculado ${m === 'fase' ? 'pela fase do Kanban' : 'pelas tarefas concluídas'}`,
                'modo-progresso',
              )
            }
          >
            {m === 'fase' ? 'Por fase' : 'Por tarefas'}
          </button>
        ))}
      </div>
      {pct != null ? (
        <div className={j.barra} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do projeto">
          <i style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <small className={j.campoDica}>
        {modo === 'fase'
          ? 'Percentual fixo de cada fase (não é ajustado à mão).'
          : porTarefas.total
            ? `${porTarefas.concluidas} de ${porTarefas.total} tarefas concluídas. Concluir tarefas não muda a fase.`
            : 'Ainda não há tarefas: o percentual aparece quando a primeira for criada.'}
      </small>

      <div className={j.painelCampos}>
        <CampoTexto
          id="responsavel"
          rotulo="Responsável"
          valor={projeto.responsavel ?? ''}
          placeholder="Adicionar responsável"
          maxLength={80}
          lista={responsaveis}
          lateral={<UserRound size={18} />}
          aplicar={(t) => (p) => ({ ...p, responsavel: t || undefined })}
          registro={{ tipo: 'responsavel', texto: (a, d) => (d ? `Responsável: ${a || 'ninguém'} → ${d}` : `Responsável removido (era ${a})`) }}
        />
        <CampoData
          id="inicio"
          rotulo="Data de início"
          valor={projeto.inicio ?? ''}
          lateral={<CalendarDays size={18} />}
          aplicar={(t) => (p) => ({ ...p, inicio: t || undefined })}
          registro={{ tipo: 'dado', texto: (a, d) => `Início: ${a ? dataBr(a) : 'sem data'} → ${d ? dataBr(d) : 'sem data'}` }}
        />
        <CampoData
          id="prazo"
          rotulo="Prazo de entrega"
          valor={projeto.prazoEntrega ?? ''}
          lateral={<Flag size={18} />}
          aplicar={(t) => (p) => ({ ...p, prazoEntrega: t || undefined })}
          registro={{ tipo: 'dado', texto: (a, d) => `Prazo de entrega: ${a ? dataBr(a) : 'sem data'} → ${d ? dataBr(d) : 'sem data'}` }}
        />
        <div className={j.diasRestantes} data-tom={prazo.tom}>
          <CalendarCheck size={20} aria-hidden />
          <div>
            <span>Dias restantes</span>
            <strong>{prazo.texto}</strong>
          </div>
        </div>
      </div>

      {concluido && (
        <p className={j.notaConcluido}>
          <Sempre size={16} aria-hidden /> Concluir o projeto não encerra o cliente nem as cobranças recorrentes: elas continuam até serem pausadas ou
          encerradas.
        </p>
      )}
    </aside>
  );
}
