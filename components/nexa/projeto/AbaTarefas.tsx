'use client';

// ============================================
// ABA TAREFAS — gerenciador de atividades do projeto
// ============================================
// Grupos por serviço contratado + tarefas gerais (+ serviços que saíram do projeto).
// Edição direta, conclusão com um clique, subtarefas, anexos e comentários.
// Tudo passa pelo salvamento automático da janela e vai para a aba Atividades.
// Concluir tarefas NÃO muda a fase do Kanban nem encerra o projeto.
// Nada daqui aparece no link público do cliente.
// ============================================

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Eye,
  ListChecks,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import j from './janela.module.css';
import t from './tarefas.module.css';
import { useJanela } from './salvamento';
import { CampoData, CampoLista, CampoTexto } from './campos';
import { PRIORIDADES } from './AbaFicha';
import type { ServicoProjeto, SituacaoTarefa, TarefaProjeto } from '../dados-exemplo';
import { diasPrazoProximo, useCategoriasArquivos, usePreferencias, useServicos } from '../dados';
import { nomeServicoProjeto, copiarChecklistPara } from '../projetos';
import {
  SITUACOES_TAREFA,
  adicionarSubtarefa,
  adicionarTarefa,
  alterarSubtarefa,
  atualizarTarefa,
  definirSituacao,
  estadoTarefa,
  gruposDeTarefas,
  moverTarefa,
  mudarServicoTarefa,
  nomeSituacao,
  novaTarefa,
  ordenarTarefas,
  progressoPorTarefas,
  removerSubtarefa,
  removerTarefa,
  subtarefasPendentesObrigatorias,
  textoPrazoTarefa,
  type CriterioOrdem,
  type GrupoTarefas,
} from '../tarefas';
import { apagarArquivo, baixarArquivo } from '../arquivos';
import { CATEGORIA_PADRAO, desvincularTarefa, entradaDoAnexo, versaoAtual, vincularTarefa } from '../biblioteca';
import { prepararEnvio } from './envio';
import Previa from './Previa';
import { dataBr } from '../financeiro';

/** Estado de tela da aba (fica na janela: trocar de aba não perde filtros nem tarefas abertas) */
export type EstadoTelaTarefas = {
  situacao: 'todas' | 'abertas' | SituacaoTarefa;
  servico: string;
  responsavel: string;
  ordem: CriterioOrdem;
  ocultarConcluidas: boolean;
  recolhidos: Record<string, boolean>;
  abertas: Record<string, boolean>;
};

export const ESTADO_TELA_TAREFAS: EstadoTelaTarefas = {
  situacao: 'todas',
  servico: 'todos',
  responsavel: 'todos',
  ordem: 'manual',
  ocultarConcluidas: false,
  recolhidos: {},
  abertas: {},
};

const SEM_RESPONSAVEL = '__sem__';

function dataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AbaTarefas({
  responsaveis,
  tela,
  setTela,
}: {
  responsaveis: string[];
  tela: EstadoTelaTarefas;
  setTela: (f: (e: EstadoTelaTarefas) => EstadoTelaTarefas) => void;
}) {
  const { projeto, salvarComAtividade, autor } = useJanela();
  const [catalogo] = useServicos();
  const [prefs] = usePreferencias();
  const diasProx = diasPrazoProximo(prefs);
  const nomeSp = (sp: ServicoProjeto) => nomeServicoProjeto(sp, catalogo);
  const grupos = gruposDeTarefas(projeto, nomeSp);
  const todas = projeto.tarefasProjeto ?? [];
  const prog = progressoPorTarefas(projeto);
  const estados = todas.map((x) => estadoTarefa(x, undefined, diasProx).estado);
  const vencidas = estados.filter((e) => e === 'vencida').length;
  const proximas = estados.filter((e) => e === 'proxima').length;
  const bloqueadas = todas.filter((x) => x.situacao === 'bloqueada').length;
  const pessoas = useMemo(
    () => Array.from(new Set([...responsaveis, ...todas.map((x) => x.responsavel ?? '')].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [responsaveis, todas]
  );
  const filtrando = tela.situacao !== 'todas' || tela.servico !== 'todos' || tela.responsavel !== 'todos' || tela.ocultarConcluidas;
  const podeMover = tela.ordem === 'manual' && !filtrando;

  const passa = (x: TarefaProjeto) => {
    if (tela.ocultarConcluidas && x.situacao === 'concluida') return false;
    if (tela.situacao === 'abertas' && x.situacao === 'concluida') return false;
    if (tela.situacao !== 'todas' && tela.situacao !== 'abertas' && x.situacao !== tela.situacao) return false;
    if (tela.responsavel === SEM_RESPONSAVEL && x.responsavel) return false;
    if (tela.responsavel !== 'todos' && tela.responsavel !== SEM_RESPONSAVEL && x.responsavel !== tela.responsavel) return false;
    return true;
  };

  const mudar = (mud: Partial<EstadoTelaTarefas>) => setTela((e) => ({ ...e, ...mud }));

  return (
    <div className={j.aba}>
      <div className={t.resumo}>
        <div className={t.resumoProgresso}>
          <strong>{prog.total ? `${prog.concluidas} de ${prog.total} tarefas concluídas` : 'Nenhuma tarefa ainda'}</strong>
          {prog.pct != null && (
            <div className={t.barra} aria-hidden>
              <i style={{ width: `${prog.pct}%` }} />
            </div>
          )}
          <small className={j.campoDica}>
            {(projeto.modoProgresso ?? 'fase') === 'tarefas'
              ? 'O progresso do projeto está seguindo as tarefas (painel ao lado).'
              : 'O progresso do projeto está seguindo a fase. Dá para trocar no painel ao lado.'}{' '}
            Concluir tarefas não muda a fase.
          </small>
        </div>
        <div className={t.contadores}>
          {vencidas > 0 && (
            <button type="button" className={t.contVencida} onClick={() => mudar({ situacao: 'abertas', ordem: 'prazo', ocultarConcluidas: false })}>
              <AlertTriangle size={14} aria-hidden /> {vencidas} vencida{vencidas > 1 ? 's' : ''}
            </button>
          )}
          {proximas > 0 && (
            <button type="button" className={t.contProxima} onClick={() => mudar({ situacao: 'abertas', ordem: 'prazo' })}>
              <CalendarClock size={14} aria-hidden /> {proximas} com prazo próximo{diasProx > 0 ? ` (até ${diasProx} dia${diasProx > 1 ? 's' : ''})` : ' (hoje)'}
            </button>
          )}
          {bloqueadas > 0 && (
            <button type="button" className={t.contBloqueada} onClick={() => mudar({ situacao: 'bloqueada' })}>
              {bloqueadas} bloqueada{bloqueadas > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      <div className={t.barraFiltros} role="group" aria-label="Filtros e ordem das tarefas">
        <label>
          <span>Situação</span>
          <select className={j.seletor} value={tela.situacao} onChange={(e) => mudar({ situacao: e.target.value as EstadoTelaTarefas['situacao'] })}>
            <option value="todas">Todas</option>
            <option value="abertas">Não concluídas</option>
            {SITUACOES_TAREFA.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Serviço</span>
          <select className={j.seletor} value={tela.servico} onChange={(e) => mudar({ servico: e.target.value })}>
            <option value="todos">Todos</option>
            {grupos.map((g) => (
              <option key={g.chave} value={g.chave}>
                {g.titulo}
                {g.removido ? ' (fora do projeto)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Responsável</span>
          <select className={j.seletor} value={tela.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })}>
            <option value="todos">Todos</option>
            <option value={SEM_RESPONSAVEL}>Sem responsável</option>
            {pessoas.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ordenar</span>
          <select className={j.seletor} value={tela.ordem} onChange={(e) => mudar({ ordem: e.target.value as CriterioOrdem })}>
            <option value="manual">Ordem manual</option>
            <option value="prazo">Prazo</option>
            <option value="prioridade">Prioridade</option>
            <option value="situacao">Situação</option>
            <option value="responsavel">Responsável</option>
          </select>
        </label>
        <label className={j.marcarLinha}>
          <input type="checkbox" checked={tela.ocultarConcluidas} onChange={(e) => mudar({ ocultarConcluidas: e.target.checked })} />
          <span>Ocultar concluídas</span>
        </label>
        {filtrando && (
          <button type="button" className={j.linkAcao} onClick={() => mudar({ situacao: 'todas', servico: 'todos', responsavel: 'todos', ocultarConcluidas: false })}>
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>
      {!podeMover && (
        <small className={j.campoDica}>
          Para reordenar com as setas,{' '}
          {tela.ordem !== 'manual' ? (
            <button type="button" className={j.linkAcao} onClick={() => mudar({ ordem: 'manual' })}>
              volte para a ordem manual
            </button>
          ) : null}
          {tela.ordem !== 'manual' && filtrando ? ' e ' : ''}
          {filtrando ? 'limpe os filtros' : ''}.
        </small>
      )}

      {grupos
        .filter((g) => tela.servico === 'todos' || g.chave === tela.servico)
        .map((g) => (
          <Grupo
            key={g.chave}
            grupo={g}
            visiveis={ordenarTarefas(g.tarefas.filter(passa), tela.ordem)}
            recolhido={!!tela.recolhidos[g.chave]}
            onRecolher={() => setTela((e) => ({ ...e, recolhidos: { ...e.recolhidos, [g.chave]: !e.recolhidos[g.chave] } }))}
            abertas={tela.abertas}
            onAbrir={(id) => setTela((e) => ({ ...e, abertas: { ...e.abertas, [id]: !e.abertas[id] } }))}
            podeMover={podeMover}
            pessoas={pessoas}
            onCopiarChecklist={(sp) => {
              const servico = catalogo.find((s) => s.id === sp.servicoId);
              if (!servico?.checklist?.length) return;
              salvarComAtividade((p) => copiarChecklistPara(p, sp.id, servico, new Date(), autor), 'tarefa', `Checklist padrão de ${nomeSp(sp)} copiado para as tarefas (${servico.checklist.length} itens)`);
            }}
            checklistDisponivel={(sp) => (!sp.checklist && catalogo.find((s) => s.id === sp.servicoId)?.checklist?.length) || 0}
          />
        ))}
    </div>
  );
}

// ---------- Grupo (serviço ou gerais) ----------

function Grupo({
  grupo,
  visiveis,
  recolhido,
  onRecolher,
  abertas,
  onAbrir,
  podeMover,
  pessoas,
  onCopiarChecklist,
  checklistDisponivel,
}: {
  grupo: GrupoTarefas;
  visiveis: TarefaProjeto[];
  recolhido: boolean;
  onRecolher: () => void;
  abertas: Record<string, boolean>;
  onAbrir: (id: string) => void;
  podeMover: boolean;
  pessoas: string[];
  onCopiarChecklist: (sp: ServicoProjeto) => void;
  checklistDisponivel: (sp: ServicoProjeto) => number;
}) {
  const { salvarComAtividade, autor, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const feitas = grupo.tarefas.filter((x) => x.situacao === 'concluida').length;
  const idNova = `nova-tarefa:${grupo.chave}`;
  const textoNova = rascunho(idNova) ?? '';
  const disponivel = grupo.sp ? checklistDisponivel(grupo.sp) : 0;

  const criar = () => {
    const titulo = textoNova.trim();
    if (!titulo) return;
    const nova = novaTarefa({ titulo, servico: grupo.sp }, autor);
    if (salvarComAtividade((p) => adicionarTarefa(p, nova), 'tarefa', `Tarefa criada: “${nova.titulo}” (${grupo.titulo})`)) descartarRascunho(idNova);
  };

  return (
    <section className={t.grupo} aria-labelledby={`grupo-${grupo.chave}`}>
      <div className={t.grupoTopo}>
        <button type="button" className={t.grupoBotao} onClick={onRecolher} aria-expanded={!recolhido}>
          <ChevronDown size={16} className={recolhido ? t.setaFechada : ''} aria-hidden />
          <h3 id={`grupo-${grupo.chave}`}>{grupo.titulo}</h3>
          {grupo.sp?.principal && <span className={j.seloPrincipal}>Principal</span>}
          {grupo.removido && <span className={t.seloRemovido}>fora do projeto</span>}
          <span className={t.grupoConta}>
            {feitas}/{grupo.tarefas.length}
          </span>
        </button>
        {grupo.sp && disponivel > 0 && (
          <button type="button" className={j.linkAcao} onClick={() => onCopiarChecklist(grupo.sp!)}>
            <ListChecks size={14} /> Copiar checklist padrão ({disponivel})
          </button>
        )}
      </div>
      {!recolhido && (
        <>
          {grupo.removido && (
            <p className={j.campoDica}>Este serviço saiu do projeto. As tarefas continuam aqui; para mudar de grupo, abra a tarefa e escolha outro serviço.</p>
          )}
          {visiveis.length ? (
            <ol className={t.lista}>
              {visiveis.map((x, i) => (
                <LinhaTarefa
                  key={x.id}
                  tarefa={x}
                  grupo={grupo}
                  aberta={!!abertas[x.id]}
                  onAbrir={() => onAbrir(x.id)}
                  podeSubir={podeMover && i > 0}
                  podeDescer={podeMover && i < visiveis.length - 1}
                  pessoas={pessoas}
                />
              ))}
            </ol>
          ) : (
            <p className={t.vazio}>{grupo.tarefas.length ? 'Nenhuma tarefa com esses filtros.' : 'Nenhuma tarefa neste grupo.'}</p>
          )}
          {!grupo.removido && (
            <div className={t.novaTarefa}>
              <Plus size={15} aria-hidden />
              <label className={j.somenteLeitor} htmlFor={idNova}>
                Nova tarefa em {grupo.titulo}
              </label>
              <input
                id={idNova}
                value={textoNova}
                maxLength={200}
                placeholder={`Nova tarefa${grupo.sp ? ` em ${grupo.titulo}` : ' geral'} (Enter para criar)`}
                onChange={(e) => mudarRascunho(idNova, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    criar();
                  }
                }}
              />
              {textoNova.trim() && (
                <button type="button" className={j.btnLima} onClick={criar}>
                  Criar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Tarefa ----------

function useAcoesTarefa(tarefa: TarefaProjeto) {
  const { salvarComAtividade } = useJanela();
  const mudarSituacao = (nova: SituacaoTarefa) => {
    if (nova === tarefa.situacao) return;
    if (nova === 'concluida') {
      const pend = subtarefasPendentesObrigatorias(tarefa);
      if (
        pend.length &&
        !window.confirm(
          `“${tarefa.titulo}” tem ${pend.length} subtarefa${pend.length > 1 ? 's' : ''} obrigatória${pend.length > 1 ? 's' : ''} pendente${pend.length > 1 ? 's' : ''}: ${pend.map((s) => s.texto).join('; ')}.\n\nConcluir a tarefa mesmo assim?`
        )
      )
        return;
      return salvarComAtividade(
        (p) => definirSituacao(p, tarefa.id, 'concluida'),
        'tarefa',
        `Tarefa concluída: “${tarefa.titulo}”${pend.length ? ` (confirmado com ${pend.length} subtarefa${pend.length > 1 ? 's' : ''} obrigatória${pend.length > 1 ? 's' : ''} pendente${pend.length > 1 ? 's' : ''})` : ''}`
      );
    }
    salvarComAtividade(
      (p) => definirSituacao(p, tarefa.id, nova),
      'tarefa',
      tarefa.situacao === 'concluida' ? `Tarefa reaberta: “${tarefa.titulo}” (${nomeSituacao(nova)})` : `Tarefa “${tarefa.titulo}”: ${nomeSituacao(tarefa.situacao)} → ${nomeSituacao(nova)}`
    );
  };
  return { mudarSituacao };
}

const CLASSE_ESTADO: Record<string, string> = {
  vencida: t.estVencida,
  proxima: t.estProxima,
  concluida: t.estConcluida,
  bloqueada: t.estBloqueada,
};

function LinhaTarefa({
  tarefa,
  grupo,
  aberta,
  onAbrir,
  podeSubir,
  podeDescer,
  pessoas,
}: {
  tarefa: TarefaProjeto;
  grupo: GrupoTarefas;
  aberta: boolean;
  onAbrir: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
  pessoas: string[];
}) {
  const { salvar } = useJanela();
  const { mudarSituacao } = useAcoesTarefa(tarefa);
  const [prefs] = usePreferencias();
  const diasProx = diasPrazoProximo(prefs);
  const { estado, dias } = estadoTarefa(tarefa, undefined, diasProx);
  const subs = tarefa.subtarefas ?? [];
  const subsFeitas = subs.filter((s) => s.feita).length;
  const concluida = tarefa.situacao === 'concluida';
  const prioridade = PRIORIDADES.find((x) => x.id === tarefa.prioridade);

  return (
    <li className={`${t.tarefa} ${CLASSE_ESTADO[estado] ?? ''}`} data-tarefa={tarefa.id}>
      <div className={t.linha}>
        <button
          type="button"
          className={`${t.concluir} ${concluida ? t.concluirFeito : ''}`}
          onClick={() => mudarSituacao(concluida ? 'pendente' : 'concluida')}
          aria-label={concluida ? `Reabrir tarefa ${tarefa.titulo}` : `Concluir tarefa ${tarefa.titulo}`}
          aria-pressed={concluida}
        >
          {concluida && <Check size={13} strokeWidth={3} />}
        </button>
        <button type="button" className={t.titulo} onClick={onAbrir} aria-expanded={aberta}>
          <span className={concluida ? t.riscado : ''}>{tarefa.titulo}</span>
        </button>
        <div className={t.meta}>
          {tarefa.situacao === 'bloqueada' && <span className={t.chipBloqueada}>Bloqueada</span>}
          {tarefa.situacao === 'andamento' && <span className={t.chipAndamento}>Em andamento</span>}
          {prioridade && (prioridade.id === 'alta' || prioridade.id === 'urgente') && <span className={t.chipPrioridade}>{prioridade.nome}</span>}
          {subs.length > 0 && (
            <span className={t.metaItem} title="Subtarefas feitas">
              <ListChecks size={13} aria-hidden /> {subsFeitas}/{subs.length}
            </span>
          )}
          {(tarefa.anexos?.length ?? 0) > 0 && (
            <span className={t.metaItem} title="Anexos">
              <Paperclip size={13} aria-hidden /> {tarefa.anexos!.length}
            </span>
          )}
          {(tarefa.comentarios?.length ?? 0) > 0 && (
            <span className={t.metaItem} title="Comentários">
              <MessageSquare size={13} aria-hidden /> {tarefa.comentarios!.length}
            </span>
          )}
          {tarefa.responsavel && (
            <span className={t.metaItem}>
              <UserRound size={13} aria-hidden /> {tarefa.responsavel}
            </span>
          )}
          {tarefa.prazo && (
            <span
              className={t.prazo}
              data-estado={concluida ? 'concluida' : dias != null && dias < 0 ? 'vencida' : dias != null && dias <= diasProx ? 'proxima' : estado}
            >
              <CalendarClock size={13} aria-hidden /> {dataBr(tarefa.prazo)}
              {!concluida && ` · ${textoPrazoTarefa(dias)}`}
            </span>
          )}
        </div>
        <div className={t.acoes}>
          <button
            type="button"
            className={t.btnMini}
            disabled={!podeSubir}
            aria-label={`Subir ${tarefa.titulo}`}
            onClick={() => salvar((p) => moverTarefa(p, tarefa.id, -1), `ordem:${tarefa.id}`)}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className={t.btnMini}
            disabled={!podeDescer}
            aria-label={`Descer ${tarefa.titulo}`}
            onClick={() => salvar((p) => moverTarefa(p, tarefa.id, 1), `ordem:${tarefa.id}`)}
          >
            <ArrowDown size={14} />
          </button>
          <button type="button" className={t.btnMini} onClick={onAbrir} aria-label={aberta ? 'Recolher detalhes' : 'Abrir detalhes'} aria-expanded={aberta}>
            <ChevronDown size={15} className={aberta ? t.setaAberta : ''} />
          </button>
        </div>
      </div>
      {aberta && <DetalheTarefa tarefa={tarefa} grupo={grupo} pessoas={pessoas} />}
    </li>
  );
}

function DetalheTarefa({ tarefa, pessoas }: { tarefa: TarefaProjeto; grupo: GrupoTarefas; pessoas: string[] }) {
  const { projeto, salvarComAtividade } = useJanela();
  const [catalogo] = useServicos();
  const { mudarSituacao } = useAcoesTarefa(tarefa);
  const id = tarefa.id;
  const tt = `“${tarefa.titulo}”`;
  const servicos = projeto.servicos ?? [];

  const excluir = () => {
    const extras = [tarefa.subtarefas?.length ? `${tarefa.subtarefas.length} subtarefa(s)` : '', tarefa.comentarios?.length ? `${tarefa.comentarios.length} comentário(s)` : '']
      .filter(Boolean)
      .join(' e ');
    const anexos = tarefa.anexos?.length ? ` Os ${tarefa.anexos.length} anexo(s) continuam na aba Anexos.` : '';
    if (!window.confirm(`Excluir a tarefa ${tt}?${extras ? ` ${extras} também serão excluídos.` : ''}${anexos}`)) return;
    salvarComAtividade((p) => removerTarefa(p, id), 'tarefa', `Tarefa excluída: ${tt}`);
  };

  return (
    <div className={t.detalhe}>
      <div className={t.situacoes} role="group" aria-label="Situação da tarefa">
        {SITUACOES_TAREFA.map((s) => (
          <button key={s.id} type="button" className={`${t.situacao} ${tarefa.situacao === s.id ? t.situacaoAtiva : ''}`} data-situacao={s.id} aria-pressed={tarefa.situacao === s.id} onClick={() => mudarSituacao(s.id)}>
            {s.nome}
          </button>
        ))}
      </div>
      <div className={j.grade}>
        <CampoTexto
          id={`t-titulo:${id}`}
          rotulo="Título"
          valor={tarefa.titulo}
          obrigatorio
          largo
          maxLength={200}
          aplicar={(x) => (p) => atualizarTarefa(p, id, { titulo: x })}
          registro={{ tipo: 'tarefa', texto: (a, d) => `Tarefa renomeada: “${a}” → “${d}”` }}
        />
        <CampoTexto
          id={`t-resp:${id}`}
          rotulo="Responsável"
          valor={tarefa.responsavel ?? ''}
          placeholder="Sem responsável"
          maxLength={80}
          lista={pessoas}
          aplicar={(x) => (p) => atualizarTarefa(p, id, { responsavel: x || undefined })}
          registro={{ tipo: 'responsavel', texto: (a, d) => `Tarefa ${tt}: responsável ${a || 'ninguém'} → ${d || 'ninguém'}` }}
        />
        <CampoData
          id={`t-prazo:${id}`}
          rotulo="Prazo"
          valor={tarefa.prazo ?? ''}
          aplicar={(x) => (p) => atualizarTarefa(p, id, { prazo: x || undefined })}
          registro={{ tipo: 'tarefa', texto: (a, d) => `Tarefa ${tt}: prazo ${a ? dataBr(a) : 'sem prazo'} → ${d ? dataBr(d) : 'sem prazo'}` }}
        />
        <CampoLista
          id={`t-prio:${id}`}
          rotulo="Prioridade"
          valor={tarefa.prioridade ?? ''}
          opcoes={PRIORIDADES}
          aplicar={(x) => (p) => atualizarTarefa(p, id, { prioridade: (x || undefined) as TarefaProjeto['prioridade'] })}
          registro={{ tipo: 'tarefa', texto: (a, d) => `Tarefa ${tt}: prioridade ${a} → ${d}` }}
        />
        <CampoLista
          id={`t-serv:${id}`}
          rotulo="Serviço"
          valor={tarefa.servicoProjetoId && servicos.some((s) => s.id === tarefa.servicoProjetoId) ? tarefa.servicoProjetoId : ''}
          opcoes={servicos.map((s) => ({ id: s.id, nome: nomeServicoProjeto(s, catalogo) }))}
          textoVazio={tarefa.servicoProjetoId ? `${tarefa.servicoNome ?? 'Serviço'} (fora do projeto)` : 'Tarefa geral (sem serviço)'}
          aplicar={(x) => (p) => mudarServicoTarefa(p, id, (p.servicos ?? []).find((s) => s.id === x))}
          registro={{ tipo: 'tarefa', texto: (a, d) => `Tarefa ${tt} movida: ${a} → ${d}` }}
        />
        <div className={`${j.campo} ${j.campoInfo}`}>
          <span className={j.campoRotulo}>Conclusão</span>
          <span className={j.infoValor}>{tarefa.concluidaEm ? dataHora(tarefa.concluidaEm) : 'Não concluída'}</span>
          <small className={j.campoDica}>
            Criada em {dataHora(tarefa.criadaEm)}
            {tarefa.criadaPor ? ` por ${tarefa.criadaPor.nome}${tarefa.criadaPor.autenticado ? '' : ' (não autenticado)'}` : tarefa.origem ? ' a partir do checklist do serviço' : ''}
          </small>
        </div>
        <CampoTexto
          id={`t-desc:${id}`}
          rotulo="Descrição"
          valor={tarefa.descricao ?? ''}
          area
          maxLength={4000}
          aplicar={(x) => (p) => atualizarTarefa(p, id, { descricao: x || undefined })}
          registro={{ tipo: 'tarefa', texto: () => `Tarefa ${tt}: descrição atualizada` }}
        />
      </div>

      <Subtarefas tarefa={tarefa} onConcluirTarefa={() => mudarSituacao('concluida')} />
      <AnexosTarefa tarefa={tarefa} />
      <ComentariosTarefa tarefa={tarefa} />

      <div className={t.rodapeDetalhe}>
        <button type="button" className={j.excluir} onClick={excluir}>
          <Trash2 size={14} /> Excluir tarefa
        </button>
      </div>
    </div>
  );
}

// ---------- Subtarefas ----------

function Subtarefas({ tarefa, onConcluirTarefa }: { tarefa: TarefaProjeto; onConcluirTarefa: () => void }) {
  const { salvar, salvarComAtividade, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const subs = tarefa.subtarefas ?? [];
  const feitas = subs.filter((s) => s.feita).length;
  const idNova = `nova-sub:${tarefa.id}`;
  const nova = rascunho(idNova) ?? '';
  const tt = `“${tarefa.titulo}”`;

  const criar = () => {
    if (!nova.trim()) return;
    if (salvarComAtividade((p) => adicionarSubtarefa(p, tarefa.id, nova), 'tarefa', `Subtarefa adicionada em ${tt}: “${nova.trim()}”`)) descartarRascunho(idNova);
  };

  const salvarTexto = (subId: string, original: string) => {
    const r = rascunho(`sub:${subId}`);
    if (r === undefined) return;
    const limpo = r.trim();
    if (!limpo || limpo === original) return descartarRascunho(`sub:${subId}`);
    if (salvar((p) => alterarSubtarefa(p, tarefa.id, subId, { texto: limpo.slice(0, 200) }), `sub:${subId}`)) descartarRascunho(`sub:${subId}`);
  };

  return (
    <div className={t.secao}>
      <h4>
        Subtarefas {subs.length > 0 && <span className={t.secaoConta}>{feitas} de {subs.length} feitas</span>}
      </h4>
      {subs.length > 0 && (
        <ul className={t.subs}>
          {subs.map((s) => (
            <li key={s.id} className={s.feita ? t.subFeita : ''}>
              <input
                type="checkbox"
                checked={s.feita}
                aria-label={`${s.feita ? 'Desmarcar' : 'Marcar'} subtarefa ${s.texto}`}
                onChange={(e) =>
                  salvarComAtividade(
                    (p) => alterarSubtarefa(p, tarefa.id, s.id, { feita: e.target.checked }),
                    'tarefa',
                    e.target.checked ? `Subtarefa feita em ${tt}: “${s.texto}”` : `Subtarefa reaberta em ${tt}: “${s.texto}”`
                  )
                }
              />
              <input
                className={t.subTexto}
                value={rascunho(`sub:${s.id}`) ?? s.texto}
                maxLength={200}
                aria-label="Texto da subtarefa"
                onChange={(e) => mudarRascunho(`sub:${s.id}`, e.target.value)}
                onBlur={() => salvarTexto(s.id, s.texto)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              <button
                type="button"
                className={`${t.obrig} ${s.obrigatoria ? t.obrigAtiva : ''}`}
                aria-pressed={s.obrigatoria}
                title="Obrigatória: concluir a tarefa com ela pendente pede confirmação"
                onClick={() =>
                  salvarComAtividade(
                    (p) => alterarSubtarefa(p, tarefa.id, s.id, { obrigatoria: !s.obrigatoria }),
                    'tarefa',
                    `Subtarefa “${s.texto}” em ${tt}: ${s.obrigatoria ? 'deixou de ser obrigatória' : 'agora é obrigatória'}`
                  )
                }
              >
                Obrigatória
              </button>
              <button
                type="button"
                className={t.btnMini}
                aria-label={`Remover subtarefa ${s.texto}`}
                onClick={() => salvarComAtividade((p) => removerSubtarefa(p, tarefa.id, s.id), 'tarefa', `Subtarefa removida de ${tt}: “${s.texto}”`)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {subs.length > 0 && feitas === subs.length && tarefa.situacao !== 'concluida' && (
        <p className={t.dicaConcluir}>
          Todas as subtarefas estão feitas.{' '}
          <button type="button" className={j.linkAcao} onClick={onConcluirTarefa}>
            <Check size={14} /> Concluir a tarefa
          </button>
        </p>
      )}
      <div className={t.novaSub}>
        <label className={j.somenteLeitor} htmlFor={idNova}>
          Nova subtarefa
        </label>
        <input
          id={idNova}
          value={nova}
          maxLength={200}
          placeholder="Nova subtarefa (Enter para adicionar)"
          onChange={(e) => mudarRascunho(idNova, e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              criar();
            }
          }}
        />
      </div>
    </div>
  );
}

// ---------- Anexos da tarefa ----------

function AnexosTarefa({ tarefa }: { tarefa: TarefaProjeto }) {
  const { projeto, salvarComAtividade, autor } = useJanela();
  const [categorias] = useCategoriasArquivos();
  const entrada = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [previa, setPrevia] = useState<{ arquivoId: string; nome: string; titulo: string } | null>(null);
  const anexos = tarefa.anexos ?? [];
  const tt = `“${tarefa.titulo}”`;
  const naBiblioteca = (projeto.arquivos ?? []).filter((x) => !anexos.some((an) => an.arquivoProjetoId === x.id));

  // Envia pela biblioteca do projeto: conteúdo repetido não vira cópia nova (só o vínculo)
  const enviar = async (lista: File[]) => {
    setMsg(null);
    setEnviando(true);
    try {
      const plano = await prepararEnvio(lista, { projeto, categoria: CATEGORIA_PADRAO, categorias, autor, tarefaId: tarefa.id });
      const erros = plano.resultados.filter((r) => r.situacao === 'erro');
      if (plano.resumo.length) {
        const ok = salvarComAtividade(plano.transformar, 'arquivo', `Arquivo anexado à tarefa ${tt}: ${plano.resumo.join(', ')}`);
        if (!ok) {
          for (const id of plano.conteudosNovos) await apagarArquivo(id).catch(() => undefined);
          return setMsg({ texto: 'Não foi possível salvar o anexo neste navegador. Nada foi alterado; tente de novo.', erro: true });
        }
      }
      const reaproveitados = plano.resultados.filter((r) => r.situacao === 'reaproveitado');
      if (erros.length) setMsg({ texto: erros.map((r) => `${r.nome}: ${r.mensagem}`).join(' '), erro: true });
      else if (reaproveitados.length) setMsg({ texto: reaproveitados.map((r) => r.mensagem).join(' ') });
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const desvincular = (an: (typeof anexos)[number]) => {
    const ent = entradaDoAnexo(projeto, an);
    if (!window.confirm(`Tirar “${ent?.nome ?? an.nome}” desta tarefa? O arquivo continua na aba Anexos (e nas outras tarefas que o usam).`)) return;
    if (ent) salvarComAtividade((p) => desvincularTarefa(p, ent.id, tarefa.id), 'arquivo', `Arquivo “${ent.nome}” desvinculado da tarefa ${tt} (continua na biblioteca)`);
    else salvarComAtividade((p) => atualizarTarefa(p, tarefa.id, (x) => ({ ...x, anexos: (x.anexos ?? []).filter((y) => y.id !== an.id) })), 'arquivo', `Anexo “${an.nome}” desvinculado da tarefa ${tt}`);
  };

  return (
    <div className={t.secao}>
      <h4>
        Anexos {anexos.length > 0 && <span className={t.secaoConta}>{anexos.length}</span>}
      </h4>
      {anexos.length > 0 && (
        <ul className={t.anexos}>
          {anexos.map((an) => {
            const ent = entradaDoAnexo(projeto, an);
            const v = ent ? versaoAtual(ent) : undefined;
            const arquivoId = v?.arquivoId ?? an.arquivoId;
            const nomeArquivo = v?.nomeOriginal ?? an.nome;
            return (
              <li key={an.id}>
                <Paperclip size={14} aria-hidden />
                <span>
                  {ent?.nome ?? an.nome}
                  {ent && ent.versoes.length > 1 ? ` · v${v!.numero}` : ''}
                  <small>
                    {an.tamanho ? `${an.tamanho} · ` : ''}
                    vinculado em {dataHora(an.em)} · {an.autor.nome}
                    {an.autor.autenticado ? '' : ' (não autenticado)'}
                    {ent && (ent.tarefas ?? []).length > 1 ? ` · também em ${(ent.tarefas ?? []).length - 1} outra(s) tarefa(s)` : ''}
                  </small>
                </span>
                <button type="button" className={t.btnMini} onClick={() => setPrevia({ arquivoId, nome: nomeArquivo, titulo: ent?.nome ?? an.nome })} aria-label={`Visualizar ${an.nome}`}>
                  <Eye size={14} />
                </button>
                <button type="button" className={t.btnMini} onClick={() => baixarArquivo(arquivoId, nomeArquivo)} aria-label={`Baixar ${an.nome}`}>
                  <Download size={14} />
                </button>
                <button type="button" className={t.btnMini} onClick={() => desvincular(an)} aria-label={`Desvincular ${an.nome}`}>
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={entrada}
        type="file"
        multiple
        hidden
        aria-label={`Anexar arquivos à tarefa ${tarefa.titulo}`}
        onChange={(e) => {
          const l = Array.from(e.target.files ?? []);
          if (l.length) enviar(l);
        }}
      />
      <div className={t.anexoAcoes}>
        <button type="button" className={j.linkAcao} onClick={() => entrada.current?.click()} disabled={enviando}>
          <Paperclip size={14} /> {enviando ? 'Guardando…' : 'Anexar arquivo'}
        </button>
        {naBiblioteca.length > 0 && (
          <>
            <label className={j.somenteLeitor} htmlFor={`da-biblioteca-${tarefa.id}`}>
              Usar arquivo da biblioteca
            </label>
            <select id={`da-biblioteca-${tarefa.id}`} className={j.seletor} value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              <option value="">Usar arquivo da biblioteca…</option>
              {naBiblioteca.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={j.btnContorno}
              disabled={!escolhido}
              onClick={() => {
                const x = naBiblioteca.find((y) => y.id === escolhido);
                if (x && salvarComAtividade((p) => vincularTarefa(p, x.id, tarefa.id, autor), 'arquivo', `Arquivo “${x.nome}” vinculado à tarefa ${tt}`)) setEscolhido('');
              }}
            >
              Vincular
            </button>
          </>
        )}
      </div>
      {msg && (
        <p className={msg.erro ? j.campoMsgErro : j.campoDica} role={msg.erro ? 'alert' : 'status'}>
          {msg.texto}
        </p>
      )}
      {previa && <Previa {...previa} onFechar={() => setPrevia(null)} />}
    </div>
  );
}

// ---------- Comentários da tarefa ----------

function ComentariosTarefa({ tarefa }: { tarefa: TarefaProjeto }) {
  const { salvarComAtividade, autor, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const idCom = `t-com:${tarefa.id}`;
  const texto = rascunho(idCom) ?? '';
  const lista = tarefa.comentarios ?? [];

  const enviar = () => {
    const tx = texto.trim().slice(0, 2000);
    if (!tx) return;
    const c = { id: `tc-${Date.now().toString(36)}`, texto: tx, em: new Date().toISOString(), autor };
    if (salvarComAtividade((p) => atualizarTarefa(p, tarefa.id, (x) => ({ ...x, comentarios: [...(x.comentarios ?? []), c] })), 'comentario', `Comentário na tarefa “${tarefa.titulo}”: ${tx}`))
      descartarRascunho(idCom);
  };

  return (
    <div className={t.secao}>
      <h4>
        Comentários {lista.length > 0 && <span className={t.secaoConta}>{lista.length}</span>}
      </h4>
      {lista.length > 0 && (
        <ul className={t.comentarios}>
          {lista.map((c) => (
            <li key={c.id}>
              <p>{c.texto}</p>
              <small>
                {c.autor.nome}
                {c.autor.autenticado ? '' : ' (não autenticado)'} · {dataHora(c.em)}
              </small>
            </li>
          ))}
        </ul>
      )}
      <div className={t.novoComentario}>
        <label className={j.somenteLeitor} htmlFor={idCom}>
          Comentário na tarefa
        </label>
        <textarea
          id={idCom}
          rows={2}
          value={texto}
          maxLength={2000}
          placeholder="Comentário interno sobre esta tarefa"
          onChange={(e) => mudarRascunho(idCom, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <button type="button" className={j.btnContorno} onClick={enviar} disabled={!texto.trim()}>
          Comentar
        </button>
      </div>
    </div>
  );
}
