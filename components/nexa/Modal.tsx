'use client';

// Janela (modal) padrão do Nexa Workspace: fecha com Esc, no X ou clicando fora.

import { useEffect, useId, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import u from './ui.module.css';

type Props = {
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  onEnviar: () => void;
  textoEnviar: string;
  podeEnviar?: boolean;
  children: ReactNode;
};

export default function Modal({ titulo, descricao, onFechar, onEnviar, textoEnviar, podeEnviar = true, children }: Props) {
  const idTitulo = useId();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (podeEnviar) onEnviar();
  };

  return (
    <div className={u.fundoModal} onClick={onFechar}>
      <form
        className={u.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(e) => e.stopPropagation()}
        onSubmit={enviar}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className={`${u.btnIcone} ${u.empurra}`} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {descricao && <p>{descricao}</p>}
        {children}
        <div className={u.modalRodape}>
          <button type="button" className={u.btnSecundario} onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className={u.btnPrimario} disabled={!podeEnviar}>
            {textoEnviar}
          </button>
        </div>
      </form>
    </div>
  );
}
