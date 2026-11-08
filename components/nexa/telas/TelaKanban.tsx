'use client';

// ABA KANBAN — projetos, do planejamento à entrega.
// As fases são as mesmas que o cliente vê no link de acompanhamento.
// Dados salvos neste navegador (ver store.ts).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CalendarClock, CalendarDays, ChevronRight, Info, ListChecks, MessageSquare, Paperclip, Plus, UserRound } from 'lucide-react';
import NexaShell from '../NexaShell';
import Modal from '../Modal';
import Quadro from '../Quadro';
import u from '../ui.module.css';
import k from './kanban.module.css';
import { etapasProjeto, type Cliente, type Projeto } from '../dados-exemplo';
import { normalizarNome } from '../relacoes';
import { adicionarServico } from '../projetos';
import type { ServicoNexa } from '../servicos-nexa';
import { autorAtual, diasPrazoProximo, mudarFaseProjeto, novaAtividade, progressoPadrao, proximoCodigoProjeto, useClientes, useLeads, usePerfil, usePreferencias, useProjetos, useServicos } from '../dados';
import { nomeServicoProjeto } from '../projetos';
import { estadoTarefa } from '../tarefas';
import { infoPrazo } from '../projeto/prazo';
import { dataBr } from '../financeiro';
import { EVENTO_ABRIR_PROJETO, useParametro } from '../util';
import type { IdAba } from '../projeto/JanelaProjeto';
import { gerarCodigoPublico } from '../acompanhamento';
import JanelaProjeto from '../projeto/JanelaProjeto';
import type { Transformar, TransformarCliente } from '../projeto/salvamento';

export default function TelaKanban() {
  const [projetos, setProjetos] = useProjetos();
  const [perfil] = usePerfil();
  const [leads] = useLeads();
  const [clientes, setClientes] = useClientes();
  const [catalogo] = useServicos();
  const [prefs] = usePreferencias();
  const diasProx = diasPrazoProximo(prefs);
  const autor = useMemo(() => autorAtual(perfil), [perfil]);
  const [novaEtapa, setNovaEtapa] = useState<string | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const projetoUrl = useParametro('projeto');
  const abaUrl = useParametro('aba');
  const [abaInicial, setAbaInicial] = useState<IdAba | undefined>(undefined);

  useEffect(() => {
    if (projetoUrl) setAbertoId(projetoUrl);
    if (abaUrl === 'tarefas' || abaUrl === 'anexos' || abaUrl === 'atividades' || abaUrl === 'ficha') setAbaInicial(abaUrl);
  }, [projetoUrl, abaUrl]);

  // Pedido para abrir um projeto vindo de outro ponto da tela (ex.: aviso de tarefa no sininho)
  useEffect(() => {
    const abrir = (e: Event) => {
      const { id, aba } = (e as CustomEvent<{ id: string; aba?: IdAba }>).detail;
      setAbaInicial(aba);
      setAbertoId(null);
      window.setTimeout(() => setAbertoId(id), 0);
    };
    window.addEventListener(EVENTO_ABRIR_PROJETO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_PROJETO, abrir);
  }, []);

  const mover = (id: string, etapa: string, posicao: number) => {
    setProjetos((lista) => {
      const item = lista.find((p) => p.id === id);
      if (!item) return lista;
      const atualizado: Projeto = mudarFaseProjeto(item, etapa, autor);
      const resto = lista.filter((p) => p.id !== id);
      const daEtapa = resto.filter((p) => p.etapa === etapa);
      const ancora = daEtapa[posicao];
      const idx = ancora
        ? resto.indexOf(ancora)
        : daEtapa.length
          ? resto.indexOf(daEtapa[daEtapa.length - 1]) + 1
          : resto.length;
      return [...resto.slice(0, idx), atualizado, ...resto.slice(idx)];
    });
  };

  const aberto = abertoId ? projetos.find((p) => p.id === abertoId) ?? null : null;

  // Link permanente nasce na primeira abertura (o código PRJ-0001 já vem da criação / ReconciliarRelacoes)
  useEffect(() => {
    if (!aberto || aberto.codigoPublico) return;
    setProjetos((l) => l.map((x) => (x.id === aberto.id && !x.codigoPublico ? { ...x, codigoPublico: gerarCodigoPublico() } : x)));
  }, [aberto, setProjetos]);

  const clienteAberto = aberto?.clienteId ? clientes.find((c) => c.id === aberto.clienteId) : undefined;
  const gravarCliente = useCallback(
    (t: TransformarCliente) => {
      const id = clienteAberto?.id;
      if (!id) return false;
      return setClientes((l) => l.map((c) => (c.id === id ? t(c) : c)));
    },
    [clienteAberto?.id, setClientes]
  );

  const gravar = useCallback(
    (t: Transformar) => setProjetos((l) => l.map((x) => (x.id === abertoId ? t(x) : x))),
    [abertoId, setProjetos]
  );

  // Nomes já usados como responsável (projetos, leads e o nome configurado)
  const responsaveis = useMemo(
    () =>
      Array.from(
        new Set([perfil.nome, ...projetos.map((p) => p.responsavel), ...leads.map((l) => l.responsavel)].map((n) => n?.trim()).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [perfil.nome, projetos, leads]
  );

  return (
    <NexaShell aba="kanban">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Kanban</h1>
            <p>Projetos em andamento, do planejamento à entrega.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
          <div className={u.acoesCabecalho}>
            <button type="button" className={u.btnPrimario} onClick={() => setNovaEtapa(etapasProjeto[0].id)}>
              <Plus size={18} strokeWidth={2.2} /> Novo projeto
            </button>
          </div>
        </div>

        <Quadro
          etapas={etapasProjeto}
          itens={projetos}
          onMover={mover}
          onAbrir={(p) => setAbertoId(p.id)}
          resumoColuna={(itens) => `${itens.length} ${itens.length === 1 ? 'projeto' : 'projetos'}`}
          textoAdicionar="Adicionar projeto"
          onAdicionar={(etapa) => setNovaEtapa(etapa)}
          renderCartao={(p) => <CartaoProjeto projeto={p} catalogo={catalogo} diasProximo={diasProx} />}
        />

        <p className={u.nota}>
          <Info size={16} /> Clique num card para abrir o projeto. O percentual é automático: pela fase do Kanban ou pelas tarefas concluídas, conforme o projeto.
        </p>
      </div>

      {novaEtapa && (
        <ModalNovoProjeto
          etapaInicial={novaEtapa}
          clientes={clientes}
          onFechar={() => setNovaEtapa(null)}
          onSalvar={(p, novoCliente, escolha) => {
            if (novoCliente && !setClientes((l) => [novoCliente, ...l])) {
              window.alert('Não foi possível salvar o novo cliente neste navegador. Nada foi criado; tente de novo.');
              return;
            }
            const agora = new Date();
            setProjetos((l) => {
              let novo: Projeto = {
                ...p,
                codigo: proximoCodigoProjeto(l),
                atividades: [novaAtividade('dado', `Projeto criado no Kanban${escolha ? ` com o serviço ${escolha.servico.nome}` : ''}`, autor, agora)],
              };
              if (escolha) {
                novo = adicionarServico(novo, escolha.servico, escolha.copiarChecklist, agora, autor);
                const n = novo.tarefasProjeto?.length ?? 0;
                if (n) novo = { ...novo, atividades: [...(novo.atividades ?? []), novaAtividade('tarefa', `${n} tarefa${n > 1 ? 's' : ''} criada${n > 1 ? 's' : ''} a partir do checklist de ${escolha.servico.nome}`, autor, agora)] };
              }
              return [...l, novo];
            });
            setNovaEtapa(null);
          }}
        />
      )}

      {aberto && (
        <JanelaProjeto
          key={aberto.id}
          projeto={aberto}
          cliente={clienteAberto}
          autor={autor}
          gravar={gravar}
          gravarCliente={gravarCliente}
          responsaveis={responsaveis}
          abaInicial={abaInicial}
          onFechar={() => {
            setAbertoId(null);
            setAbaInicial(undefined);
          }}
          onExcluir={() => {
            setProjetos((l) => l.filter((x) => x.id !== aberto.id));
            setAbertoId(null);
          }}
        />
      )}
    </NexaShell>
  );
}

function ModalNovoProjeto({
  etapaInicial,
  clientes,
  onFechar,
  onSalvar,
}: {
  etapaInicial: string;
  clientes: Cliente[];
  onFechar: () => void;
  /** novoCliente: cadastrar em Clientes antes de criar o projeto; servico: serviço principal (e se copia o checklist) */
  onSalvar: (p: Projeto, novoCliente?: Cliente, servico?: { servico: ServicoNexa; copiarChecklist: boolean }) => void;
}) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [servicosNexa] = useServicos();
  const [servicoId, setServicoId] = useState('');
  const [nome, setNome] = useState('');
  const [nomeEditado, setNomeEditado] = useState(false);
  const [etapa, setEtapa] = useState(etapaInicial);
  const [copiar, setCopiar] = useState(true);
  const servico = servicosNexa.find((s) => s.id === servicoId);
  const existente = nomeCliente.trim()
    ? clientes.find((c) => [c.nome, c.nomeCompleto].some((n) => normalizarNome(n) === normalizarNome(nomeCliente)))
    : undefined;

  const salvar = () => {
    const agora = new Date();
    const novoCliente: Cliente | undefined = existente
      ? undefined
      : {
          id: `c-${agora.getTime().toString(36)}`,
          nome: nomeCliente.trim(),
          segmento: '',
          status: 'Ativo',
          servicos: [],
          ultimaAtividade: '',
          origem: 'manual',
          criadoEm: agora.toISOString(),
          historico: [],
        };
    const cli = existente ?? novoCliente!;
    onSalvar(
      {
        id: `p-${agora.getTime()}`,
        cliente: cli.nome,
        clienteId: cli.id,
        servico: nome.trim(),
        etapa,
        progresso: progressoPadrao(etapa),
        atualizadoEm: agora.toISOString(),
      },
      novoCliente,
      servico ? { servico, copiarChecklist: copiar } : undefined
    );
  };

  return (
    <Modal
      titulo="Novo projeto"
      descricao="O projeto recebe um código (PRJ-0001…) assim que é criado."
      onFechar={onFechar}
      textoEnviar="Adicionar"
      podeEnviar={!!nomeCliente.trim() && !!nome.trim()}
      onEnviar={salvar}
    >
      <div className={u.formGrade}>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Cliente *</span>
          <input className={u.entrada} value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} list="clientes-cadastrados" required autoFocus />
          <datalist id="clientes-cadastrados">
            {clientes.map((c) => (
              <option key={c.id} value={c.nome} />
            ))}
          </datalist>
          {nomeCliente.trim() && (
            <small className={k.dicaCliente}>
              {existente ? `Cliente já cadastrado: o projeto será ligado a “${existente.nome}”.` : 'Cliente novo: será cadastrado também na aba Clientes.'}
            </small>
          )}
        </label>
        <label className={u.campo}>
          <span>Serviço principal</span>
          <select
            className={u.entrada}
            value={servicoId}
            onChange={(e) => {
              setServicoId(e.target.value);
              const s = servicosNexa.find((x) => x.id === e.target.value);
              if (!nomeEditado) setNome(s?.nome ?? '');
            }}
          >
            <option value="">Sem serviço por enquanto</option>
            {servicosNexa.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={u.campo}>
          <span>Fase</span>
          <select className={u.entrada} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
            {etapasProjeto.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Nome do projeto * (o cliente vê)</span>
          <input
            className={u.entrada}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setNomeEditado(true);
            }}
          />
        </label>
        {servico?.checklist?.length ? (
          <label className={`${k.marcar} ${u.formCheia}`}>
            <input type="checkbox" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} />
            <span>Usar o checklist padrão de {servico.nome} como modelo ({servico.checklist.length} itens)</span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

/** Frente do card no Kanban: o essencial do projeto num relance. */
function CartaoProjeto({ projeto: p, catalogo, diasProximo }: { projeto: Projeto; catalogo: ServicoNexa[]; diasProximo: number }) {
  const concluido = p.etapa === etapasProjeto[etapasProjeto.length - 1].id;
  const prazo = infoPrazo(p.prazoEntrega, concluido);
  const servicos = [...(p.servicos ?? [])].sort((a, b) => Number(b.principal) - Number(a.principal));
  const tarefas = p.tarefasProjeto ?? [];
  const feitas = tarefas.filter((t) => t.situacao === 'concluida').length;
  const vencidas = tarefas.filter((t) => estadoTarefa(t, undefined, diasProximo).estado === 'vencida').length;
  const abertas = tarefas.filter((t) => t.situacao !== 'concluida');
  const proxima = [...abertas].sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))[0];
  const estProxima = proxima ? estadoTarefa(proxima, undefined, diasProximo) : null;
  const comentarios = (p.atividades ?? []).filter((a) => a.tipo === 'comentario').length + tarefas.reduce((n, t) => n + (t.comentarios?.length ?? 0), 0);
  const etiquetas = p.etiquetas ?? [];
  const pessoas = [p.responsavel, ...(p.equipe ?? [])].filter(Boolean) as string[];
  const prioridade = p.prioridade === 'urgente' ? 'Urgente' : p.prioridade === 'alta' ? 'Alta' : p.prioridade === 'media' ? 'Média' : p.prioridade === 'baixa' ? 'Baixa' : null;
  const porTarefas = p.modoProgresso === 'tarefas';
  const pct = porTarefas && !tarefas.length ? null : p.progresso;
  const tomPrazo = !p.prazoEntrega ? null : concluido ? 'ok' : prazo.dias != null && prazo.dias < 0 ? 'vencido' : prazo.dias != null && prazo.dias <= diasProximo ? 'proximo' : 'normal';
  const textoPrazo = !p.prazoEntrega ? '' : concluido ? `Entregue · prazo ${dataBr(p.prazoEntrega)}` : prazo.dias != null && prazo.dias < 0 ? `Vencido ${dataBr(p.prazoEntrega)}` : `Entrega ${dataBr(p.prazoEntrega)}`;
  const relativo = concluido || prazo.dias == null ? '' : prazo.dias === 0 ? 'hoje' : prazo.dias === 1 ? 'amanhã' : prazo.dias > 0 ? `em ${prazo.dias} dias` : `há ${-prazo.dias} dia${prazo.dias < -1 ? 's' : ''}`;
  const atualizado = (() => {
    const d = new Date(p.atualizadoEm);
    if (Number.isNaN(d.getTime())) return '';
    const dias = Math.floor((Date.now() - d.getTime()) / 864e5);
    return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
  })();
  const iniciaisDe = (n: string) =>
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join('');

  return (
    <section className={k.cartao}>
      <header className={k.cartaoTopo}>
        <b className={k.cartaoCodigo}>{p.codigo ?? 'PRJ'}</b>
        {prioridade && (
          <em className={k.cartaoPrioridade} data-nivel={p.prioridade}>
            {prioridade}
          </em>
        )}
        {p.leadId && <em className={k.seloVenda}>Venda</em>}
        <ChevronRight size={16} className={k.cartaoSeta} aria-hidden />
      </header>

      <p className={k.cartaoCliente} title={p.cliente}>
        <Building2 size={14} aria-hidden /> {p.cliente}
      </p>
      <p className={k.cartaoNome} title={p.servico}>
        {p.servico}
      </p>

      {servicos.length > 0 && (
        <ul className={k.cartaoServicos} aria-label="Serviços contratados">
          {servicos.slice(0, 3).map((sp) => (
            <li key={sp.id} className={sp.principal ? k.cartaoServicoPrincipal : undefined}>
              {nomeServicoProjeto(sp, catalogo)}
            </li>
          ))}
          {servicos.length > 3 && <li>+{servicos.length - 3}</li>}
        </ul>
      )}

      <dl className={k.cartaoCampos}>
        <dt>
          <UserRound size={13} aria-hidden /> Responsável
        </dt>
        <dd>
          {pessoas.length ? (
            <span className={k.cartaoPessoas}>
              {pessoas.slice(0, 3).map((n, i) => (
                <i key={`${n}-${i}`} title={i === 0 && p.responsavel ? `${n} (responsável)` : n}>
                  {iniciaisDe(n)}
                </i>
              ))}
              <span>{p.responsavel ?? pessoas[0]}</span>
              {pessoas.length > 3 && <small>+{pessoas.length - 3}</small>}
            </span>
          ) : (
            <span className={k.cartaoVazio}>sem responsável</span>
          )}
        </dd>
        {(p.inicio || p.prazoEntrega) && (
          <>
            <dt>
              <CalendarDays size={13} aria-hidden /> Período
            </dt>
            <dd>
              {p.inicio ? dataBr(p.inicio) : '—'} → {p.prazoEntrega ? dataBr(p.prazoEntrega) : 'sem prazo'}
            </dd>
          </>
        )}
        {proxima && (
          <>
            <dt>
              <ListChecks size={13} aria-hidden /> Próxima
            </dt>
            <dd className={estProxima?.estado === 'vencida' ? k.cartaoAlerta : estProxima?.estado === 'proxima' ? k.cartaoAtencao : undefined} title={proxima.titulo}>
              {proxima.titulo}
              {proxima.prazo ? ` · ${dataBr(proxima.prazo)}` : ''}
            </dd>
          </>
        )}
      </dl>

      {etiquetas.length > 0 && (
        <ul className={k.cartaoEtiquetas} aria-label="Etiquetas">
          {etiquetas.slice(0, 3).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {etiquetas.length > 3 && <li>+{etiquetas.length - 3}</li>}
        </ul>
      )}

      <div className={k.cartaoProgresso} title={porTarefas ? 'Progresso pelas tarefas concluídas' : 'Percentual fixo da fase'}>
        <span className={k.progresso} aria-hidden>
          <i style={{ width: `${pct ?? 0}%` }} />
        </span>
        <b>{pct == null ? '–' : `${pct}%`}</b>
        <small>{porTarefas ? 'tarefas' : 'fase'}</small>
      </div>

      {tomPrazo && (
        <p className={k.cartaoPrazoLinha}>
          <span className={k.cartaoPrazo} data-tom={tomPrazo}>
            <CalendarClock size={13} aria-hidden /> {textoPrazo}
          </span>
          {relativo && <small className={k.cartaoRelativo}>{relativo}</small>}
        </p>
      )}

      <footer className={k.cartaoRodape}>
        <span className={k.cartaoInfos}>
          {tarefas.length > 0 && (
            <span title={`${feitas} de ${tarefas.length} tarefas concluídas${vencidas ? `, ${vencidas} vencida(s)` : ''}`} className={vencidas ? k.cartaoAlerta : undefined}>
              {vencidas ? <AlertTriangle size={13} aria-hidden /> : <ListChecks size={13} aria-hidden />} {feitas}/{tarefas.length}
            </span>
          )}
          {(p.arquivos?.length ?? 0) > 0 && (
            <span title="Arquivos na biblioteca">
              <Paperclip size={13} aria-hidden /> {p.arquivos!.length}
            </span>
          )}
          {comentarios > 0 && (
            <span title="Comentários">
              <MessageSquare size={13} aria-hidden /> {comentarios}
            </span>
          )}
          {p.valor != null && p.valor > 0 && <span title="Valor da venda">{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>}
        </span>
        {atualizado && <small className={k.cartaoRelativo}>atualizado {atualizado}</small>}
      </footer>
    </section>
  );
}
