'use client';

// Quadro em colunas com arrastar e soltar (usado no CRM e no Kanban).
// As mudanças ficam só na tela: ainda não há banco para salvar.

import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import u from './ui.module.css';

export type EtapaQuadro = { id: string; nome: string; cor: string };
export type ItemQuadro = { id: string; etapa: string };

type Props<T extends ItemQuadro> = {
  etapas: EtapaQuadro[];
  itens: T[];
  onMover: (id: string, etapa: string, posicao: number) => void;
  renderCartao: (item: T) => ReactNode;
  /** Linha abaixo do nome da coluna (ex.: total em R$) */
  resumoColuna?: (itens: T[]) => ReactNode;
  textoAdicionar: string;
  onAdicionar: (etapa: string) => void;
  /** Clique (ou Enter) no cartão */
  onAbrir?: (item: T) => void;
};

export default function Quadro<T extends ItemQuadro>({
  etapas,
  itens,
  onMover,
  renderCartao,
  resumoColuna,
  textoAdicionar,
  onAdicionar,
  onAbrir,
}: Props<T>) {
  const aoSoltar = (r: DropResult) => {
    if (!r.destination) return;
    if (r.destination.droppableId === r.source.droppableId && r.destination.index === r.source.index) return;
    onMover(r.draggableId, r.destination.droppableId, r.destination.index);
  };

  const ultima = etapas[etapas.length - 1]?.id;

  return (
    <DragDropContext onDragEnd={aoSoltar}>
      <div className={u.quadro}>
        {etapas.map((etapa) => {
          const daEtapa = itens.filter((i) => i.etapa === etapa.id);
          return (
            <section
              key={etapa.id}
              className={`${u.coluna} ${etapa.id === ultima ? u.colunaFinal : ''}`}
              aria-label={etapa.nome}
            >
              <header className={u.colunaTopo}>
                <span className={u.ponto} style={{ background: etapa.cor }} aria-hidden />
                <h3>{etapa.nome}</h3>
                <span className={`${u.contador} ${u.empurra}`}>{daEtapa.length}</span>
              </header>
              <p className={u.colunaTotal}>{resumoColuna ? resumoColuna(daEtapa) : ' '}</p>
              <Droppable droppableId={etapa.id}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                    className={`${u.colunaLista} ${snap.isDraggingOver ? u.colunaListaAlvo : ''}`}
                  >
                    {daEtapa.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(p, s) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            {...p.dragHandleProps}
                            className={`${u.cartaoQuadro} ${s.isDragging ? u.cartaoArrastando : ''}`}
                            onClick={onAbrir ? () => onAbrir(item) : undefined}
                            onKeyDown={onAbrir ? (e) => e.key === 'Enter' && onAbrir(item) : undefined}
                          >
                            {renderCartao(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {prov.placeholder}
                  </div>
                )}
              </Droppable>
              <button type="button" className={u.adicionar} onClick={() => onAdicionar(etapa.id)}>
                <Plus size={16} strokeWidth={2} /> {textoAdicionar}
              </button>
            </section>
          );
        })}
      </div>
    </DragDropContext>
  );
}

/** Move um item para outra etapa/posição, mantendo a ordem dos demais. */
export function moverItem<T extends ItemQuadro>(lista: T[], id: string, etapa: string, posicao: number): T[] {
  const item = lista.find((i) => i.id === id);
  if (!item) return lista;
  const resto = lista.filter((i) => i.id !== id);
  const atualizado = { ...item, etapa };
  const daEtapa = resto.filter((i) => i.etapa === etapa);
  const ancora = daEtapa[posicao];
  if (!ancora) {
    // vai para o fim da etapa: depois do último item dela (ou no fim da lista)
    const ultimo = daEtapa[daEtapa.length - 1];
    const idx = ultimo ? resto.indexOf(ultimo) + 1 : resto.length;
    return [...resto.slice(0, idx), atualizado, ...resto.slice(idx)];
  }
  const idx = resto.indexOf(ancora);
  return [...resto.slice(0, idx), atualizado, ...resto.slice(idx)];
}

export { iniciais } from './util';
