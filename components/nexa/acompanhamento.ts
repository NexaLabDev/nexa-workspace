// ============================================
// LINK DE ACOMPANHAMENTO DO CLIENTE
// ============================================
// Link PERMANENTE: /acompanhamento/<código aleatório>. A página consulta o servidor
// a cada acesso, então mostra sempre a fase atual do Kanban. O servidor só recebe
// a versão pública do projeto (nome, fase, progresso, data e observação autorizada):
// nada de cliente, valores, contatos ou anotações internas.
// Links antigos (?p=<retrato>) continuam abrindo, com a situação de quando foram copiados.
// ============================================

import { etapasProjeto, type Projeto } from './dados-exemplo';

export type RetratoProjeto = {
  nome: string;
  etapa: string;
  /** null = ainda não há como calcular (modo "por tarefas" sem tarefas): o link mostra "ainda não disponível" */
  progresso: number | null;
  /** Como o percentual foi calculado (links antigos não têm: tratados como "fase") */
  base?: 'fase' | 'tarefas';
  atualizadoEm: string;
  /** Observação autorizada pela equipe (só no link permanente) */
  observacao?: string;
};

// ---------- Link permanente (código aleatório; a página consulta o servidor) ----------
/** 22 caracteres = 128 bits aleatórios: impossível de adivinhar e não revela nada do projeto. */
export const CODIGO_PUBLICO_VALIDO = /^[A-Za-z0-9_-]{22}$/;

export function gerarCodigoPublico(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type RetratoPublico = RetratoProjeto & { codigo: string };

/** Só os campos que o cliente pode ver. Nada de valores, anotações, cliente ou contatos. */
export function retratoPublico(p: Projeto): RetratoPublico | null {
  if (!p.codigoPublico) return null;
  return {
    codigo: p.codigoPublico,
    nome: p.servico,
    etapa: p.etapa,
    // por tarefas sem nenhuma tarefa: não mostra um percentual antigo como se fosse o atual
    progresso: p.modoProgresso === 'tarefas' && !p.tarefasProjeto?.length ? null : Math.max(0, Math.min(100, Math.round(p.progresso))),
    base: p.modoProgresso === 'tarefas' ? 'tarefas' : 'fase',
    atualizadoEm: p.atualizadoEm,
    ...(p.observacaoPublica?.trim() ? { observacao: p.observacaoPublica.trim().slice(0, 600) } : {}),
  };
}

/** Domínio público para clientes (sem SSO Vercel). Local usa o origin do navegador. */
export const DOMINIO_PUBLICO_PADRAO = 'https://nexa-workspace-tau.vercel.app';

export function origemPublica(origemNavegador?: string): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configurada) return configurada;
  const local = origemNavegador?.trim().replace(/\/+$/, '') ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(local)) return local;
  return DOMINIO_PUBLICO_PADRAO;
}

export function linkPermanente(codigo: string, origem?: string): string {
  return `${origemPublica(origem)}/acompanhamento/${codigo}`;
}

function paraBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(codigo: string): string {
  const b64 = codigo.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function montarLinkAcompanhamento(projeto: Projeto, origem?: string): string {
  const dados = { v: 1, n: projeto.servico, e: projeto.etapa, p: projeto.progresso, a: projeto.atualizadoEm };
  return `${origemPublica(origem)}/acompanhamento?p=${paraBase64Url(JSON.stringify(dados))}`;
}

/** Lê e valida o retrato do link. Retorna null se o link estiver corrompido. */
export function lerRetrato(codigo: string | null): RetratoProjeto | null {
  if (!codigo || codigo.length > 2000) return null;
  try {
    const d = JSON.parse(deBase64Url(codigo)) as Record<string, unknown>;
    if (d.v !== 1) return null;
    const nome = typeof d.n === 'string' ? d.n.trim().slice(0, 80) : '';
    const etapa = typeof d.e === 'string' && etapasProjeto.some((e) => e.id === d.e) ? d.e : null;
    const progresso = typeof d.p === 'number' && Number.isFinite(d.p) ? Math.min(100, Math.max(0, Math.round(d.p))) : null;
    const data = typeof d.a === 'string' && !Number.isNaN(new Date(d.a).getTime()) ? d.a : null;
    if (!nome || !etapa || progresso == null || !data) return null;
    return { nome, etapa, progresso, atualizadoEm: data };
  } catch {
    return null;
  }
}
