'use client';

// Botão "Compartilhar acompanhamento": o mesmo link permanente de antes,
// agora num painel que abre a partir do cabeçalho da janela.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw, Share2, X } from 'lucide-react';
import j from './janela.module.css';
import { useJanela } from './salvamento';
import { CampoTexto } from './campos';
import { gerarCodigoPublico, linkPermanente } from '../acompanhamento';

export default function Compartilhar() {
  const { projeto, salvarComAtividade } = useJanela();
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const link = typeof window === 'undefined' || !projeto.codigoPublico ? '' : linkPermanente(projeto.codigoPublico, window.location.origin);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', fora);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', esc, true);
    };
  }, [aberto]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Copie o link:', link);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  };

  const novoLink = () => {
    if (window.confirm('Gerar um novo link? O link atual para de funcionar para quem já o recebeu.')) {
      salvarComAtividade((p) => ({ ...p, codigoPublico: gerarCodigoPublico() }), 'dado', 'Novo link de acompanhamento gerado (o anterior foi desativado)');
    }
  };

  return (
    <div className={j.compartilhar} ref={caixa}>
      <button type="button" className={j.btnCompartilhar} onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-haspopup="dialog" title="Compartilhar acompanhamento com o cliente">
        <Share2 size={16} aria-hidden /> <span className={j.rotuloCompartilhar}>Compartilhar</span>
      </button>
      {aberto && (
        <div className={j.compartilharCaixa} role="dialog" aria-label="Link de acompanhamento do cliente">
          <div className={j.compartilharTopo}>
            <strong>Link de acompanhamento</strong>
            <button type="button" className={j.btnTopo} onClick={() => setAberto(false)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          <p>
            Link permanente: mostra sempre a fase atual. O cliente vê só o nome do projeto, a fase, o progresso, a data da
            última atualização e o recado abaixo. Enquanto o Workspace não estiver publicado na internet, o link só abre
            neste computador.
          </p>
          <CampoTexto
            id="recado"
            rotulo="Recado para o cliente (opcional, aparece no link)"
            valor={projeto.observacaoPublica ?? ''}
            area
            maxLength={600}
            placeholder="Ex.: Aguardando as fotos dos produtos para seguir."
            aplicar={(t) => (p) => ({ ...p, observacaoPublica: t || undefined, atualizadoEm: new Date().toISOString() })}
            registro={{ tipo: 'dado', texto: (_a, d) => (d ? 'Recado do link do cliente atualizado' : 'Recado do link do cliente removido') }}
          />
          <div className={j.compartilharBotoes}>
            <button type="button" className={j.btnLima} onClick={copiar} disabled={!link}>
              {copiado ? <Check size={16} /> : <Copy size={16} />} {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
            <a href={link || undefined} target="_blank" rel="noopener noreferrer" className={j.btnContorno} aria-disabled={!link}>
              <ExternalLink size={16} /> Ver como o cliente
            </a>
            <button type="button" className={j.btnContorno} onClick={novoLink}>
              <RefreshCw size={15} /> Gerar novo link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
