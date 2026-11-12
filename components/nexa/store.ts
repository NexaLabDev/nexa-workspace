'use client';

// ============================================
// PONTO ÚNICO DE DADOS DAS TELAS
// ============================================
// Todas as telas leem e gravam por aqui (usePersistido). Os dados ficam no Supabase
// (ver remoto.ts) e chegam aos outros aparelhos da equipe. As funções de localStorage
// no fim do arquivo servem só para ler os dados ANTIGOS deste navegador (importação/backup).
// ============================================

import * as remoto from './remoto';
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
  /** Quando avisar sobre cobranças (dias antes, no dia, vencidas): vale para o workspace */
  avisos: 'avisos',
} as const;

type Chave = (typeof CHAVES)[keyof typeof CHAVES];

export function usePersistido<T>(chave:Chave,inicial:T):[T,(novo:T|((atual:T)=>T))=>boolean]{
 const valor=useSyncExternalStore(remoto.assinar,()=>remoto.ler(chave,inicial),()=>inicial);
 const definir=useCallback((novo:T|((atual:T)=>T))=>{
 const atual=remoto.ler(chave,inicial);
 return remoto.alterar(chave,typeof novo==='function'?(novo as (x:T)=>T)(atual):novo);
 },[chave,inicial]);
 return [valor,definir];
}
/** Apaga tudo o que foi salvo e volta aos dados de exemplo. */
export function restaurarExemplos() {
  try {
    Object.values(CHAVES).forEach((c) => window.localStorage.removeItem(PREFIXO + c));
  } catch {
    /* ignora */
  }

  window.dispatchEvent(new CustomEvent(EVENTO, { detail: '*' }));
}

/** Tudo o que o Workspace salvou neste navegador (para backup). */
export function lerTudoSalvo(): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const c of Object.values(CHAVES)) {
    if (c === 'avisos') continue; // nunca existiu no navegador (ficava no servidor local)
    const bruto = window.localStorage.getItem(PREFIXO + c);
    if (bruto == null) continue;
    try {
      saida[c] = JSON.parse(bruto);
    } catch {
      throw new Error('Dados locais ilegíveis em '+c+'. A importação foi interrompida.');
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

  window.dispatchEvent(new CustomEvent(EVENTO, { detail: '*' }));
}
