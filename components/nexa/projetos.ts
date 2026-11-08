// ============================================
// REGRAS DOS PROJETOS: CÓDIGO, SERVIÇOS VINCULADOS E CAMPOS PERSONALIZADOS
// ============================================
// Sem dependência do navegador (dá para testar e rodar no servidor/migração).
// - Código PRJ-0001: dado na criação; projetos antigos recebem na primeira carga.
// - Um projeto pode ter vários serviços (um principal). Cada um guarda seus valores.
// - Campos e checklists vêm da aba Serviços. Valores preenchidos nunca são apagados
//   por mudanças no modelo (campo removido, renomeado ou com outro tipo).
// - O checklist é COPIADO para o projeto: mudar o modelo depois não altera a cópia.
// ============================================

import { etapasProjeto, type AutorRegistro, type Projeto, type ServicoProjeto, type ValorCampo } from './dados-exemplo';
import { reatribuirTarefasOrfas, tarefasDoChecklist } from './tarefas';
import type { CampoServico, ServicoNexa, TipoCampo } from './servicos-nexa';
import { normalizarNome } from './relacoes';

const PADRAO_CODIGO = /^PRJ-(\d{4,})$/;

export function formatarCodigo(n: number): string {
  return `PRJ-${String(n).padStart(4, '0')}`;
}

/** Próximo código livre (maior número usado + 1). */
export function proximoCodigoProjeto(projetos: Projeto[]): string {
  const maior = projetos.reduce((m, p) => {
    const n = PADRAO_CODIGO.exec(p.codigo ?? '')?.[1];
    return n ? Math.max(m, Number(n)) : m;
  }, 0);
  return formatarCodigo(maior + 1);
}

/**
 * Garante que todo projeto tenha um código único. Quem já tem código válido e único mantém;
 * quem não tem (ou repete o de outro) recebe o próximo número livre, na ordem da lista.
 * Devolve a MESMA lista se nada mudou.
 */
export function garantirCodigosProjetos(projetos: Projeto[]): Projeto[] {
  const usados = new Set<string>();
  const precisam: number[] = [];
  projetos.forEach((p, i) => {
    if (p.codigo && PADRAO_CODIGO.test(p.codigo) && !usados.has(p.codigo)) usados.add(p.codigo);
    else precisam.push(i);
  });
  if (!precisam.length) return projetos;
  let maior = Array.from(usados).reduce((m, c) => Math.max(m, Number(PADRAO_CODIGO.exec(c)![1])), 0);
  const novos = [...projetos];
  for (const i of precisam) novos[i] = { ...novos[i], codigo: formatarCodigo(++maior) };
  return novos;
}

/**
 * O percentual nunca é ajustado à mão: no modo "por fase" é o percentual fixo da fase
 * (ajustes manuais antigos são corrigidos); no modo "por tarefas" vem das tarefas concluídas.
 * Não mexe na data de atualização. Mesma lista se nada mudou.
 */
export function garantirProgressoPorFase(projetos: Projeto[]): Projeto[] {
  let mudou = false;
  const saida = projetos.map((p) => {
    if (p.modoProgresso === 'tarefas') return p;
    const daFase = etapasProjeto.find((e) => e.id === p.etapa)?.progresso;
    if (daFase == null || p.progresso === daFase) return p;
    mudou = true;
    return { ...p, progresso: daFase };
  });
  return mudou ? saida : projetos;
}

// ---------- Serviços do projeto ----------

const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function servicosDoProjeto(p: Projeto): ServicoProjeto[] {
  return p.servicos ?? [];
}

export function servicoPrincipal(p: Projeto): ServicoProjeto | undefined {
  const l = servicosDoProjeto(p);
  return l.find((s) => s.principal) ?? l[0];
}

/** Nome atual: o do cadastro (se ainda existir) ou o guardado no vínculo. */
export function nomeServicoProjeto(sp: ServicoProjeto, catalogo: ServicoNexa[]): string {
  return (sp.servicoId && catalogo.find((s) => s.id === sp.servicoId)?.nome) || sp.nome;
}

export function copiaChecklist(servico: ServicoNexa | undefined, agora = new Date()): ServicoProjeto['checklist'] | undefined {
  const itens = (servico?.checklist ?? []).filter((i) => i.texto.trim());
  if (!itens.length) return undefined;
  return { copiadoEm: agora.toISOString(), itens: itens.map((i) => ({ id: novoId('chk'), texto: i.texto.trim() })) };
}

/** Novo vínculo de serviço (o primeiro vira principal). */
export function novoServicoProjeto(servico: ServicoNexa, opcoes: { principal: boolean; copiarChecklist: boolean }, agora = new Date()): ServicoProjeto {
  return {
    id: novoId('sp'),
    servicoId: servico.id,
    nome: servico.nome,
    principal: opcoes.principal,
    valores: {},
    ...(opcoes.copiarChecklist ? { checklist: copiaChecklist(servico, agora) } : {}),
    adicionadoEm: agora.toISOString(),
  };
}

/**
 * Vincula o serviço. Se ele já esteve no projeto, as tarefas antigas voltam para o grupo dele.
 * Com copiarChecklist, os itens do checklist viram tarefas (sem repetir títulos já existentes).
 */
export function adicionarServico(p: Projeto, servico: ServicoNexa, copiarChecklist: boolean, agora = new Date(), autor?: AutorRegistro): Projeto {
  const lista = servicosDoProjeto(p);
  const sp = novoServicoProjeto(servico, { principal: !lista.some((s) => s.principal), copiarChecklist }, agora);
  let n: Projeto = reatribuirTarefasOrfas({ ...p, servicos: [...lista, sp] }, sp);
  if (sp.checklist) n = tarefasDoChecklist(n, sp.id, autor, agora).projeto;
  return n;
}

/** Remove o vínculo. Se era o principal, o próximo da lista assume. */
export function removerServico(p: Projeto, spId: string): Projeto {
  const lista = servicosDoProjeto(p);
  const saiu = lista.find((s) => s.id === spId);
  let resto = lista.filter((s) => s.id !== spId);
  if (saiu?.principal && resto.length && !resto.some((s) => s.principal)) resto = resto.map((s, i) => (i === 0 ? { ...s, principal: true } : s));
  return { ...p, servicos: resto };
}

export function tornarPrincipal(p: Projeto, spId: string): Projeto {
  return { ...p, servicos: servicosDoProjeto(p).map((s) => ({ ...s, principal: s.id === spId })) };
}

export function alterarServicoProjeto(p: Projeto, spId: string, mud: Partial<ServicoProjeto>): Projeto {
  return { ...p, servicos: servicosDoProjeto(p).map((s) => (s.id === spId ? { ...s, ...mud } : s)) };
}

/** Grava (ou limpa) o valor de um campo personalizado, guardando nome e tipo da época. */
export function definirValorCampo(p: Projeto, spId: string, campo: Pick<CampoServico, 'id' | 'nome' | 'tipo'>, valor: string | boolean): Projeto {
  return {
    ...p,
    servicos: servicosDoProjeto(p).map((s) => {
      if (s.id !== spId) return s;
      const valores = { ...(s.valores ?? {}) };
      if (valor === '' || valor === false) delete valores[campo.id];
      else valores[campo.id] = { valor, rotulo: campo.nome, tipo: campo.tipo };
      return { ...s, valores };
    }),
  };
}

/** Copia o checklist do serviço para o projeto e cria as tarefas (sem duplicar). */
export function copiarChecklistPara(p: Projeto, spId: string, servico: ServicoNexa | undefined, agora = new Date(), autor?: AutorRegistro): Projeto {
  const checklist = copiaChecklist(servico, agora);
  return checklist ? tarefasDoChecklist(alterarServicoProjeto(p, spId, { checklist }), spId, autor, agora).projeto : p;
}

/** Serviço sugerido para projetos antigos sem vínculo: o do lead (se veio do cadastro) ou um com o mesmo nome. */
export function servicoSugerido(p: Projeto, catalogo: ServicoNexa[]): ServicoNexa | undefined {
  if (servicosDoProjeto(p).length) return undefined;
  const porId = p.cadastro?.servicoId && catalogo.find((s) => s.id === p.cadastro!.servicoId);
  if (porId) return porId;
  const nomes = [p.cadastro?.servico, p.servico].map((n) => normalizarNome(n)).filter(Boolean);
  return catalogo.find((s) => nomes.includes(normalizarNome(s.nome)));
}

// ---------- Campos personalizados na Ficha ----------

export type CampoNaFicha = {
  /** Definição em vigor (ou reconstruída a partir do valor guardado, se o campo saiu do modelo) */
  campo: CampoServico;
  valor: ValorCampo | undefined;
  /** Campo removido do modelo, mas com valor preenchido neste projeto */
  orfao: boolean;
  /** O valor guardado não combina com o tipo atual ou com as opções atuais */
  foraDoFormato: boolean;
};

/**
 * Campos a mostrar para um serviço do projeto: os ativos do modelo (na ordem do modelo)
 * + os que saíram do modelo mas têm valor aqui (nunca somem).
 */
export function camposNaFicha(sp: ServicoProjeto, servico: ServicoNexa | undefined): CampoNaFicha[] {
  const valores = sp.valores ?? {};
  const modelo = servico?.campos ?? [];
  const saida: CampoNaFicha[] = [];
  for (const c of modelo) {
    const v = valores[c.id];
    if (c.arquivado && !v) continue;
    saida.push({ campo: c, valor: v, orfao: !!c.arquivado, foraDoFormato: !!v && !valorCombina(c, v.valor) });
  }
  for (const [id, v] of Object.entries(valores)) {
    if (modelo.some((c) => c.id === id)) continue;
    const campo: CampoServico = { id, nome: v.rotulo, tipo: v.tipo, obrigatorio: false, arquivado: true };
    saida.push({ campo, valor: v, orfao: true, foraDoFormato: false });
  }
  return saida;
}

export function valorPreenchido(v: ValorCampo | undefined): boolean {
  return !!v && (typeof v.valor === 'boolean' ? v.valor : !!String(v.valor).trim());
}

/** Obrigatórios (ativos) ainda vazios, para avisar na Ficha. Não bloqueia nada. */
export function obrigatoriosPendentes(sp: ServicoProjeto, servico: ServicoNexa | undefined): CampoServico[] {
  return (servico?.campos ?? []).filter((c) => c.obrigatorio && !c.arquivado && c.tipo !== 'checkbox' && !valorPreenchido(sp.valores?.[c.id]));
}

export function valorCombina(c: Pick<CampoServico, 'tipo' | 'opcoes'>, valor: string | boolean): boolean {
  if (c.tipo === 'checkbox') return typeof valor === 'boolean';
  if (typeof valor !== 'string') return false;
  if (c.tipo === 'selecao') return (c.opcoes ?? []).includes(valor);
  return validarTexto(c.tipo, valor) === null;
}

/** Confere o texto conforme o tipo. Devolve a mensagem de erro ou null. Vazio é sempre aceito. */
export function validarTexto(tipo: TipoCampo, texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  switch (tipo) {
    case 'numero':
      return /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(t) ? null : 'Use só números, ex.: 12 ou 1.500,50';
    case 'url':
      return /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(t) || /^https?:\/\/localhost(:\d+)?(\/\S*)?$/i.test(t) ? null : 'Endereço deve começar com https:// (ex.: https://site.com.br)';
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? null : 'E-mail inválido (ex.: nome@empresa.com.br)';
    case 'telefone': {
      const d = t.replace(/\D/g, '').length;
      return d >= 10 && d <= 13 ? null : 'Telefone com DDD, ex.: (31) 99999-0000';
    }
    case 'data':
      return /^\d{4}-\d{2}-\d{2}$/.test(t) ? null : 'Data inválida';
    default:
      return null;
  }
}
