'use client';

// Esc em painéis empilhados dentro da janela do projeto: fecha só o de cima
// (pré-visualização sobre o painel de detalhes, por exemplo) e não fecha a janela.

import { useEffect, useRef } from 'react';

const pilha: Array<{ current: () => void }> = [];
let ouvindo = false;

function aoTeclar(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !pilha.length) return;
  e.stopImmediatePropagation();
  pilha[pilha.length - 1].current();
}

export function useEscapeEmPilha(onFechar: () => void) {
  const ref = useRef(onFechar);
  ref.current = onFechar;
  useEffect(() => {
    pilha.push(ref);
    if (!ouvindo) {
      window.addEventListener('keydown', aoTeclar, true);
      ouvindo = true;
    }
    return () => {
      const i = pilha.lastIndexOf(ref);
      if (i >= 0) pilha.splice(i, 1);
      if (!pilha.length) {
        window.removeEventListener('keydown', aoTeclar, true);
        ouvindo = false;
      }
    };
  }, []);
}
