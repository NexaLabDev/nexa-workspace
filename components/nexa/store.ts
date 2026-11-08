'use client';

// ============================================
// DADOS SALVOS NO NAVEGADOR (provisório, até existir banco)
// ============================================
// Cada lista fica no localStorage deste navegador. Todas as abas leem
// e gravam pelo mesmo lugar, então o CRM e a Meta Mensal ficam em sincronia.
// Limites: só vale neste computador/navegador e some se o histórico for apagado.
// ============================================

import { useCallback, useSyncExternalStore } from 'react';

const PREFIXO = 'nexa-workspace:v1:';
const EVENTO = 'nexa-workspace:mudou';

export const CHAVES = {
  leads: 'leads',
  vendas: 'vendas',
  metas: 'metas',
  diasTrabalho: 'dias-trabalho',
  projetos: 'projetos',
  clientes: 'clientes',
  documentos: 'documentos',
  conversas: 'conversas',
  servicos: 'servicos',
  prestadora: 'prestadora',
  /** Nome de quem usa este navegador (autor das atividades até existir login) */
  perfil: 'perfil',
  /** Preferências gerais (ex.: dias de antecedência do aviso de prazo próximo) */
  preferencias: 'preferencias',
  /** Categorias da biblioteca de arquivos dos projetos (aba Anexos) */
  categoriasArquivos: 'categorias-arquivos',
} as const;

type Chave = (typeof CHAVES)[keyof typeof CHAVES];

// Cache por chave: o mesmo texto salvo devolve o mesmo objeto (exigência do React).
const cache = new Map<string, { bruto: string | null; valor: unknown }>();

function ler<T>(chave: Chave, inicial: T): T {
  let bruto: string | null = null;
  try {
    bruto = window.localStorage.getItem(PREFIXO + chave);
  } catch {
    return inicial;
  }
  const emCache = cache.get(chave);
  if (emCache && emCache.bruto === bruto) return emCache.valor as T;
  let valor: T = inicial;
  if (bruto != null) {
    try {
      valor = JSON.parse(bruto) as T;
    } catch {
      valor = inicial;
    }
  }
  cache.set(chave, { bruto, valor });
  return valor;
}

/** Grava e devolve true se ficou salvo no navegador (false = só na memória desta aba). */
function gravar<T>(chave: Chave, valor: T): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    /* navegador sem espaço ou bloqueado: segue só na memória */
    cache.set(chave, { bruto: '__memoria__', valor });
    ok = false;
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: chave }));
  return ok;
}

function assinar(aviso: () => void) {
  const aoMudar = () => aviso();
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener('storage', aoMudar); // outras abas do navegador
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener('storage', aoMudar);
  };
}

/**
 * Como useState, mas salvo no navegador e compartilhado entre as telas.
 * No servidor (primeira renderização) usa o valor inicial.
 */
export function usePersistido<T>(chave: Chave, inicial: T): [T, (novo: T | ((atual: T) => T)) => boolean] {
  const valor = useSyncExternalStore(
    assinar,
    () => ler(chave, inicial),
    () => inicial
  );
  const definir = useCallback(
    (novo: T | ((atual: T) => T)) => {
      const atual = ler(chave, inicial);
      const proximo = typeof novo === 'function' ? (novo as (a: T) => T)(atual) : novo;
      return gravar(chave, proximo);
    },
    // `inicial` vem de constantes dos dados de exemplo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave]
  );
  return [valor, definir];
}

/** Apaga tudo o que foi salvo e volta aos dados de exemplo. */
export function restaurarExemplos() {
  try {
    Object.values(CHAVES).forEach((c) => window.localStorage.removeItem(PREFIXO + c));
  } catch {
    /* ignora */
  }
  cache.clear();
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: '*' }));
}

/** Tudo o que o Workspace salvou neste navegador (para backup). */
export function lerTudoSalvo(): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const c of Object.values(CHAVES)) {
    const bruto = window.localStorage.getItem(PREFIXO + c);
    if (bruto == null) continue;
    try {
      saida[c] = JSON.parse(bruto);
    } catch {
      /* valor corrompido fica fora */
    }
  }
  return saida;
}

/** Grava as listas vindas de um backup (só chaves conhecidas). */
export function gravarTudoSalvo(dados: Record<string, unknown>) {
  const conhecidas = new Set<string>(Object.values(CHAVES));
  for (const [c, v] of Object.entries(dados)) {
    if (conhecidas.has(c)) window.localStorage.setItem(PREFIXO + c, JSON.stringify(v));
  }
  cache.clear();
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: '*' }));
}
