'use client';

// ABA ATIVIDADES — linha do tempo do projeto.
// Só recebe registros novos: nada do que já foi registrado é editado ou apagado.

import { ArrowRightLeft, CheckSquare, FileText, MessageSquare, Paperclip, PencilLine, UserRound } from 'lucide-react';
import j from './janela.module.css';
import { useJanela } from './salvamento';
import type { AtividadeProjeto, TipoAtividade } from '../dados-exemplo';

const ICONES: Record<TipoAtividade, typeof PencilLine> = {
  fase: ArrowRightLeft,
  dado: PencilLine,
  responsavel: UserRound,
  tarefa: CheckSquare,
  arquivo: Paperclip,
  documento: FileText,
  comentario: MessageSquare,
};

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nomeAutor(a: AtividadeProjeto) {
  return a.autor.autenticado ? a.autor.nome : `${a.autor.nome} (não autenticado)`;
}

export default function AbaAtividades() {
  const { projeto, salvarComAtividade, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const lista = [...(projeto.atividades ?? [])].reverse();
  const comentario = rascunho('comentario') ?? '';

  const enviar = () => {
    const t = comentario.trim();
    if (!t) return;
    if (salvarComAtividade((p) => p, 'comentario', t.slice(0, 2000))) descartarRascunho('comentario');
  };

  return (
    <div className={j.aba}>
      <section className={j.secao}>
        <h3 className={j.secaoTitulo}>Comentário interno</h3>
        <div className={j.comentarioCaixa}>
          <label htmlFor="novo-comentario" className={j.somenteLeitor}>
            Novo comentário interno
          </label>
          <textarea
            id="novo-comentario"
            className={j.entradaArea}
            rows={3}
            maxLength={2000}
            value={comentario}
            placeholder="Escreva um comentário para a equipe (o cliente não vê)."
            onChange={(e) => mudarRascunho('comentario', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                enviar();
              }
            }}
          />
          <div className={j.comentarioAcoes}>
            <small className={j.campoDica}>Ctrl + Enter para enviar. Comentários enviados não podem ser editados.</small>
            <button type="button" className={j.btnLima} onClick={enviar} disabled={!comentario.trim()}>
              Adicionar comentário
            </button>
          </div>
        </div>
      </section>

      <section className={j.secao}>
        <h3 className={j.secaoTitulo}>Linha do tempo</h3>
        {lista.length ? (
          <ol className={j.linhaTempo}>
            {lista.map((a) => {
              const Icone = ICONES[a.tipo] ?? PencilLine;
              return (
                <li key={a.id} className={a.tipo === 'comentario' ? j.ltComentario : ''}>
                  <span className={j.ltIcone} aria-hidden>
                    <Icone size={14} />
                  </span>
                  <div>
                    <p>{a.texto}</p>
                    <small>
                      {nomeAutor(a)} · <time dateTime={a.em}>{quando(a.em)}</time>
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={j.vazio}>
            Nenhuma atividade ainda. A partir de agora ficam registradas as mudanças de fase, de responsável, de prazo e
            de dados importantes, além dos comentários.
          </p>
        )}
      </section>
    </div>
  );
}
