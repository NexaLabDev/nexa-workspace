'use client';

import { useLayoutEffect, useRef } from 'react';

// O escopo deve ser a aba exibida, e não a URL já alterada pelo Next:
 // useDeferredValue pode manter a tela anterior por alguns instantes.
 // O scroll do menu inferior é global; o das páginas e quadros é por aba.
// Somente posições de rolagem são mantidas em memória; nenhum dado do CRM.
type Posicao = {
  raiz: number;
  principal: number;
  janela: number;
  areas: Record<string, { topo: number; esquerda: number }>;
};

const posicoes = new Map<string, Posicao>();
let ultimoMenu = 0;

export default function useRolagemNavegacao(escopo: string) {
  const raizRef = useRef<HTMLDivElement>(null);
  const principalRef = useRef<HTMLElement>(null);
  const navCelularRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const raiz = raizRef.current;
    const principal = principalRef.current;
    const menu = navCelularRef.current;
    if (!raiz || !principal) return;

    const areas = () => raiz.querySelectorAll<HTMLElement>('[data-nexa-scroll]');
    // ÚNICA posição horizontal do menu, compartilhada entre todos os módulos.
    // Restaurar por pathname fazia a barra recuar ao entrar em uma aba antiga.
    if (menu) menu.scrollLeft = ultimoMenu;
    const memorizarMenu = () => { if (menu) ultimoMenu = menu.scrollLeft; };
    menu?.addEventListener('scroll', memorizarMenu, { passive: true });

    const salvar = () => {
      const posAreas: Posicao['areas'] = {};
      areas().forEach((elemento) => {
        const id = elemento.dataset.nexaScroll;
        if (id) posAreas[id] = { topo: elemento.scrollTop, esquerda: elemento.scrollLeft };
      });
      ultimoMenu = menu?.scrollLeft ?? ultimoMenu;
      posicoes.set(escopo, {
        raiz: raiz.scrollTop,
        principal: principal.scrollTop,
        janela: window.scrollY,
        areas: posAreas,
      });
    };

    // Restaurar depois que os elementos internos estiverem montados. Não
    // forçar o topo ao abrir uma aba já visitada ou ao voltar pelo histórico.
    let restaurando = true;
    const frameRestauracao = window.requestAnimationFrame(() => {
      const anterior = posicoes.get(escopo);
      if (anterior) {
        const mobile = window.matchMedia('(max-width: 700px)').matches;
        if (!mobile) {
          raiz.scrollTop = anterior.raiz;
          window.scrollTo({ top: anterior.janela, left: 0, behavior: 'instant' });
        }
        principal.scrollTop = anterior.principal;
      }
      if (anterior) {
        areas().forEach((elemento) => {
          const id = elemento.dataset.nexaScroll;
          const posicao = id ? anterior.areas[id] : undefined;
          if (posicao) {
            elemento.scrollTop = posicao.topo;
            elemento.scrollLeft = posicao.esquerda;
          }
        });
      }
      restaurando = false;
    });

    // Eventos de rolagem também vêm das colunas internas e do menu mobile.
    // Uma leitura por frame evita trabalho excessivo ao arrastar/rolar.
    let frameGravacao = 0;
    const aoRolar = () => {
      if (restaurando || frameGravacao) return;
      frameGravacao = window.requestAnimationFrame(() => {
        frameGravacao = 0;
        salvar();
      });
    };
    raiz.addEventListener('scroll', aoRolar, true);
    window.addEventListener('scroll', aoRolar, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameRestauracao);
      if (frameGravacao) window.cancelAnimationFrame(frameGravacao);
      salvar();
      raiz.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('scroll', aoRolar);
      menu?.removeEventListener('scroll', memorizarMenu);
    };
  }, [escopo]);

  return { raizRef, principalRef, navCelularRef };
}
