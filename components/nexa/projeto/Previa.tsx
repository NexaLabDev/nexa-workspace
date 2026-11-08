'use client';

// Pré-visualização segura de arquivos (aba Anexos e anexos de tarefas).
// - Só mostra IMAGEM (png, jpg, gif, webp), PDF e TEXTO simples, e só depois de conferir
//   o conteúdo (assinatura dos bytes) — não confia no nome nem no tipo informado.
// - O conteúdo é exibido com o tipo forçado (imagem/PDF/texto); HTML, SVG, scripts e
//   executáveis nunca são abertos: só é oferecido o download.

import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileQuestion, FileText, Image as Imagem, X } from 'lucide-react';
import a from './anexos.module.css';
import { useEscapeEmPilha } from './esc';
import { baixarArquivo, lerArquivo, tipoDePrevia, tipoSeguro, type TipoPrevia } from '../arquivos';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'sem-arquivo' }
  | { fase: 'sem-previa' }
  | { fase: 'pronto'; tipo: TipoPrevia; url?: string; texto?: string };

function usePrevia(arquivoId: string, nome: string): Estado {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  useEffect(() => {
    let vivo = true;
    let url: string | undefined;
    (async () => {
      const blob = await lerArquivo(arquivoId).catch(() => undefined);
      if (!vivo) return;
      if (!blob) return setEstado({ fase: 'sem-arquivo' });
      const mime = await tipoSeguro(blob, nome);
      const tipo = tipoDePrevia(mime);
      if (!vivo) return;
      if (!tipo || !mime) return setEstado({ fase: 'sem-previa' });
      if (tipo === 'texto') return setEstado({ fase: 'pronto', tipo, texto: await blob.text() });
      url = URL.createObjectURL(new Blob([blob], { type: mime }));
      setEstado({ fase: 'pronto', tipo, url });
    })();
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [arquivoId, nome]);
  return estado;
}

export default function Previa({ arquivoId, nome, titulo, detalhes, onFechar }: { arquivoId: string; nome: string; titulo?: string; detalhes?: ReactNode; onFechar: () => void }) {
  const estado = usePrevia(arquivoId, nome);

  useEscapeEmPilha(onFechar);

  return (
    <div className={a.previaFundo} onClick={onFechar}>
      <div className={a.previa} role="dialog" aria-modal="true" aria-label={`Pré-visualização de ${titulo ?? nome}`} onClick={(e) => e.stopPropagation()}>
        <div className={a.previaTopo}>
          <strong>{titulo ?? nome}</strong>
          {detalhes && <span className={a.previaDetalhes}>{detalhes}</span>}
          <button type="button" className={a.btnContorno} onClick={() => baixarArquivo(arquivoId, nome)}>
            <Download size={15} /> Baixar
          </button>
          <button type="button" className={a.btnIcone} onClick={onFechar} aria-label="Fechar pré-visualização" autoFocus>
            <X size={18} />
          </button>
        </div>
        <div className={a.previaCorpo}>
          {estado.fase === 'carregando' && <p className={a.previaAviso}>Carregando…</p>}
          {estado.fase === 'sem-arquivo' && (
            <p className={a.previaAviso}>
              <FileQuestion size={28} /> O conteúdo deste arquivo não está neste navegador (pode ter sido guardado em outro computador).
            </p>
          )}
          {estado.fase === 'sem-previa' && (
            <p className={a.previaAviso}>
              <FileText size={28} /> Sem pré-visualização segura para este tipo de arquivo. Use “Baixar” para abrir no seu computador.
            </p>
          )}
          {estado.fase === 'pronto' && estado.tipo === 'imagem' && <img src={estado.url} alt={nome} className={a.previaImagem} />}
          {estado.fase === 'pronto' && estado.tipo === 'pdf' && <iframe src={estado.url} title={`PDF: ${nome}`} className={a.previaPdf} />}
          {estado.fase === 'pronto' && estado.tipo === 'texto' && <pre className={a.previaTexto}>{estado.texto}</pre>}
        </div>
      </div>
    </div>
  );
}

const EXT_IMAGEM = /\.(png|jpe?g|gif|webp)$/i;

/** Miniatura para a visualização em grade (só imagens conferidas pelo conteúdo). */
export function Miniatura({ arquivoId, nome, tipo }: { arquivoId: string; nome: string; tipo?: string }) {
  const podeSerImagem = EXT_IMAGEM.test(nome) || !!tipo?.startsWith('image/');
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!podeSerImagem) return;
    let vivo = true;
    let criada: string | undefined;
    (async () => {
      const blob = await lerArquivo(arquivoId).catch(() => undefined);
      if (!blob || !vivo) return;
      const mime = await tipoSeguro(blob, nome);
      if (!vivo || !mime?.startsWith('image/')) return;
      criada = URL.createObjectURL(new Blob([blob], { type: mime }));
      setUrl(criada);
    })();
    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [arquivoId, nome, podeSerImagem]);
  if (url) return <img src={url} alt="" className={a.miniaturaImg} loading="lazy" />;
  const Icone = podeSerImagem ? Imagem : FileText;
  return (
    <span className={a.miniaturaIcone} aria-hidden>
      <Icone size={28} />
      <small>{(nome.split('.').pop() ?? '').toUpperCase().slice(0, 5)}</small>
    </span>
  );
}
