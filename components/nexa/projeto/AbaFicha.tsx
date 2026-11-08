'use client';

// ============================================
// ABA FICHA — blocos com ícone, título e explicação (recolhíveis) + atalhos no topo
// ============================================
// Cliente (cartão-resumo do cadastro único; dados no lápis) · Dados gerais · Serviços
// · Escopo · Datas (prazo com alerta) · Responsáveis · Prioridade e etiquetas
// · Observações internas · Campos do serviço · Origem da venda (recolhida).
// ============================================

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  ListChecks,
  Pencil,
  SlidersHorizontal,
  Star,
  StickyNote,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import j from './janela.module.css';
import { useJanela } from './salvamento';
import { CampoData, CampoLista, CampoMarcar, CampoTexto, ListaChips } from './campos';
import DadosDaVenda from '../telas/DadosDaVenda';
import { etapasProjeto, type Cliente, type PrioridadeProjeto, type ServicoProjeto } from '../dados-exemplo';
import { infoPrazo } from './prazo';
import { documentoValido, nomeEtapaProjeto, useClientes, useProjetos, useServicos } from '../dados';
import type { ServicoNexa } from '../servicos-nexa';
import { digitosDocumento, normalizarNome } from '../relacoes';
import {
  adicionarServico,
  camposNaFicha,
  copiarChecklistPara,
  definirValorCampo,
  nomeServicoProjeto,
  obrigatoriosPendentes,
  removerServico,
  servicoSugerido,
  tornarPrincipal,
  alterarServicoProjeto,
  validarTexto,
  type CampoNaFicha,
} from '../projetos';
import { dataBr } from '../financeiro';

export const PRIORIDADES: Array<{ id: PrioridadeProjeto; nome: string }> = [
  { id: 'baixa', nome: 'Baixa' },
  { id: 'media', nome: 'Média' },
  { id: 'alta', nome: 'Alta' },
  { id: 'urgente', nome: 'Urgente' },
];

function dataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

const BLOCOS = [
  { id: 'cliente', nome: 'Cliente' },
  { id: 'projeto', nome: 'Projeto' },
  { id: 'servicos', nome: 'Serviços' },
  { id: 'escopo', nome: 'Escopo' },
  { id: 'datas', nome: 'Datas' },
  { id: 'responsaveis', nome: 'Responsáveis' },
  { id: 'prioridade', nome: 'Prioridade' },
  { id: 'observacoes', nome: 'Observações' },
  { id: 'campos', nome: 'Campos do serviço' },
] as const;

export default function AbaFicha({ onExcluir, responsaveis }: { onExcluir: () => void; responsaveis: string[] }) {
  const { projeto, cliente } = useJanela();
  const [catalogo] = useServicos();
  const [fechados, setFechados] = useState<Record<string, boolean>>({ origem: true });
  const [excluir, setExcluir] = useState(false);
  const alternar = (id: string) => setFechados((f) => ({ ...f, [id]: !f[id] }));
  const servicos = projeto.servicos ?? [];
  const pendentes = servicos.reduce(
    (n, sp) =>
      n +
      obrigatoriosPendentes(
        sp,
        catalogo.find((s) => s.id === sp.servicoId),
      ).length,
    0,
  );
  const concluido = projeto.etapa === etapasProjeto[etapasProjeto.length - 1].id;
  const prazo = infoPrazo(projeto.prazoEntrega, concluido);
  const fase = nomeEtapaProjeto(projeto.etapa);
  const alertaPrazo =
    !concluido && prazo.dias != null && prazo.dias < 0 ? (
      <>
        <AlertTriangle size={16} aria-hidden />
        <span>
          Prazo vencido há {-prazo.dias} dia{prazo.dias < -1 ? 's' : ''} e o projeto ainda está em <b>{fase}</b>.
        </span>
      </>
    ) : !concluido && prazo.dias != null && prazo.dias <= 3 ? (
      <>
        <AlertTriangle size={16} aria-hidden />
        <span>
          {prazo.dias === 0 ? 'A entrega é hoje' : `Faltam ${prazo.dias} dia${prazo.dias > 1 ? 's' : ''} para a entrega`} e o projeto está em{' '}
          <b>{fase}</b>.
        </span>
      </>
    ) : undefined;

  const irPara = (id: string) => {
    setFechados((f) => ({ ...f, [id]: false }));
    window.requestAnimationFrame(() => document.getElementById(`bloco-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  return (
    <div className={j.aba}>
      <nav className={j.atalhos} aria-label="Blocos da ficha">
        {BLOCOS.map((b) => {
          const alerta = (b.id === 'cliente' && !cliente) || (b.id === 'campos' && pendentes > 0) || (b.id === 'datas' && !!alertaPrazo);
          return (
            <button key={b.id} type="button" className={`${j.atalho} ${alerta ? j.atalhoAlerta : ''}`} onClick={() => irPara(b.id)}>
              {b.nome}
              {alerta && <i className={j.atalhoPonto} aria-label="precisa de atenção" />}
            </button>
          );
        })}
      </nav>

      <Bloco
        id="cliente"
        icone={<Users size={20} />}
        titulo="Dados do cliente"
        subtitulo={
          cliente
            ? 'Cadastro único em Clientes: o que mudar aqui vale para todos os projetos dele.'
            : 'Vincule este projeto a um cliente existente ou cadastre um novo.'
        }
        fechado={fechados.cliente}
        onAlternar={alternar}
      >
        <BlocoCliente />
      </Bloco>

      <Bloco
        id="projeto"
        icone={<FolderOpen size={20} />}
        titulo="Dados gerais do projeto"
        subtitulo="Informações principais e de organização do projeto."
        fechado={fechados.projeto}
        onAlternar={alternar}
      >
        <div className={j.grade}>
          <CampoTexto
            id="servico"
            rotulo="Nome do projeto (o cliente vê)"
            valor={projeto.servico}
            obrigatorio
            largo
            maxLength={120}
            aplicar={(t) => (p) => ({ ...p, servico: t, atualizadoEm: new Date().toISOString() })}
            registro={{ tipo: 'dado', texto: (a, d) => `Nome do projeto: “${a}” → “${d}”` }}
          />
          <Info rotulo="Código do projeto" valor={projeto.codigo ?? '—'} />
          <Info rotulo="Fase atual" valor={fase} />
          <Info
            rotulo="Origem"
            largo
            valor={projeto.leadId ? `Venda ganha em ${dataHora(projeto.vendidoEm) || '—'}` : 'Cadastrado direto no Kanban'}
            extra={
              projeto.leadId ? (
                <Link href={`/crm?lead=${projeto.leadId}`} className={j.linkPequeno}>
                  Ver negociação <ExternalLink size={12} />
                </Link>
              ) : undefined
            }
          />
        </div>
      </Bloco>

      <Bloco
        id="servicos"
        icone={<Layers size={20} />}
        titulo="Serviços contratados"
        subtitulo={servicos.length ? 'Serviço principal e adicionais deste projeto.' : 'Vincule o serviço principal deste projeto.'}
        fechado={fechados.servicos}
        onAlternar={alternar}
      >
        <BlocoServicos catalogo={catalogo} onIrCampos={() => irPara('campos')} />
      </Bloco>

      <Bloco
        id="escopo"
        icone={<FileText size={20} />}
        titulo="Escopo e descrição"
        subtitulo="O que é o projeto e o que está incluído."
        fechado={fechados.escopo}
        onAlternar={alternar}
      >
        <CampoTexto
          id="descricao"
          rotulo="Descrição"
          valor={projeto.descricao ?? ''}
          area
          maxLength={2000}
          placeholder="Resumo do que é o projeto."
          aplicar={(t) => (p) => ({ ...p, descricao: t || undefined })}
          registro={{ tipo: 'dado', texto: () => 'Descrição do projeto atualizada' }}
        />
        <CampoTexto
          id="escopo"
          rotulo="Escopo contratado"
          valor={projeto.escopo ?? ''}
          area
          maxLength={6000}
          placeholder="O que está incluído e o que não está."
          aplicar={(t) => (p) => ({ ...p, escopo: t || undefined })}
          registro={{ tipo: 'dado', texto: () => 'Escopo contratado atualizado' }}
        />
      </Bloco>

      <Bloco
        id="datas"
        icone={<CalendarDays size={20} />}
        titulo="Datas e prazos"
        subtitulo="Início, entrega e marcos do projeto."
        fechado={fechados.datas}
        onAlternar={alternar}
      >
        <CampoData
          id="prazo"
          rotulo="Prazo de entrega"
          valor={projeto.prazoEntrega ?? ''}
          dica={projeto.prazoEntrega ? prazo.texto : undefined}
          alerta={alertaPrazo}
          aplicar={(t) => (p) => ({ ...p, prazoEntrega: t || undefined })}
          registro={{ tipo: 'dado', texto: (a, d) => `Prazo de entrega: ${a ? dataBr(a) : 'sem data'} → ${d ? dataBr(d) : 'sem data'}` }}
        />
        <div className={j.grade}>
          <CampoData
            id="inicio"
            rotulo="Data de início"
            valor={projeto.inicio ?? ''}
            aplicar={(t) => (p) => ({ ...p, inicio: t || undefined })}
            registro={{ tipo: 'dado', texto: (a, d) => `Início: ${a ? dataBr(a) : 'sem data'} → ${d ? dataBr(d) : 'sem data'}` }}
          />
          {projeto.vendidoEm && <Info rotulo="Venda ganha em" valor={dataHora(projeto.vendidoEm)} />}
          {projeto.concluidoEm && <Info rotulo="Concluído em" valor={dataBr(projeto.concluidoEm)} />}
          <Info rotulo="Última atualização vista pelo cliente" valor={dataHora(projeto.atualizadoEm)} />
        </div>
      </Bloco>

      <Bloco
        id="responsaveis"
        icone={<UserRound size={20} />}
        titulo="Responsáveis"
        subtitulo="Quem cuida do projeto na Nexa Lab."
        fechado={fechados.responsaveis}
        onAlternar={alternar}
      >
        <div className={j.grade}>
          <CampoTexto
            id="responsavel"
            rotulo="Responsável principal"
            valor={projeto.responsavel ?? ''}
            placeholder="Adicionar responsável"
            maxLength={80}
            lista={responsaveis}
            aplicar={(t) => (p) => ({ ...p, responsavel: t || undefined })}
            registro={{ tipo: 'responsavel', texto: (a, d) => (d ? `Responsável: ${a || 'ninguém'} → ${d}` : `Responsável removido (era ${a})`) }}
          />
          <div className={j.campo}>
            <span className={j.campoRotulo}>Equipe do projeto</span>
            <ListaChips
              id="nova-pessoa-equipe"
              itens={projeto.equipe ?? []}
              aplicar={(lista) => (p) => ({ ...p, equipe: lista.length ? lista : undefined })}
              textoAdicionar="Adicionar pessoa"
              textoMais="Pessoa"
              rotuloEntrada="Nome da pessoa"
              sugestoes={responsaveis}
              registroAdicionar={(n) => `Equipe: ${n} entrou no projeto`}
              registroRemover={(n) => `Equipe: ${n} saiu do projeto`}
            />
          </div>
        </div>
      </Bloco>

      <Bloco
        id="prioridade"
        icone={<Tag size={20} />}
        titulo="Prioridade e etiquetas"
        subtitulo="Organização e destaque do projeto no Kanban."
        fechado={fechados.prioridade}
        onAlternar={alternar}
      >
        <div className={j.grade}>
          <CampoLista
            id="prioridade"
            rotulo="Prioridade"
            valor={projeto.prioridade ?? ''}
            opcoes={PRIORIDADES}
            aplicar={(t) => (p) => ({ ...p, prioridade: (t || undefined) as PrioridadeProjeto | undefined })}
            registro={{ tipo: 'dado', texto: (a, d) => `Prioridade: ${a} → ${d}` }}
          />
          <div className={j.campo}>
            <span className={j.campoRotulo}>Etiquetas</span>
            <ListaChips
              id="nova-etiqueta-ficha"
              itens={projeto.etiquetas ?? []}
              aplicar={(lista) => (p) => ({ ...p, etiquetas: lista })}
              textoAdicionar="Adicionar etiquetas"
              textoMais="Etiqueta"
              rotuloEntrada="Nova etiqueta"
              registroAdicionar={(e) => `Etiqueta adicionada: ${e}`}
              registroRemover={(e) => `Etiqueta removida: ${e}`}
            />
          </div>
        </div>
      </Bloco>

      <Bloco
        id="observacoes"
        icone={<StickyNote size={20} />}
        titulo="Observações internas"
        subtitulo="Anotações da equipe. O cliente não vê."
        fechado={fechados.observacoes}
        onAlternar={alternar}
      >
        <CampoTexto
          id="observacoes"
          rotulo="Observações (o cliente não vê)"
          valor={projeto.observacoesInternas ?? ''}
          area
          maxLength={6000}
          aplicar={(t) => (p) => ({ ...p, observacoesInternas: t || undefined })}
          registro={{ tipo: 'dado', texto: () => 'Observações internas atualizadas' }}
        />
        {(projeto.anotacoes ?? []).length > 0 && (
          <div className={`${j.campo} ${j.anotacoes}`}>
            <span className={j.campoRotulo}>Anotações da negociação (vieram do CRM)</span>
            <ul>
              {projeto.anotacoes!.map((a, i) => (
                <li key={`${a.em}-${i}`}>
                  {a.texto} <small>{dataHora(a.em)}</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Bloco>

      <Bloco
        id="campos"
        icone={<SlidersHorizontal size={20} />}
        titulo="Campos do serviço"
        subtitulo="Informações específicas de cada serviço contratado."
        aviso={pendentes ? `${pendentes} obrigatório${pendentes > 1 ? 's' : ''} sem preencher` : undefined}
        fechado={fechados.campos}
        onAlternar={alternar}
      >
        <BlocoCampos catalogo={catalogo} />
      </Bloco>

      {projeto.leadId && (
        <Bloco
          id="origem"
          icone={<Trophy size={20} />}
          titulo="Origem da venda"
          subtitulo="Dados, pagamento e arquivos copiados no dia da venda."
          fechado={fechados.origem}
          onAlternar={alternar}
        >
          <DadosDaVenda projeto={projeto} />
        </Bloco>
      )}

      <div className={j.excluirLinha}>
        {excluir ? (
          <>
            <span>Excluir este projeto? Isso não apaga o cliente, a venda nem as cobranças.</span>
            <button type="button" className={j.btnContorno} onClick={() => setExcluir(false)}>
              Não
            </button>
            <button type="button" className={j.btnPerigo} onClick={onExcluir}>
              Sim, excluir
            </button>
          </>
        ) : (
          <button type="button" className={j.excluir} onClick={() => setExcluir(true)}>
            <Trash2 size={15} /> Excluir projeto
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Peças ----------

function Bloco({
  id,
  icone,
  titulo,
  subtitulo,
  aviso,
  fechado,
  onAlternar,
  children,
}: {
  id: string;
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  aviso?: string;
  fechado?: boolean;
  onAlternar: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section id={`bloco-${id}`} className={j.bloco} aria-labelledby={`titulo-bloco-${id}`}>
      <button type="button" className={j.blocoTopo} onClick={() => onAlternar(id)} aria-expanded={!fechado} aria-controls={`corpo-bloco-${id}`}>
        <span className={j.blocoIcone} aria-hidden>
          {icone}
        </span>
        <span className={j.blocoTextos}>
          <h3 id={`titulo-bloco-${id}`}>{titulo}</h3>
          <small>{subtitulo}</small>
        </span>
        {aviso && (
          <span className={j.blocoAviso}>
            <AlertCircle size={13} aria-hidden /> {aviso}
          </span>
        )}
        <ChevronDown size={18} className={`${j.blocoSeta} ${fechado ? j.blocoSetaFechada : ''}`} aria-hidden />
      </button>
      {!fechado && (
        <div id={`corpo-bloco-${id}`} className={j.blocoCorpo}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Valor só para leitura, no mesmo formato dos campos. */
function Info({ rotulo, valor, extra, largo }: { rotulo: string; valor: string; extra?: ReactNode; largo?: boolean }) {
  return (
    <div className={`${j.campo} ${j.campoInfo} ${largo ? j.campoLargo : ''}`}>
      <span className={j.campoRotulo}>{rotulo}</span>
      <span className={j.infoValor}>
        {valor} {extra}
      </span>
    </div>
  );
}

// ---------- Cliente: edita o cadastro único (aba Clientes) ----------

function BlocoCliente() {
  const { projeto, cliente, salvarComAtividade } = useJanela();
  const [clientes, setClientes] = useClientes();
  const [projetos] = useProjetos();
  const [escolhido, setEscolhido] = useState('');
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);
  const projetosDoCliente = cliente ? projetos.filter((p) => p.clienteId === cliente.id).length : 0;
  const ordenados = useMemo(() => [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [clientes]);
  const mesmoNome = !cliente
    ? clientes.find((c) => [c.nome, c.nomeCompleto].some((n) => normalizarNome(n) === normalizarNome(projeto.cliente)))
    : undefined;

  const vincular = (c: Cliente, texto: string) => {
    setErro('');
    salvarComAtividade((p) => ({ ...p, clienteId: c.id, cliente: c.nome }), 'dado', texto, 'vinculo-cliente');
  };

  const cadastrarNovo = () => {
    const nome = projeto.cliente.trim();
    if (!nome) return;
    // não cria duplicado: se apareceu um com o mesmo nome, vincula a ele
    const existente = clientes.find((c) => normalizarNome(c.nome) === normalizarNome(nome));
    if (existente) return vincular(existente, `Projeto vinculado ao cliente ${existente.nome}`);
    const novo: Cliente = {
      id: `c-${Date.now().toString(36)}`,
      nome,
      segmento: '',
      status: 'Ativo',
      servicos: [],
      ultimaAtividade: '',
      origem: 'manual',
      criadoEm: new Date().toISOString(),
      historico: [],
    };
    if (!setClientes((l) => [novo, ...l])) return setErro('Não foi possível salvar o novo cliente neste navegador. Tente de novo.');
    vincular(novo, `Cliente ${nome} cadastrado em Clientes e vinculado ao projeto`);
  };

  if (!cliente) {
    return (
      <div className={j.semCliente}>
        <p className={j.vazio}>
          Este projeto ainda não está ligado a um cadastro em Clientes. Os dados do cliente ficam num lugar só: escolha um cliente existente ou
          cadastre <strong>{projeto.cliente}</strong> como novo.
        </p>
        {mesmoNome && (
          <div className={j.sugestao}>
            <span>
              Encontramos <strong>{mesmoNome.nome}</strong> em Clientes.
            </span>
            <button type="button" className={j.btnLima} onClick={() => vincular(mesmoNome, `Projeto vinculado ao cliente ${mesmoNome.nome}`)}>
              <Link2 size={15} /> Vincular a {mesmoNome.nome}
            </button>
          </div>
        )}
        <div className={j.linhaAcoes}>
          <label className={j.somenteLeitor} htmlFor="escolher-cliente">
            Escolher cliente existente
          </label>
          <select id="escolher-cliente" className={j.seletor} value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
            <option value="">Escolher cliente existente…</option>
            {ordenados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.documento ? ` · ${c.documento}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={j.btnContorno}
            disabled={!escolhido}
            onClick={() => {
              const c = clientes.find((x) => x.id === escolhido);
              if (c) vincular(c, `Projeto vinculado ao cliente ${c.nome}`);
            }}
          >
            <Link2 size={15} /> Vincular
          </button>
          {!mesmoNome && (
            <button type="button" className={j.btnContorno} onClick={cadastrarNovo}>
              <UserPlus size={15} /> Cadastrar “{projeto.cliente}” como novo cliente
            </button>
          )}
        </div>
        {erro && (
          <p className={j.campoMsgErro} role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  }

  const outrosComDoc = (t: string) => {
    const d = digitosDocumento(t);
    return d ? clientes.find((c) => c.id !== cliente.id && digitosDocumento(c.documento) === d) : undefined;
  };

  const resumo = [cliente.documento ? `CPF/CNPJ: ${cliente.documento}` : 'CPF/CNPJ não informado', cliente.contato, cliente.telefone, cliente.email]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className={j.clienteCartao}>
      <div className={j.clienteTopo}>
        <span className={j.clienteIcone} aria-hidden>
          <UserRound size={20} />
        </span>
        <div className={j.clienteTexto}>
          <strong>{cliente.nomeCompleto || cliente.nome}</strong>
          <small>{resumo}</small>
        </div>
        <button
          type="button"
          className={j.btnTopo}
          onClick={() => setEditando((v) => !v)}
          aria-expanded={editando}
          aria-label={editando ? 'Fechar dados do cliente' : 'Editar dados do cliente'}
          title="Editar dados do cliente"
        >
          <Pencil size={15} />
        </button>
        <Link
          href={`/clientes/${encodeURIComponent(cliente.id)}`}
          className={j.btnTopo}
          aria-label="Abrir cadastro do cliente"
          title="Abrir cadastro do cliente"
        >
          <ExternalLink size={15} />
        </Link>
      </div>
      {editando && (
        <>
          <p className={j.notaBloco}>
            Dados do cadastro do cliente: o que mudar aqui muda em Clientes
            {projetosDoCliente > 1 ? ` e nos ${projetosDoCliente} projetos dele` : ''}.
          </p>
          <div className={j.grade}>
            <CampoTexto
              id="cli-nome"
              rotulo="Nome do cliente (como aparece no sistema)"
              valor={cliente.nome}
              obrigatorio
              maxLength={120}
              aplicarCliente={(t) => (c) => ({ ...c, nome: t })}
              registro={{ tipo: 'dado', texto: (a, d) => `Cliente: nome “${a}” → “${d}”` }}
            />
            <CampoTexto
              id="cli-razao"
              rotulo="Nome completo ou razão social"
              valor={cliente.nomeCompleto ?? ''}
              maxLength={160}
              aplicarCliente={(t) => (c) => ({ ...c, nomeCompleto: t || undefined })}
              registro={{ tipo: 'dado', texto: () => 'Cliente: razão social / nome completo atualizado' }}
            />
            <CampoTexto
              id="cli-doc"
              rotulo="CPF ou CNPJ"
              valor={cliente.documento ?? ''}
              maxLength={20}
              modoTeclado="decimal"
              validar={(t) => {
                if (!t.trim()) return null;
                if (!documentoValido(t)) return 'CPF tem 11 números e CNPJ tem 14';
                const outro = outrosComDoc(t);
                return outro ? `Este documento já é do cliente “${outro.nome}”` : null;
              }}
              aplicarCliente={(t) => (c) => ({ ...c, documento: t || undefined })}
              registro={{ tipo: 'dado', texto: (a, d) => `Cliente: CPF/CNPJ ${a || 'vazio'} → ${d || 'vazio'}` }}
            />
            <CampoTexto
              id="cli-contato"
              rotulo="Pessoa de contato"
              valor={cliente.contato ?? ''}
              maxLength={80}
              aplicarCliente={(t) => (c) => ({ ...c, contato: t || undefined })}
              registro={{ tipo: 'dado', texto: (a, d) => `Cliente: contato ${a || 'vazio'} → ${d || 'vazio'}` }}
            />
            <CampoTexto
              id="cli-tel"
              rotulo="Telefone"
              valor={cliente.telefone ?? ''}
              maxLength={20}
              tipoEntrada="tel"
              validar={(t) => validarTexto('telefone', t)}
              aplicarCliente={(t) => (c) => ({ ...c, telefone: t || undefined })}
              registro={{ tipo: 'dado', texto: (a, d) => `Cliente: telefone ${a || 'vazio'} → ${d || 'vazio'}` }}
            />
            <CampoTexto
              id="cli-email"
              rotulo="E-mail"
              valor={cliente.email ?? ''}
              maxLength={120}
              tipoEntrada="email"
              validar={(t) => validarTexto('email', t)}
              aplicarCliente={(t) => (c) => ({ ...c, email: t || undefined })}
              registro={{ tipo: 'dado', texto: (a, d) => `Cliente: e-mail ${a || 'vazio'} → ${d || 'vazio'}` }}
            />
            <CampoTexto
              id="cli-endereco"
              rotulo="Endereço"
              valor={cliente.endereco ?? ''}
              largo
              maxLength={240}
              aplicarCliente={(t) => (c) => ({ ...c, endereco: t || undefined })}
              registro={{ tipo: 'dado', texto: () => 'Cliente: endereço atualizado' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Serviços contratados ----------

function BlocoServicos({ catalogo, onIrCampos }: { catalogo: ServicoNexa[]; onIrCampos: () => void }) {
  const { projeto, salvarComAtividade, autor } = useJanela();
  const servicos = projeto.servicos ?? [];
  const livres = catalogo.filter((s) => !servicos.some((sp) => sp.servicoId === s.id));
  const [novo, setNovo] = useState('');
  const [copiar, setCopiar] = useState(true);
  const escolhido = catalogo.find((s) => s.id === novo);
  const sugerido = servicoSugerido(projeto, catalogo);

  const adicionar = (s: ServicoNexa, comChecklist: boolean) => {
    const antes = projeto.tarefasProjeto?.length ?? 0;
    const depois = adicionarServico(projeto, s, comChecklist, new Date(), autor).tarefasProjeto?.length ?? 0;
    const criadas = depois - antes;
    const ok = salvarComAtividade(
      (p) => adicionarServico(p, s, comChecklist, new Date(), autor),
      'dado',
      `Serviço vinculado: ${s.nome}${criadas > 0 ? ` (${criadas} tarefa${criadas > 1 ? 's' : ''} criada${criadas > 1 ? 's' : ''} a partir do checklist)` : ''}`,
    );
    if (ok) {
      setNovo('');
      setCopiar(true);
    }
  };

  return (
    <div className={j.servicosLista}>
      {sugerido && (
        <div className={j.sugestao}>
          <span>
            Projeto antigo sem serviço vinculado. Sugestão pelo nome/lead: <strong>{sugerido.nome}</strong>.
          </span>
          <button type="button" className={j.btnLima} onClick={() => adicionar(sugerido, false)}>
            Vincular {sugerido.nome}
          </button>
        </div>
      )}
      {!servicos.length && !sugerido && <p className={j.vazio}>Nenhum serviço vinculado. Adicione o serviço principal abaixo.</p>}

      {servicos.map((sp) => (
        <CartaoServico key={sp.id} sp={sp} catalogo={catalogo} onIrCampos={onIrCampos} />
      ))}

      <div className={j.adicionarServico}>
        <label className={j.somenteLeitor} htmlFor="novo-servico">
          Serviço para adicionar
        </label>
        <select id="novo-servico" className={j.seletor} value={novo} onChange={(e) => setNovo(e.target.value)}>
          <option value="">
            {livres.length
              ? servicos.length
                ? 'Adicionar serviço adicional…'
                : 'Escolher serviço principal…'
              : 'Todos os serviços já estão no projeto'}
          </option>
          {livres.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        {escolhido?.checklist?.length ? (
          <label className={j.marcarLinha}>
            <input type="checkbox" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} />
            <span>Copiar checklist padrão ({escolhido.checklist.length} itens)</span>
          </label>
        ) : null}
        <button type="button" className={j.btnContorno} disabled={!escolhido} onClick={() => escolhido && adicionar(escolhido, copiar)}>
          Adicionar
        </button>
      </div>
      <p className={j.campoDica}>
        Não cria cobrança. Campos e checklists de cada serviço:{' '}
        <Link href="/catalogo" className={j.linkPequeno}>
          aba Serviços
        </Link>
        .
      </p>
    </div>
  );
}

function CartaoServico({ sp, catalogo, onIrCampos }: { sp: ServicoProjeto; catalogo: ServicoNexa[]; onIrCampos: () => void }) {
  const { salvarComAtividade, autor, projeto } = useJanela();
  const [verChecklist, setVerChecklist] = useState(false);
  const [abrirObs, setAbrirObs] = useState(false);
  const servico = catalogo.find((s) => s.id === sp.servicoId);
  const nome = nomeServicoProjeto(sp, catalogo);
  const pend = obrigatoriosPendentes(sp, servico);
  const preenchidos = Object.keys(sp.valores ?? {}).length;

  const remover = () => {
    const perdas = [preenchidos ? `${preenchidos} campo(s) preenchido(s)` : '', sp.checklist ? 'o checklist copiado' : '']
      .filter(Boolean)
      .join(' e ');
    const nTarefas = (projeto.tarefasProjeto ?? []).filter((t) => t.servicoProjetoId === sp.id).length;
    if (
      !window.confirm(
        `Remover ${nome} deste projeto?${perdas ? ` Isso tira do projeto ${perdas} deste serviço.` : ''}${nTarefas ? ` As ${nTarefas} tarefa(s) dele continuam na aba Tarefas.` : ''}`,
      )
    )
      return;
    salvarComAtividade((p) => removerServico(p, sp.id), 'dado', `Serviço removido do projeto: ${nome}${perdas ? ` (com ${perdas})` : ''}`);
  };

  const temObs = !!sp.observacao?.trim() || abrirObs;
  const copiar = () =>
    servico?.checklist?.length &&
    salvarComAtividade(
      (p) => copiarChecklistPara(p, sp.id, servico, new Date(), autor),
      'tarefa',
      `Checklist padrão de ${nome} copiado para as tarefas (${servico.checklist.length} itens)`,
    );

  return (
    <article className={j.servicoLinha}>
      <div className={j.servicoLinhaTopo}>
        <strong>{nome}</strong>
        {sp.principal ? (
          <span className={j.seloPrincipal}>
            <Star size={12} aria-hidden /> Principal
          </span>
        ) : (
          <button
            type="button"
            className={j.linkAcao}
            onClick={() => salvarComAtividade((p) => tornarPrincipal(p, sp.id), 'dado', `Serviço principal agora é ${nome}`)}
          >
            Tornar principal
          </button>
        )}
        {pend.length > 0 && (
          <button type="button" className={j.blocoAviso} onClick={onIrCampos}>
            <AlertCircle size={13} aria-hidden /> {pend.length} obrigatório{pend.length > 1 ? 's' : ''}
          </button>
        )}
        <span className={j.servicoAcoes}>
          {sp.checklist ? (
            <button
              type="button"
              className={j.linkAcao}
              onClick={() => setVerChecklist((v) => !v)}
              aria-expanded={verChecklist}
              title={`Checklist copiado em ${dataHora(sp.checklist.copiadoEm)}`}
            >
              <ListChecks size={14} /> {sp.checklist.itens.length} itens
            </button>
          ) : servico?.checklist?.length ? (
            <button type="button" className={j.linkAcao} onClick={copiar}>
              <ListChecks size={14} /> Copiar checklist ({servico.checklist.length})
            </button>
          ) : null}
          {!temObs && (
            <button type="button" className={j.linkAcao} onClick={() => setAbrirObs(true)}>
              <Pencil size={13} /> Observação
            </button>
          )}
          <button type="button" className={j.btnTopo} onClick={remover} aria-label={`Remover ${nome} do projeto`} title="Remover do projeto">
            <Trash2 size={15} />
          </button>
        </span>
      </div>
      {!servico && sp.servicoId && (
        <small className={j.campoAviso}>Este serviço saiu do cadastro; o nome e os valores preenchidos continuam guardados.</small>
      )}
      {!sp.servicoId && <small className={j.campoAviso}>Serviço sem vínculo com o cadastro (veio só com o nome).</small>}
      {temObs && (
        <CampoTexto
          id={`sp-obs:${sp.id}`}
          rotulo="Observação deste serviço"
          valor={sp.observacao ?? ''}
          maxLength={600}
          placeholder="Ex.: hospedagem por 12 meses, suporte em horário comercial…"
          aplicar={(t) => (p) => alterarServicoProjeto(p, sp.id, { observacao: t || undefined })}
          registro={{ tipo: 'dado', texto: () => `Observação do serviço ${nome} atualizada` }}
        />
      )}
      {sp.checklist && verChecklist && (
        <div className={j.checklistCopia}>
          <ol>
            {sp.checklist.itens.map((i) => (
              <li key={i.id}>{i.texto}</li>
            ))}
          </ol>
          <small className={j.campoDica}>
            Copiado em {dataHora(sp.checklist.copiadoEm)}. Cópia independente: mudar o checklist do serviço não altera esta lista. Os itens viraram
            tarefas na aba Tarefas.
          </small>
        </div>
      )}
    </article>
  );
}

// ---------- Campos personalizados (definidos na aba Serviços) ----------

function BlocoCampos({ catalogo }: { catalogo: ServicoNexa[] }) {
  const { projeto } = useJanela();
  const servicos = projeto.servicos ?? [];
  if (!servicos.length) return <p className={j.vazio}>Vincule um serviço em “Serviços contratados” para ver os campos dele.</p>;
  return (
    <div className={j.camposServicos}>
      {servicos.map((sp) => {
        const servico = catalogo.find((s) => s.id === sp.servicoId);
        const nome = nomeServicoProjeto(sp, catalogo);
        const itens = camposNaFicha(sp, servico);
        return (
          <div key={sp.id} className={j.grupoCampos}>
            <h4>
              {nome}
              {sp.principal && <span className={j.seloPrincipal}>Principal</span>}
            </h4>
            {itens.length ? (
              <div className={j.grade}>
                {itens.map((it) => (
                  <CampoPersonalizado key={it.campo.id} sp={sp} item={it} nomeServico={nome} />
                ))}
              </div>
            ) : (
              <p className={j.vazio}>
                {servico ? 'Nenhum campo personalizado para este serviço. ' : 'Serviço fora do cadastro. '}
                {servico && (
                  <Link href="/catalogo" className={j.linkPequeno}>
                    Configurar em Serviços
                  </Link>
                )}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CampoPersonalizado({ sp, item, nomeServico }: { sp: ServicoProjeto; item: CampoNaFicha; nomeServico: string }) {
  const { campo, valor, orfao, foraDoFormato } = item;
  const id = `cp:${sp.id}:${campo.id}`;
  const v = valor?.valor;
  const texto = typeof v === 'string' ? v : v === true ? 'sim' : '';
  const aviso = orfao
    ? 'Campo removido da configuração do serviço: o valor preenchido continua guardado.'
    : foraDoFormato
      ? 'A configuração deste campo mudou: confira se o valor ainda está certo.'
      : undefined;
  const obrig = campo.obrigatorio && !orfao;
  const aplicar = (t: string) => (p: Parameters<typeof definirValorCampo>[0]) => definirValorCampo(p, sp.id, campo, t);
  const registro = {
    tipo: 'dado' as const,
    texto: (a: string, d: string) =>
      campo.tipo === 'paragrafo' ? `${campo.nome} (${nomeServico}) atualizado` : `${campo.nome} (${nomeServico}): ${a || 'vazio'} → ${d || 'vazio'}`,
  };
  const rotulo = campo.nome;

  switch (campo.tipo) {
    case 'checkbox':
      return (
        <CampoMarcar
          id={id}
          rotulo={rotulo}
          marcado={v === true}
          aplicar={(b) => (p) => definirValorCampo(p, sp.id, campo, b)}
          registro={(b) => `${campo.nome} (${nomeServico}): ${b ? 'sim' : 'não'}`}
          aviso={aviso}
        />
      );
    case 'data':
      return (
        <CampoData
          id={id}
          rotulo={rotulo}
          valor={texto}
          aplicar={aplicar}
          registro={{ tipo: 'dado', texto: (a, d) => `${campo.nome} (${nomeServico}): ${a ? dataBr(a) : 'vazio'} → ${d ? dataBr(d) : 'vazio'}` }}
          marcarObrigatorio={obrig}
          aviso={aviso}
        />
      );
    case 'selecao':
      return (
        <CampoLista
          id={id}
          rotulo={rotulo}
          valor={texto}
          opcoes={(campo.opcoes ?? []).map((o) => ({ id: o, nome: o }))}
          textoVazio="Não selecionado"
          aplicar={aplicar}
          registro={registro}
          marcarObrigatorio={obrig}
          aviso={aviso}
        />
      );
    case 'paragrafo':
      return (
        <CampoTexto
          id={id}
          rotulo={rotulo}
          valor={texto}
          area
          maxLength={4000}
          aplicar={aplicar}
          registro={registro}
          marcarObrigatorio={obrig}
          aviso={aviso}
        />
      );
    default: {
      const entrada = campo.tipo === 'email' ? 'email' : campo.tipo === 'url' ? 'url' : campo.tipo === 'telefone' ? 'tel' : 'text';
      return (
        <CampoTexto
          id={id}
          rotulo={rotulo}
          valor={texto}
          maxLength={campo.tipo === 'url' ? 500 : 300}
          tipoEntrada={entrada}
          modoTeclado={campo.tipo === 'numero' ? 'decimal' : undefined}
          placeholder={campo.tipo === 'url' ? 'https://' : undefined}
          validar={(t) => validarTexto(campo.tipo, t)}
          aplicar={aplicar}
          registro={registro}
          marcarObrigatorio={obrig}
          aviso={aviso}
        />
      );
    }
  }
}
