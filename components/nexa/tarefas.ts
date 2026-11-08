// ============================================
// TAREFAS DO PROJETO (aba Tarefas)
// ============================================
// Sem dependência do navegador (testável). Regras:
// - Tarefas por serviço do projeto ou gerais (sem serviço).
// - Checklist do serviço vira tarefas UMA vez por item (origem.checklistItemId);
//   religar o mesmo serviço reaproveita as tarefas dele e não copia títulos repetidos.
// - Progresso "por tarefas" = tarefas principais concluídas ÷ total de principais.
//   Subtarefas não entram na conta geral. Sem tarefas = sem percentual.
// - Concluir tarefas NUNCA muda a fase do Kanban nem encerra o projeto.
// ============================================

import { etapasProjeto, type AutorRegistro, type PrioridadeProjeto, type Projeto, type ServicoProjeto, type SituacaoTarefa, type SubtarefaProjeto, type TarefaProjeto } from './dados-exemplo';
import { normalizarNome } from './relacoes';
import { soltarArquivosDaTarefa } from './biblioteca';

export const SITUACOES_TAREFA: Array<{ id: SituacaoTarefa; nome: string }> = [
  { id: 'pendente', nome: 'Pendente' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'bloqueada', nome: 'Bloqueada' },
  { id: 'concluida', nome: 'Concluída' },
];

export const nomeSituacao = (s: SituacaoTarefa) => SITUACOES_TAREFA.find((x) => x.id === s)?.nome ?? s;

/** Prazo "próximo": vence hoje ou nos próximos N dias (padrão; configurável em Configurações) */
export const DIAS_PRAZO_PROXIMO = 2;

const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function hojeLocal(agora = new Date()): string {
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${m}-${d}`;
}

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function tarefasDe(p: Projeto): TarefaProjeto[] {
  return p.tarefasProjeto ?? [];
}

// ---------- Progresso ----------

export function progressoPorTarefas(p: Projeto): { total: number; concluidas: number; pct: number | null } {
  const l = tarefasDe(p);
  const concluidas = l.filter((t) => t.situacao === 'concluida').length;
  return { total: l.length, concluidas, pct: l.length ? Math.round((100 * concluidas) / l.length) : null };
}

/** No modo "por tarefas", guarda o percentual calculado (o card e o link do cliente usam esse número). */
export function recalcularProgresso(p: Projeto, agora = new Date()): Projeto {
  if (p.modoProgresso !== 'tarefas') return p;
  const { pct } = progressoPorTarefas(p);
  if (pct == null || pct === p.progresso) return p;
  return { ...p, progresso: pct, atualizadoEm: agora.toISOString() };
}

export function mudarModoProgresso(p: Projeto, modo: 'fase' | 'tarefas', agora = new Date()): Projeto {
  if ((p.modoProgresso ?? 'fase') === modo) return p;
  if (modo === 'fase') {
    const sugerido = etapasProjeto.find((e) => e.id === p.etapa)?.progresso ?? p.progresso;
    return { ...p, modoProgresso: 'fase', progresso: sugerido, atualizadoEm: agora.toISOString() };
  }
  return recalcularProgresso({ ...p, modoProgresso: 'tarefas' }, agora);
}

function comTarefas(p: Projeto, lista: TarefaProjeto[], agora = new Date()): Projeto {
  return recalcularProgresso({ ...p, tarefasProjeto: lista }, agora);
}

// ---------- Criar, alterar, mover, excluir ----------

export function novaTarefa(
  dados: { titulo: string; servico?: Pick<ServicoProjeto, 'id' | 'servicoId' | 'nome'>; origem?: TarefaProjeto['origem'] },
  autor?: AutorRegistro,
  agora = new Date()
): TarefaProjeto {
  return {
    id: novoId('t'),
    titulo: dados.titulo.trim().slice(0, 200),
    situacao: 'pendente',
    ...(dados.servico ? { servicoProjetoId: dados.servico.id, servicoId: dados.servico.servicoId, servicoNome: dados.servico.nome } : {}),
    ...(dados.origem ? { origem: dados.origem } : {}),
    criadaEm: agora.toISOString(),
    ...(autor ? { criadaPor: autor } : {}),
  };
}

export function adicionarTarefa(p: Projeto, t: TarefaProjeto, agora = new Date()): Projeto {
  return comTarefas(p, [...tarefasDe(p), t], agora);
}

export function atualizarTarefa(p: Projeto, id: string, mud: Partial<TarefaProjeto> | ((t: TarefaProjeto) => TarefaProjeto), agora = new Date()): Projeto {
  return comTarefas(
    p,
    tarefasDe(p).map((t) => (t.id === id ? (typeof mud === 'function' ? mud(t) : { ...t, ...mud }) : t)),
    agora
  );
}

/** Muda a situação. Concluir grava a data; reabrir apaga a data de conclusão. */
export function definirSituacao(p: Projeto, id: string, situacao: SituacaoTarefa, agora = new Date()): Projeto {
  return atualizarTarefa(
    p,
    id,
    (t) => {
      if (t.situacao === situacao) return t;
      const n: TarefaProjeto = { ...t, situacao };
      if (situacao === 'concluida') n.concluidaEm = agora.toISOString();
      else delete n.concluidaEm;
      return n;
    },
    agora
  );
}

/** Exclui a tarefa. Os arquivos dela continuam na biblioteca do projeto (aba Anexos), só perdem o vínculo. */
export function removerTarefa(p: Projeto, id: string, agora = new Date()): Projeto {
  return comTarefas(soltarArquivosDaTarefa(p, id), tarefasDe(p).filter((t) => t.id !== id), agora);
}

/** Chave do grupo: id do serviço do projeto, ou "geral". */
export const chaveGrupo = (t: Pick<TarefaProjeto, 'servicoProjetoId'>) => t.servicoProjetoId ?? 'geral';

/** Troca a tarefa de lugar com a vizinha do MESMO grupo (ordem manual). */
export function moverTarefa(p: Projeto, id: string, direcao: -1 | 1): Projeto {
  const l = [...tarefasDe(p)];
  const i = l.findIndex((t) => t.id === id);
  if (i < 0) return p;
  const g = chaveGrupo(l[i]);
  let j = i + direcao;
  while (j >= 0 && j < l.length && chaveGrupo(l[j]) !== g) j += direcao;
  if (j < 0 || j >= l.length) return p;
  [l[i], l[j]] = [l[j], l[i]];
  return { ...p, tarefasProjeto: l };
}

/** Move a tarefa para outro serviço do projeto (ou para "geral"). */
export function mudarServicoTarefa(p: Projeto, id: string, sp: ServicoProjeto | undefined): Projeto {
  return atualizarTarefa(p, id, (t) => {
    const n: TarefaProjeto = { ...t };
    if (sp) Object.assign(n, { servicoProjetoId: sp.id, servicoId: sp.servicoId, servicoNome: sp.nome });
    else {
      delete n.servicoProjetoId;
      delete n.servicoId;
      delete n.servicoNome;
    }
    return n;
  });
}

// ---------- Subtarefas ----------

export function subtarefasPendentesObrigatorias(t: TarefaProjeto): SubtarefaProjeto[] {
  return (t.subtarefas ?? []).filter((s) => s.obrigatoria && !s.feita);
}

export function adicionarSubtarefa(p: Projeto, tarefaId: string, texto: string, obrigatoria = false): Projeto {
  const s: SubtarefaProjeto = { id: novoId('st'), texto: texto.trim().slice(0, 200), feita: false, obrigatoria };
  return atualizarTarefa(p, tarefaId, (t) => ({ ...t, subtarefas: [...(t.subtarefas ?? []), s] }));
}

export function alterarSubtarefa(p: Projeto, tarefaId: string, subId: string, mud: Partial<SubtarefaProjeto>, agora = new Date()): Projeto {
  return atualizarTarefa(p, tarefaId, (t) => ({
    ...t,
    subtarefas: (t.subtarefas ?? []).map((s) => {
      if (s.id !== subId) return s;
      const n = { ...s, ...mud };
      if (mud.feita === true && !s.feita) n.concluidaEm = agora.toISOString();
      if (mud.feita === false) delete n.concluidaEm;
      return n;
    }),
  }));
}

export function removerSubtarefa(p: Projeto, tarefaId: string, subId: string): Projeto {
  return atualizarTarefa(p, tarefaId, (t) => ({ ...t, subtarefas: (t.subtarefas ?? []).filter((s) => s.id !== subId) }));
}

// ---------- Checklist do serviço → tarefas ----------

/**
 * Cria tarefas a partir dos itens copiados do checklist, sem duplicar:
 * pula item já usado (mesmo id de origem) e título já existente no mesmo serviço.
 */
export function tarefasDoChecklist(p: Projeto, spId: string, autor?: AutorRegistro, agora = new Date()): { projeto: Projeto; criadas: number } {
  const sp = (p.servicos ?? []).find((s) => s.id === spId);
  if (!sp?.checklist || sp.checklist.tarefasCriadas) return { projeto: p, criadas: 0 };
  const existentes = tarefasDe(p);
  const origens = new Set(existentes.map((t) => t.origem?.checklistItemId).filter(Boolean));
  const titulosDoServico = new Set(
    existentes.filter((t) => t.servicoProjetoId === sp.id || (sp.servicoId && t.servicoId === sp.servicoId)).map((t) => normalizarNome(t.titulo))
  );
  const novas: TarefaProjeto[] = [];
  for (const item of sp.checklist.itens) {
    const titulo = normalizarNome(item.texto);
    if (!titulo || origens.has(item.id) || titulosDoServico.has(titulo)) continue;
    titulosDoServico.add(titulo);
    novas.push(novaTarefa({ titulo: item.texto, servico: sp, origem: { checklistItemId: item.id } }, autor, agora));
  }
  const servicos = (p.servicos ?? []).map((s) => (s.id === sp.id ? { ...s, checklist: { ...s.checklist!, tarefasCriadas: true } } : s));
  return { projeto: comTarefas({ ...p, servicos }, [...existentes, ...novas], agora), criadas: novas.length };
}

/** Projetos com checklist copiado antes da aba Tarefas existir: os itens viram tarefas uma vez. Mesma lista se nada mudou. */
export function garantirTarefasDoChecklist(projetos: Projeto[]): Projeto[] {
  let mudou = false;
  const saida = projetos.map((p) => {
    let atual = p;
    for (const sp of p.servicos ?? []) {
      if (sp.checklist && !sp.checklist.tarefasCriadas) {
        atual = tarefasDoChecklist(atual, sp.id, undefined, new Date(sp.checklist.copiadoEm)).projeto;
        mudou = true;
      }
    }
    return atual;
  });
  return mudou ? saida : projetos;
}

/** Ao religar um serviço que saiu do projeto, as tarefas dele voltam para o grupo do serviço. */
export function reatribuirTarefasOrfas(p: Projeto, sp: ServicoProjeto): Projeto {
  const ativos = new Set((p.servicos ?? []).map((s) => s.id));
  let mudou = false;
  const lista = tarefasDe(p).map((t) => {
    if (t.servicoProjetoId && !ativos.has(t.servicoProjetoId) && sp.servicoId && t.servicoId === sp.servicoId) {
      mudou = true;
      return { ...t, servicoProjetoId: sp.id, servicoNome: sp.nome };
    }
    return t;
  });
  return mudou ? { ...p, tarefasProjeto: lista } : p;
}

// ---------- Prazos, ordenação, filtros ----------

export type EstadoPrazo = 'concluida' | 'bloqueada' | 'vencida' | 'proxima' | 'em-dia' | 'sem-prazo';

export function estadoTarefa(t: TarefaProjeto, hoje = hojeLocal(), diasProximo = DIAS_PRAZO_PROXIMO): { estado: EstadoPrazo; dias: number | null } {
  const dias = t.prazo ? diasEntre(hoje, t.prazo) : null;
  if (t.situacao === 'concluida') return { estado: 'concluida', dias };
  // vencida tem prioridade visual sobre bloqueada: continua aparecendo como atrasada
  if (dias != null && dias < 0) return { estado: 'vencida', dias };
  if (t.situacao === 'bloqueada') return { estado: 'bloqueada', dias };
  if (dias != null && dias <= diasProximo) return { estado: 'proxima', dias };
  return { estado: dias == null ? 'sem-prazo' : 'em-dia', dias };
}

export function textoPrazoTarefa(dias: number | null): string {
  if (dias == null) return 'sem prazo';
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `atrasada ${-dias} dias`;
}

export type CriterioOrdem = 'manual' | 'prazo' | 'prioridade' | 'situacao' | 'responsavel';

const PESO_PRIORIDADE: Record<PrioridadeProjeto, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const PESO_SITUACAO: Record<SituacaoTarefa, number> = { pendente: 0, andamento: 1, bloqueada: 2, concluida: 3 };

export function ordenarTarefas(l: TarefaProjeto[], criterio: CriterioOrdem): TarefaProjeto[] {
  if (criterio === 'manual') return l;
  const idx = new Map(l.map((t, i) => [t.id, i]));
  const desempate = (a: TarefaProjeto, b: TarefaProjeto) => idx.get(a.id)! - idx.get(b.id)!;
  const comp: Record<Exclude<CriterioOrdem, 'manual'>, (a: TarefaProjeto, b: TarefaProjeto) => number> = {
    // sem prazo vai para o fim
    prazo: (a, b) => (a.prazo ?? '9999-99-99').localeCompare(b.prazo ?? '9999-99-99'),
    prioridade: (a, b) => (a.prioridade ? PESO_PRIORIDADE[a.prioridade] : 9) - (b.prioridade ? PESO_PRIORIDADE[b.prioridade] : 9),
    situacao: (a, b) => PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao],
    responsavel: (a, b) => (a.responsavel ? 0 : 1) - (b.responsavel ? 0 : 1) || (a.responsavel ?? '').localeCompare(b.responsavel ?? '', 'pt-BR'),
  };
  return [...l].sort((a, b) => comp[criterio](a, b) || desempate(a, b));
}

export type GrupoTarefas = {
  chave: string;
  titulo: string;
  /** Serviço do projeto (undefined = tarefas gerais ou serviço que saiu do projeto) */
  sp?: ServicoProjeto;
  /** Serviço não está mais no projeto, mas as tarefas continuam */
  removido?: boolean;
  tarefas: TarefaProjeto[];
};

/** Um grupo por serviço do projeto (principal primeiro), "Tarefas gerais" e serviços que saíram do projeto. */
export function gruposDeTarefas(p: Projeto, nomeServico: (sp: ServicoProjeto) => string): GrupoTarefas[] {
  const servicos = [...(p.servicos ?? [])].sort((a, b) => Number(b.principal) - Number(a.principal));
  const tarefas = tarefasDe(p);
  const grupos: GrupoTarefas[] = servicos.map((sp) => ({ chave: sp.id, titulo: nomeServico(sp), sp, tarefas: tarefas.filter((t) => t.servicoProjetoId === sp.id) }));
  grupos.push({ chave: 'geral', titulo: 'Tarefas gerais', tarefas: tarefas.filter((t) => !t.servicoProjetoId) });
  const ativos = new Set(servicos.map((s) => s.id));
  const orfas = new Map<string, TarefaProjeto[]>();
  for (const t of tarefas) if (t.servicoProjetoId && !ativos.has(t.servicoProjetoId)) orfas.set(t.servicoProjetoId, [...(orfas.get(t.servicoProjetoId) ?? []), t]);
  for (const [chave, l] of Array.from(orfas.entries())) grupos.push({ chave, titulo: l[0].servicoNome ?? 'Serviço removido', removido: true, tarefas: l });
  return grupos;
}

// ---------- Alertas (sininho, sem push) ----------

export type AlertaTarefa = { projetoId: string; projeto: string; cliente: string; tarefaId: string; titulo: string; prazo: string; dias: number; responsavel?: string };

/** Tarefas não concluídas vencidas ou com prazo próximo (até N dias), em todos os projetos (mais atrasadas primeiro). */
export function alertasTarefas(projetos: Projeto[], hoje = hojeLocal(), diasProximo = DIAS_PRAZO_PROXIMO): AlertaTarefa[] {
  const saida: AlertaTarefa[] = [];
  for (const p of projetos) {
    for (const t of tarefasDe(p)) {
      if (t.situacao === 'concluida' || !t.prazo) continue;
      const dias = diasEntre(hoje, t.prazo);
      if (dias > diasProximo) continue;
      saida.push({ projetoId: p.id, projeto: p.servico, cliente: p.cliente, tarefaId: t.id, titulo: t.titulo, prazo: t.prazo, dias, responsavel: t.responsavel });
    }
  }
  return saida.sort((a, b) => a.dias - b.dias);
}
