'use client';

// Comprovante de um pagamento: anexar, usar arquivo da conversa, ver, substituir, baixar e remover.

import { useRef, useState } from 'react';
import { Download, Eye, Paperclip, RefreshCw, Trash2 } from 'lucide-react';
import p from './pagamento.module.css';
import type { Comprovante as TComprovante, DocumentoLead } from '../dados-exemplo';
import { abrirArquivo, baixarArquivo, guardarArquivo, tamanhoLegivel } from '../arquivos';

type Props = {
  comprovante?: TComprovante;
  /** Arquivos já trocados/anexados que podem servir de comprovante */
  arquivos: DocumentoLead[];
  onMudar: (c: TComprovante | undefined) => void;
  rotulo: string;
  compacto?: boolean;
};

export default function Comprovante({ comprovante, arquivos, onMudar, rotulo, compacto }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const usaveis = arquivos.filter((a) => a.arquivoId && !a.id.startsWith('comp-'));

  const escolher = async (f: File) => {
    try {
      const arquivoId = await guardarArquivo(f);
      onMudar({ nome: f.name, tamanho: tamanhoLegivel(f.size), arquivoId });
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível anexar.');
    }
  };

  return (
    <div className={p.comprovanteCaixa}>
      {comprovante ? (
        <div className={p.comprovante}>
          <Paperclip size={14} />
          <span title={comprovante.nome}>{comprovante.nome}</span>
          {comprovante.arquivoId && (
            <>
              <button type="button" onClick={() => abrirArquivo(comprovante.arquivoId!, { nome: comprovante.nome })} aria-label={`Ver comprovante de ${rotulo}`} title="Ver">
                <Eye size={15} />
              </button>
              <button type="button" onClick={() => baixarArquivo(comprovante.arquivoId!, comprovante.nome)} aria-label={`Baixar comprovante de ${rotulo}`} title="Baixar">
                <Download size={15} />
              </button>
            </>
          )}
          <button type="button" onClick={() => ref.current?.click()} aria-label={`Substituir comprovante de ${rotulo}`} title="Substituir">
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => window.confirm('Remover este comprovante?') && onMudar(undefined)}
            aria-label={`Remover comprovante de ${rotulo}`}
            title="Remover"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className={p.acoesParcela}>
          <button type="button" className={p.btnComprovante} onClick={() => ref.current?.click()}>
            <Paperclip size={14} /> {compacto ? 'Comprovante' : 'Anexar comprovante'}
          </button>
          {usaveis.length > 0 && (
            <select
              className={p.usarArquivo}
              value=""
              aria-label={`Usar arquivo da conversa como comprovante de ${rotulo}`}
              onChange={(e) => {
                const doc = usaveis.find((a) => a.id === e.target.value);
                if (doc) onMudar({ nome: doc.nome, tamanho: doc.tamanho, arquivoId: doc.arquivoId });
              }}
            >
              <option value="">Usar arquivo da conversa…</option>
              {usaveis.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {erro && <p className={p.erro}>{erro}</p>}
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) escolher(f);
        }}
      />
    </div>
  );
}
