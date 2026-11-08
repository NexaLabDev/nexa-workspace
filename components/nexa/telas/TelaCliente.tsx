'use client';

// PÁGINA DO CLIENTE — tudo do cliente num só lugar: dados, contratações,
// projetos, documentos, financeiro e histórico. Os dados vêm das mesmas listas
// do CRM, Kanban e Recebimentos (ligadas por clienteId / leadId), sem cópias.

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  Eye,
  FileText,
  FolderKanban,
  History,
  Plus,
  Repeat,
  UserRound,
  Wallet,
} from 'lucide-react';
import NexaShell from '../NexaShell';
import u from '../ui.module.css';
import r from './recebimentos.module.css';
import c from './cliente.module.css';
import { ETAPA_GANHO, etapasProjeto, type Cliente, type DocumentoLead } from '../dados-exemplo';
import { documentosDoLead, nomeEtapaLead, useClientes, useConversas, useLeads, useProjetos, useVendas } from '../dados';
import { cobrancasDoLead, dataBr, dinheiro, hojeIso, receitaRecorrente, situacaoCobranca } from '../financeiro';
import { leadNovaContratacao } from '../relacoes';
import { abrirArquivo, baixarArquivo } from '../arquivos';
import { classeStatusCliente, iniciais } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;

const CAMPOS: Array<[keyof Cliente, string, boolean?]> = [
  ['nome', 'Nome (como aparece no Workspace)'],
  ['nomeCompleto', 'Nome completo ou razão social'],
  ['documento', 'CPF ou CNPJ'],
  ['assinante', 'Quem assina'],
  ['email', 'E-mail'],
  ['telefone', 'Telefone'],
  ['endereco', 'Endereço completo', true],
];

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TelaCliente({ id }: { id: string }) {
  const router = useRouter();
  const [clientes, setClientes] = useClientes();
  const [leads, setLeads] = useLeads();
  const [vendas] = useVendas();
  const [projetos] = useProjetos();
  const [conversas] = useConversas();
  const cliente = clientes.find((x) => x.id === id);

  const leadsDoCliente = useMemo(() => leads.filter((l) => l.clienteId === id), [leads, id]);
  const idsLeads = useMemo(() => new Set(leadsDoCliente.map((l) => l.id)), [leadsDoCliente]);
  const vendasDoCliente = vendas.filter((v) => v.clienteId === id || (v.leadId && idsLeads.has(v.leadId)));
  const projetosDoCliente = projetos.filter((p) => p.clienteId === id || (p.leadId && idsLeads.has(p.leadId)));

  const hoje = hojeIso();
  const cobrancas = useMemo(() => leadsDoCliente.flatMap((l) => cobrancasDoLead(l, hoje)), [leadsDoCliente, hoje]);
  const recebido = cobrancas.filter((x) => x.pago).reduce((s, x) => s + x.valor, 0);
  const aReceber = cobrancas.filter((x) => !x.pago).reduce((s, x) => s + x.valor, 0);
  const vencido = cobrancas.filter((x) => situacaoCobranca(x, hoje) === 'vencida').reduce((s, x) => s + x.valor, 0);
  const mrr = receitaRecorrente(leadsDoCliente, hoje.slice(0, 7), hoje);
  const totalContratado = vendasDoCliente.reduce((s, v) => s + v.valor, 0);

  const documentos = useMemo(
    () =>
      leadsDoCliente
        .flatMap((l) => documentosDoLead(l, conversas.find((cv) => cv.leadId === l.id)).map((d) => ({ ...d, lead: l.empresa })))
        .sort((a, b) => b.em.localeCompare(a.em)),
    [leadsDoCliente, conversas]
  );

  const historico = useMemo(() => {
    const doCliente = (cliente?.historico ?? []).map((h) => ({ em: h.em, texto: h.texto }));
    const etapas = leadsDoCliente.flatMap((l) =>
      (l.historico ?? []).map((h) => ({ em: h.em, texto: `${l.descricao || l.empresa}: ${nomeEtapaLead(h.de)} → ${nomeEtapaLead(h.para)}` }))
    );
    return [...doCliente, ...etapas].sort((a, b) => b.em.localeCompare(a.em));
  }, [cliente, leadsDoCliente]);

  if (!cliente) {
    return (
      <NexaShell aba="clientes">
        <div className={u.pagina}>
          <section className={u.painel}>
            <p className={u.vazio}>Cliente não encontrado.</p>
            <Link href="/clientes" className={u.btnSecundario}>
              <ArrowLeft size={17} /> Voltar para Clientes
            </Link>
          </section>
        </div>
      </NexaShell>
    );
  }

  const salvarCampo = (campo: keyof Cliente, valor: string) => {
    const v = valor.trim();
    if (campo === 'nome' && !v) return;
    if (v === String(cliente[campo] ?? '')) return;
    setClientes((l) => l.map((x) => (x.id === id ? { ...x, [campo]: v || undefined } : x)));
  };

  const novaContratacao = () => {
    const lead = leadNovaContratacao(cliente);
    setLeads((l) => [lead, ...l]);
    setClientes((l) =>
      l.map((x) =>
        x.id === id
          ? { ...x, historico: [...(x.historico ?? []), { em: new Date().toISOString(), texto: 'Nova negociação aberta no CRM', leadId: lead.id }] }
          : x
      )
    );
    router.push(`/conversas?lead=${lead.id}`);
  };

  const abrirDoc = (d: DocumentoLead) => d.arquivoId && abrirArquivo(d.arquivoId, { nome: d.nome, confiavel: d.tipo === 'gerado' });

  return (
    <NexaShell aba="clientes">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div className={c.titulo}>
            <Link href="/clientes" className={u.btnIcone} aria-label="Voltar para Clientes" title="Voltar para Clientes">
              <ArrowLeft size={20} />
            </Link>
            <span className={u.avatar}>{iniciais(cliente.nome)}</span>
            <div>
              <h1>{cliente.nome}</h1>
              <p>
                <span className={`${u.status} ${classeStatusCliente(cliente.status)}`}>{cliente.status}</span>
                {cliente.nomeCompleto && cliente.nomeCompleto !== cliente.nome ? ` ${cliente.nomeCompleto}` : ''}
              </p>
            </div>
          </div>
          <div className={u.acoesCabecalho}>
            <button type="button" className={u.btnPrimario} onClick={novaContratacao}>
              <Plus size={18} strokeWidth={2.2} /> Nova contratação
            </button>
          </div>
        </div>

        {/* ----- Financeiro ----- */}
        <div className={`${r.numeros} ${r.numeros4} ${c.numerosCliente}`}>
          <div className={r.numero}>
            <BriefcaseBusiness size={26} {...ICONE} />
            <div>
              <span>Total contratado</span>
              <strong>{dinheiro(totalContratado)}</strong>
              <small>{vendasDoCliente.length} contratação(ões)</small>
            </div>
          </div>
          <div className={`${r.numero} ${r.numeroVerde}`}>
            <CircleCheck size={26} {...ICONE} />
            <div>
              <span>Recebido</span>
              <strong>{dinheiro(recebido)}</strong>
            </div>
          </div>
          <div className={`${r.numero} ${vencido ? r.numeroAlerta : ''}`}>
            {vencido ? <CircleAlert size={26} {...ICONE} /> : <Clock size={26} {...ICONE} />}
            <div>
              <span>A receber</span>
              <strong>{dinheiro(aReceber)}</strong>
              {vencido > 0 && <small>{dinheiro(vencido)} vencido</small>}
            </div>
          </div>
          <div className={r.numero}>
            <Repeat size={26} {...ICONE} />
            <div>
              <span>Mensalidade ativa</span>
              <strong>{dinheiro(mrr.previsto)}</strong>
              <small>por mês</small>
            </div>
          </div>
        </div>

        <div className={c.grade}>
          <div className={c.coluna}>
            {/* ----- Contratações ----- */}
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <Wallet size={26} {...ICONE} />
                <div>
                  <h2>Contratações e negociações</h2>
                  <small>Cada contratação é uma negociação do CRM. Uma nova não altera as anteriores.</small>
                </div>
              </header>
              <ul className={c.lista}>
                {leadsDoCliente.map((l) => {
                  const venda = vendasDoCliente.find((v) => v.leadId === l.id);
                  return (
                    <li key={l.id}>
                      <div>
                        <strong>{l.cadastro?.servico || l.descricao}</strong>
                        <span>
                          {nomeEtapaLead(l.etapa)}
                          {l.etapa === ETAPA_GANHO && l.ganhoEm ? ` em ${dataBr(l.ganhoEm)}` : ''}
                          {' · '}
                          {venda ? dinheiro(venda.valor) : l.valor != null ? dinheiro(l.valor) : 'valor a definir'}
                        </span>
                      </div>
                      <Link href={`/conversas?lead=${l.id}`} className={u.btnSecundario}>
                        Abrir
                      </Link>
                    </li>
                  );
                })}
                {!leadsDoCliente.length && <li className={u.vazio}>Nenhuma negociação ligada a este cliente.</li>}
              </ul>
            </section>

            {/* ----- Projetos ----- */}
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <FolderKanban size={26} {...ICONE} />
                <h2>Projetos</h2>
              </header>
              <ul className={c.lista}>
                {projetosDoCliente.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.servico}</strong>
                      <span>
                        {etapasProjeto.find((e) => e.id === p.etapa)?.nome ?? p.etapa} · atualizado em {quando(p.atualizadoEm)}
                      </span>
                      <div className={c.barra} aria-label={`Progresso ${p.progresso}%`}>
                        <i style={{ width: `${p.progresso}%` }} />
                      </div>
                    </div>
                    <Link href="/kanban" className={u.btnSecundario}>
                      Kanban
                    </Link>
                  </li>
                ))}
                {!projetosDoCliente.length && <li className={u.vazio}>Nenhum projeto ainda.</li>}
              </ul>
            </section>

            {/* ----- Documentos ----- */}
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <FileText size={26} {...ICONE} />
                <h2>Documentos</h2>
              </header>
              <ul className={u.docLista}>
                {documentos.map((d) => (
                  <li key={`${d.lead}-${d.id}`} className={u.docItem}>
                    <span className={u.docIcone}>
                      <FileText size={18} {...ICONE} />
                    </span>
                    <div className={u.docTexto}>
                      <strong>{d.nome}</strong>
                      <span>
                        {quando(d.em)} · {d.origem === 'cliente' ? 'enviado pelo cliente' : d.tipo === 'gerado' ? 'gerado' : 'anexado'}
                      </span>
                    </div>
                    {d.arquivoId && (
                      <>
                        <button type="button" className={u.btnIcone} onClick={() => abrirDoc(d)} aria-label={`Ver ${d.nome}`} title="Ver">
                          <Eye size={17} />
                        </button>
                        <button type="button" className={u.btnIcone} onClick={() => baixarArquivo(d.arquivoId!, d.nome)} aria-label={`Baixar ${d.nome}`} title="Baixar">
                          <Download size={17} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {!documentos.length && <p className={u.vazio}>Nenhum documento ainda.</p>}
            </section>
          </div>

          <div className={c.coluna}>
            {/* ----- Dados ----- */}
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <UserRound size={26} {...ICONE} />
                <div>
                  <h2>Dados do cliente</h2>
                  <small>Usados nas próximas contratações. Alterar aqui não muda documentos já gerados.</small>
                </div>
              </header>
              <div className={u.formGrade}>
                {CAMPOS.map(([campo, rotulo, largo]) => (
                  <label key={campo} className={`${u.campo} ${largo ? u.formCheia : ''}`}>
                    <span>{rotulo}</span>
                    <input
                      className={u.entrada}
                      defaultValue={String(cliente[campo] ?? '')}
                      key={`${campo}-${String(cliente[campo] ?? '')}`}
                      onBlur={(e) => salvarCampo(campo, e.currentTarget.value)}
                    />
                  </label>
                ))}
              </div>
              {cliente.servicos.length > 0 && (
                <div className={u.linhaChips} style={{ marginTop: 14 }}>
                  {cliente.servicos.map((s) => (
                    <span key={s} className={u.chip}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* ----- Histórico ----- */}
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <History size={26} {...ICONE} />
                <h2>Histórico</h2>
              </header>
              <ul className={c.historico}>
                {historico.map((h, i) => (
                  <li key={`${h.em}-${i}`}>
                    <p>{h.texto}</p>
                    <small>{quando(h.em)}</small>
                  </li>
                ))}
                {!historico.length && <li className={u.vazio}>Sem eventos ainda.</li>}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </NexaShell>
  );
}
