'use client';

// ============================================
// JANELA DO PROJETO (abre ao clicar num card do Kanban)
// ============================================
// Cabeçalho fixo · abas horizontais · conteúdo editável à esquerda (~68%)
// · painel de fases fixo à direita (~32%). No celular vira tela cheia.
// Tudo salva sozinho (ver salvamento.tsx). As abas são liberadas conforme
// cada etapa fica pronta, para não exibir nada que só simula função.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { AlertTriangle, Building2, CalendarClock, Check, Loader2, Tag, UserRound, X } from 'lucide-react';
import j from './janela.module.css';
import { ProvedorSalvamento, useJanela, type Gravar, type GravarCliente } from './salvamento';
import { Etiquetas } from './campos';
import PainelFases from './PainelFases';
import Compartilhar from './Compartilhar';
import AbaFicha from './AbaFicha';
import AbaAtividades from './AbaAtividades';
import AbaTarefas, { ESTADO_TELA_TAREFAS, type EstadoTelaTarefas } from './AbaTarefas';
import AbaAnexos, { ESTADO_TELA_ANEXOS, type EstadoTelaAnexos } from './AbaAnexos';
import { estadoTarefa } from '../tarefas';
import { infoPrazo } from './prazo';
import { etapasProjeto, type AutorRegistro, type Cliente, type Projeto } from '../dados-exemplo';

export type IdAba = 'ficha' | 'tarefas' | 'anexos' | 'atividades';

const ABAS: Array<{ id: IdAba; nome: string }> = [
  { id: 'ficha', nome: 'Ficha' },
  { id: 'tarefas', nome: 'Tarefas' },
  { id: 'anexos', nome: 'Anexos' },
  { id: 'atividades', nome: 'Atividades' },
];

type Props = {
  projeto: Projeto;
  /** Cadastro do cliente vinculado (aba Clientes) */
  cliente: Cliente | undefined;
  autor: AutorRegistro;
  gravar: Gravar;
  gravarCliente: GravarCliente;
  responsaveis: string[];
  /** Aba que abre primeiro (ex.: vindo de um aviso de tarefa) */
  abaInicial?: IdAba;
  onFechar: () => void;
  onExcluir: () => void;
};

export default function JanelaProjeto(props: Props) {
  return (
    <ProvedorSalvamento projeto={props.projeto} cliente={props.cliente} autor={props.autor} gravar={props.gravar} gravarCliente={props.gravarCliente}>
      <Conteudo {...props} />
    </ProvedorSalvamento>
  );
}

function Conteudo({ projeto, responsaveis, abaInicial, onFechar, onExcluir }: Props) {
  const { temPendencias } = useJanela();
  const [aba, setAba] = useState<IdAba>(abaInicial ?? 'ficha');
  // filtros e tarefas abertas ficam aqui: trocar de aba não perde nada
  const [telaTarefas, setTelaTarefas] = useState<EstadoTelaTarefas>(ESTADO_TELA_TAREFAS);
  const [telaAnexos, setTelaAnexos] = useState<EstadoTelaAnexos>(ESTADO_TELA_ANEXOS);
  const tarefasAbertas = (projeto.tarefasProjeto ?? []).filter((x) => x.situacao !== 'concluida').length;
  const tarefasVencidas = (projeto.tarefasProjeto ?? []).filter((x) => estadoTarefa(x).estado === 'vencida').length;
  const janela = useRef<HTMLDivElement>(null);
  const abasRef = useRef<Array<HTMLButtonElement | null>>([]);
  const concluido = projeto.etapa === etapasProjeto[etapasProjeto.length - 1].id;
  const prazo = infoPrazo(projeto.prazoEntrega, concluido);

  const fechar = useCallback(() => {
    // sair do campo em edição grava o que foi digitado
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (temPendencias() && !window.confirm('Há alterações que não foram salvas neste navegador. Fechar mesmo assim? Elas serão perdidas.')) return;
    onFechar();
  }, [temPendencias, onFechar]);

  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [fechar]);

  useEffect(() => {
    janela.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  const navegarAbas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const destino = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? ABAS.length - 1 : null;
    if (destino == null) return;
    e.preventDefault();
    const n = (destino + ABAS.length) % ABAS.length;
    setAba(ABAS[n].id);
    abasRef.current[n]?.focus();
  };

  // "Adicionar responsável" do cabeçalho leva ao campo do painel ao lado (sempre visível)
  const focarResponsavel = () => {
    const el = document.querySelector<HTMLInputElement>('aside [data-campo="responsavel"]');
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <div className={j.fundo}>
      <div ref={janela} className={j.janela} role="dialog" aria-modal="true" aria-labelledby="titulo-projeto" tabIndex={-1}>
        <header className={j.topo}>
          <div className={j.topoLinha}>
            {projeto.codigo && <span className={j.codigo}>{projeto.codigo}</span>}
            <h2 id="titulo-projeto" className={j.titulo}>
              {projeto.servico}
            </h2>
            <div className={j.topoDireita}>
              <IndicadorSalvamento />
              <span className={j.prazoChip} data-tom={prazo.tom} title="Prazo de entrega">
                <CalendarClock size={14} aria-hidden /> {prazo.curto}
              </span>
              <Compartilhar />
              <button type="button" className={j.btnTopo} onClick={fechar} aria-label="Fechar projeto">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className={j.topoMeta}>
            {projeto.clienteId ? (
              <Link href={`/clientes/${encodeURIComponent(projeto.clienteId)}`} className={j.cliente}>
                <Building2 size={15} aria-hidden /> {projeto.cliente}
              </Link>
            ) : (
              <span className={j.cliente}>
                <Building2 size={15} aria-hidden /> {projeto.cliente}
              </span>
            )}
            <span className={j.separador} aria-hidden />
            <button type="button" className={j.linkAcao} onClick={focarResponsavel}>
              <UserRound size={14} /> {projeto.responsavel || 'Adicionar responsável'}
            </button>
            <span className={j.separador} aria-hidden />
            <span className={j.metaEtiquetas}>
              <Tag size={14} aria-hidden />
              <Etiquetas />
            </span>
          </div>
        </header>

        <nav className={j.abas} role="tablist" aria-label="Seções do projeto">
          {ABAS.map((a, i) => (
            <button
              key={a.id}
              ref={(el) => {
                abasRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls={`painel-${a.id}`}
              tabIndex={aba === a.id ? 0 : -1}
              className={`${j.abaBotao} ${aba === a.id ? j.abaAtiva : ''}`}
              onClick={() => setAba(a.id)}
              onKeyDown={(e) => navegarAbas(e, i)}
            >
              {a.nome}
              {a.id === 'atividades' && projeto.atividades?.length ? <span className={j.abaContador}>{projeto.atividades.length}</span> : null}
              {a.id === 'anexos' && projeto.arquivos?.length ? <span className={j.abaContador}>{projeto.arquivos.length}</span> : null}
              {a.id === 'tarefas' && tarefasAbertas > 0 ? (
                <span
                  className={`${j.abaContador} ${tarefasVencidas ? j.abaContadorAlerta : ''}`}
                  aria-label={`${tarefasAbertas} abertas${tarefasVencidas ? `, ${tarefasVencidas} vencidas` : ''}`}
                >
                  {tarefasAbertas}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className={j.corpo}>
          <main className={j.conteudo} role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
            {aba === 'ficha' && <AbaFicha onExcluir={onExcluir} responsaveis={responsaveis} />}
            {aba === 'tarefas' && <AbaTarefas responsaveis={responsaveis} tela={telaTarefas} setTela={setTelaTarefas} />}
            {aba === 'anexos' && <AbaAnexos tela={telaAnexos} setTela={setTelaAnexos} />}
            {aba === 'atividades' && <AbaAtividades />}
          </main>
          <PainelFases responsaveis={responsaveis} />
        </div>
      </div>
    </div>
  );
}

function IndicadorSalvamento() {
  const { estado, tentarDeNovo } = useJanela();
  const hora = useMemo(
    () => (estado.tipo === 'salvo' ? new Date(estado.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''),
    [estado]
  );
  return (
    <span className={j.salvamento} data-estado={estado.tipo} role="status" aria-live="polite">
      {estado.tipo === 'pendente' && (
        <>
          <Loader2 size={14} className={j.girando} aria-hidden /> Salvando…
        </>
      )}
      {estado.tipo === 'salvo' && (
        <>
          <Check size={14} aria-hidden /> Salvo às {hora}
        </>
      )}
      {estado.tipo === 'erro' && (
        <>
          <AlertTriangle size={14} aria-hidden /> Não foi possível salvar.
          <button type="button" onClick={tentarDeNovo}>
            Tentar de novo
          </button>
        </>
      )}
    </span>
  );
}
