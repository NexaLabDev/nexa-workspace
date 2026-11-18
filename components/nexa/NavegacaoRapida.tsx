'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';

// Navegação de módulos: a sessão, o banco e a URL já estão sincronizados
// pelo layout protegido. Trocar o módulo não exige outro SSR completo.
// Para abrir em nova guia, Ctrl/Cmd + clique e acessibilidade, Link permanece.
export default function NavegacaoRapida(props: ComponentProps<typeof Link>) {
  const { onClick, href, ...resto } = props;
  function clicar(evento: MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento);
    if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const alvo = typeof href === 'string' ? href : (href.pathname ?? '/');
    const destino = new URL(alvo, window.location.href);
    if (destino.origin !== window.location.origin) return;
    if (destino.pathname === window.location.pathname && destino.search === window.location.search) {
      evento.preventDefault();
      return;
    }
    evento.preventDefault();
    window.history.pushState(null, '', destino.pathname + destino.search + destino.hash);
  }
  return <Link {...resto} href={href} prefetch={false} onClick={clicar} />;
}
