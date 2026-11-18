'use client';

import { useLayoutEffect, useRef } from 'react';

// O menu inferior tem uma só posição horizontal para todas as abas.
// Páginas e quadros guardam posições próprias. A chave é o módulo
// REALMENTE exibido, não o pathname que pode mudar antes do lazy carregar.
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
    const memorizarMenu = () => { if (menu) ultimoMenu = menu.scrollLeft; };

    // Antes de pintar uma nova aba, preserva exatamente o mesmo trecho do menu.
    if (menu) menu.scrollLeft = ultimoMenu;
    menu?.addEventListener('scroll', memorizarMenu, { passive: true });

    const salvar = () => {
      const posAreas: Posicao['areas'] = {};
      areas().forEach(elemento => {
        const id = elemento.dataset.nexaScroll;
        if (id) posAreas[id] = { topo: elemento.scrollTop, esquerda: elemento.scrollLeft };
      });
      memorizarMenu();
      posicoes.set(escopo, {
        raiz: raiz.scrollTop,
        principal: principal.scrollTop,
        janela: window.scrollY,
        areas: posAreas,
      });
    };

    // Captura ANTES do History.pushState: navegador/React podem zerar o scroll
    // no commit seguinte. O cleanup não deve sobrescrever essa fotografia.
    let navegando = false;
    const antesDeNavegar = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      try {
        const destino = new URL(link.href);
        if (destino.origin === window.location.origin &&
            (destino.pathname !== window.location.pathname || destino.search !== window.location.search)) {
          salvar();
          navegando = true;
        }
      } catch { /* Link inválido não altera a navegação. */ }
    };
    menu?.addEventListener('click', antesDeNavegar, true);

    // Os dados e componentes lazy podem aumentar a altura depois do primeiro
    // frame. Espera haver altura suficiente em vez de restaurar 520px num
    // container ainda vazio (o navegador acabaria fixando 0px).
    const anterior = posicoes.get(escopo);
    let restaurando = true;
    let interrompido = false;
    let tentativas = 0;
    let frameRestauracao = 0;
    const restaurar = () => {
      if (interrompido || !raiz.isConnected || !principal.isConnected) return;
      if (anterior) {
        const limite = Math.max(0, principal.scrollHeight - principal.clientHeight);
        if (anterior.principal > limite + 2 && tentativas < 120) {
          tentativas++;
          frameRestauracao = window.requestAnimationFrame(restaurar);
          return;
        }
        const mobile = window.matchMedia('(max-width: 700px)').matches;
        if (!mobile) {
          raiz.scrollTop = anterior.raiz;
          window.scrollTo({ top: anterior.janela, left: 0, behavior: 'instant' });
        }
        principal.scrollTop = Math.min(anterior.principal, limite);
        areas().forEach(elemento => {
          const id = elemento.dataset.nexaScroll;
          const posicao = id ? anterior.areas[id] : undefined;
          if (posicao) {
            elemento.scrollTop = posicao.topo;
            elemento.scrollLeft = posicao.esquerda;
          }
        });
      }
      restaurando = false;
    };
    frameRestauracao = window.requestAnimationFrame(restaurar);

    // Nunca lutar contra um gesto manual durante a restauração.
    const pessoaInteragiu = () => {
      interrompido = true;
      restaurando = false;
      window.cancelAnimationFrame(frameRestauracao);
    };
    principal.addEventListener('touchstart', pessoaInteragiu, { passive: true });
    principal.addEventListener('wheel', pessoaInteragiu, { passive: true });
    principal.addEventListener('pointerdown', pessoaInteragiu, { passive: true });

    let frameGravacao = 0;
    const aoRolar = () => {
      if (restaurando || navegando || frameGravacao) return;
      frameGravacao = window.requestAnimationFrame(() => {
        frameGravacao = 0;
        if (!navegando) salvar();
      });
    };
    raiz.addEventListener('scroll', aoRolar, true);
    window.addEventListener('scroll', aoRolar, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameRestauracao);
      if (frameGravacao) window.cancelAnimationFrame(frameGravacao);
      if (!navegando) salvar();
      raiz.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('scroll', aoRolar);
      menu?.removeEventListener('scroll', memorizarMenu);
      menu?.removeEventListener('click', antesDeNavegar, true);
      principal.removeEventListener('touchstart', pessoaInteragiu);
      principal.removeEventListener('wheel', pessoaInteragiu);
      principal.removeEventListener('pointerdown', pessoaInteragiu);
    };
  }, [escopo]);

  return { raizRef, principalRef, navCelularRef };
}
