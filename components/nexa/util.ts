'use client';

import { useEffect, useState } from 'react';
import type { StatusCliente } from './dados-exemplo';
import u from './ui.module.css';

/** Lê um parâmetro do endereço (ex.: ?novo=1) depois que a página abre no navegador. */
export function useParametro(nome: string): string | null {
  const [valor, setValor] = useState<string | null>(null);
  useEffect(() => {
    setValor(new URLSearchParams(window.location.search).get(nome));
  }, [nome]);
  return valor;
}

export function classeStatusCliente(status: StatusCliente): string {
  switch (status) {
    case 'Ativo':
      return u.stLima;
    case 'Qualificação':
      return u.stCeu;
    case 'Proposta':
      return u.stAmbar;
    case 'Negociação':
      return u.stVioleta;
    case 'Em andamento':
      return u.stLaranja;
    default:
      return u.stCinza;
  }
}

export function reais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Evento para abrir um projeto no Kanban (ex.: aviso de tarefa no sininho com o Kanban já aberto). */
export const EVENTO_ABRIR_PROJETO = 'nexa-workspace:abrir-projeto';

export function pedirAberturaProjeto(id: string, aba?: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PROJETO, { detail: { id, aba } }));
}
