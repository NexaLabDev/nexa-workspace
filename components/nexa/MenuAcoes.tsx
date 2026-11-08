'use client';

// Botão "⋯" com um pequeno menu de ações (fecha ao clicar fora ou com Esc).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Ellipsis } from 'lucide-react';
import u from './ui.module.css';

export type AcaoMenu =
  | { tipo: 'link'; rotulo: string; href: string }
  | { tipo: 'botao'; rotulo: string; onClick: () => void; perigo?: boolean };

export default function MenuAcoes({ rotulo, acoes }: { rotulo: string; acoes: AcaoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div className={u.menuAcoes} ref={caixa}>
      <button
        type="button"
        className={u.btnIcone}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Ellipsis size={18} />
      </button>
      {aberto && (
        <div className={u.menuAcoesLista} role="menu">
          {acoes.map((a) =>
            a.tipo === 'link' ? (
              <Link key={a.rotulo} href={a.href} role="menuitem" className={u.menuAcoesItem} onClick={() => setAberto(false)}>
                {a.rotulo}
              </Link>
            ) : (
              <button
                key={a.rotulo}
                type="button"
                role="menuitem"
                className={`${u.menuAcoesItem} ${a.perigo ? u.menuAcoesPerigo : ''}`}
                onClick={() => {
                  setAberto(false);
                  a.onClick();
                }}
              >
                {a.rotulo}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
