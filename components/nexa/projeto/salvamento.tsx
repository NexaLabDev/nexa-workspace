'use client';

// ============================================
// SALVAMENTO AUTOMÁTICO DA JANELA DO PROJETO
// ============================================
// - Cada campo guarda um RASCUNHO enquanto a pessoa digita. O rascunho mora na
//   janela (não no campo), então trocar de aba não perde nada.
// - O rascunho é gravado sozinho depois de uma pausa na digitação ou ao sair do campo.
// - Se a gravação falhar (navegador sem espaço ou bloqueado), o rascunho fica,
//   a alteração entra numa fila e a próxima gravação (ou "Tentar de novo") reaplica tudo.
// - Dois destinos: o PROJETO e o CADASTRO DO CLIENTE (dados do cliente não são copiados
//   para o projeto: a Ficha edita o cadastro único da aba Clientes).
// ============================================

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AtividadeProjeto, AutorRegistro, Cliente, Projeto, TipoAtividade } from '../dados-exemplo';
import { novaAtividade } from '../dados';

export type EstadoSalvamento =
  | { tipo: 'ocioso' }
  | { tipo: 'pendente' }
  | { tipo: 'salvo'; em: string }
  | { tipo: 'erro' };

export type Transformar = (p: Projeto) => Projeto;
export type TransformarCliente = (c: Cliente) => Cliente;
/** Grava a transformação; true = ficou salvo no navegador */
export type Gravar = (t: Transformar) => boolean;
export type GravarCliente = (t: TransformarCliente) => boolean;
export type Alvo = 'projeto' | 'cliente';

type Contexto = {
  projeto: Projeto;
  /** Cadastro do cliente ligado ao projeto (undefined = projeto sem cliente vinculado) */
  cliente: Cliente | undefined;
  autor: AutorRegistro;
  estado: EstadoSalvamento;
  /** Grava agora no projeto. `chave` substitui uma alteração da fila com a mesma chave. */
  salvar: (t: Transformar, chave?: string) => boolean;
  /** Grava no cadastro do cliente vinculado */
  salvarCliente: (t: TransformarCliente, chave?: string) => boolean;
  /** Grava e registra na linha do tempo do projeto */
  salvarComAtividade: (t: Transformar, tipo: TipoAtividade, texto: string, chave?: string) => boolean;
  /** Grava no cliente e registra na linha do tempo do projeto */
  salvarClienteComAtividade: (t: TransformarCliente, texto: string, chave?: string) => boolean;
  rascunho: (id: string) => string | undefined;
  mudarRascunho: (id: string, texto: string) => void;
  descartarRascunho: (id: string) => void;
  tentarDeNovo: () => void;
  temPendencias: () => boolean;
};

const Ctx = createContext<Contexto | null>(null);

export function useJanela(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJanela fora da janela do projeto');
  return c;
}

export function comAtividade(t: Transformar, a: AtividadeProjeto): Transformar {
  return (p) => {
    const n = t(p);
    return { ...n, atividades: [...(n.atividades ?? []), a] };
  };
}

type Pendente = { alvo: 'projeto'; t: Transformar } | { alvo: 'cliente'; t: TransformarCliente };

export function ProvedorSalvamento({
  projeto,
  cliente,
  autor,
  gravar,
  gravarCliente,
  children,
}: {
  projeto: Projeto;
  cliente: Cliente | undefined;
  autor: AutorRegistro;
  gravar: Gravar;
  gravarCliente: GravarCliente;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoSalvamento>({ tipo: 'ocioso' });
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  /** Alterações que não conseguiram ser gravadas (reaplicadas na próxima gravação do mesmo destino) */
  const fila = useRef(new Map<string, Pendente>());
  const contador = useRef(0);

  const gravarEm = useCallback(
    (alvo: Alvo, t: Transformar | TransformarCliente, chave?: string) => {
      const k = chave ? `${alvo}:${chave}` : `${alvo}:x${++contador.current}`;
      fila.current.delete(k);
      const anteriores = Array.from(fila.current.entries()).filter(([, p]) => p.alvo === alvo);
      let ok: boolean;
      if (alvo === 'projeto') {
        const fs = anteriores.map(([, p]) => p.t as Transformar);
        ok = gravar((p) => (t as Transformar)(fs.reduce((acc, f) => f(acc), p)));
      } else {
        const fs = anteriores.map(([, p]) => p.t as TransformarCliente);
        ok = gravarCliente((c) => (t as TransformarCliente)(fs.reduce((acc, f) => f(acc), c)));
      }
      if (ok) anteriores.forEach(([kk]) => fila.current.delete(kk));
      else fila.current.set(k, { alvo, t } as Pendente);
      setEstado(fila.current.size ? { tipo: 'erro' } : { tipo: 'salvo', em: new Date().toISOString() });
      return ok;
    },
    [gravar, gravarCliente]
  );

  const salvar = useCallback((t: Transformar, chave?: string) => gravarEm('projeto', t, chave), [gravarEm]);
  const salvarCliente = useCallback((t: TransformarCliente, chave?: string) => gravarEm('cliente', t, chave), [gravarEm]);

  const salvarComAtividade = useCallback(
    (t: Transformar, tipo: TipoAtividade, texto: string, chave?: string) => salvar(comAtividade(t, novaAtividade(tipo, texto, autor)), chave),
    [salvar, autor]
  );

  const salvarClienteComAtividade = useCallback(
    (t: TransformarCliente, texto: string, chave?: string) => {
      const ok = salvarCliente(t, chave);
      if (ok) salvar(comAtividade((p) => p, novaAtividade('dado', texto, autor)));
      return ok;
    },
    [salvarCliente, salvar, autor]
  );

  const mudarRascunho = useCallback((id: string, texto: string) => {
    setRascunhos((r) => ({ ...r, [id]: texto }));
    setEstado((e) => (e.tipo === 'erro' ? e : { tipo: 'pendente' }));
  }, []);

  const descartarRascunho = useCallback((id: string) => {
    setRascunhos((r) => {
      if (!(id in r)) return r;
      const n = { ...r };
      delete n[id];
      return n;
    });
  }, []);

  const tentarDeNovo = useCallback(() => {
    const temCliente = Array.from(fila.current.values()).some((p) => p.alvo === 'cliente');
    if (temCliente) gravarEm('cliente', (c: Cliente) => c, 'tentar-de-novo');
    gravarEm('projeto', (p: Projeto) => p, 'tentar-de-novo');
  }, [gravarEm]);

  const valor = useMemo<Contexto>(
    () => ({
      projeto,
      cliente,
      autor,
      estado,
      salvar,
      salvarCliente,
      salvarComAtividade,
      salvarClienteComAtividade,
      rascunho: (id) => rascunhos[id],
      mudarRascunho,
      descartarRascunho,
      tentarDeNovo,
      temPendencias: () => fila.current.size > 0,
    }),
    [projeto, cliente, autor, estado, salvar, salvarCliente, salvarComAtividade, salvarClienteComAtividade, rascunhos, mudarRascunho, descartarRascunho, tentarDeNovo]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
