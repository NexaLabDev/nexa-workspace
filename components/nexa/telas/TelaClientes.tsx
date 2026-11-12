'use client';

// ABA CLIENTES — lista de clientes. Vendas ganhas no CRM criam ou vinculam o cliente (relacoes.ts).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calculator, FilePlus, Info, LayoutGrid, Plus, Search, Users } from 'lucide-react';
import NexaShell from '../NexaShell';
import Modal from '../Modal';
import MenuAcoes from '../MenuAcoes';
import u from '../ui.module.css';
import { STATUS_CLIENTE, type Cliente, type StatusCliente } from '../dados-exemplo';
import { useClientes, useLeads } from '../dados';
import { classeStatusCliente, iniciais, useParametro } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;

export default function TelaClientes() {
  const [lista, setLista] = useClientes();
  const [leads] = useLeads();
  const [filtro, setFiltro] = useState<StatusCliente | 'Todos'>('Todos');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const pedirNovo = useParametro('novo');
  const buscaUrl = useParametro('busca');

  useEffect(() => {
    if (pedirNovo) setModalAberto(true);
  }, [pedirNovo]);

  useEffect(() => {
    if (buscaUrl) setBusca(buscaUrl);
  }, [buscaUrl]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter(
      (c) =>
        (filtro === 'Todos' || c.status === filtro) &&
        (!termo || c.nome.toLowerCase().includes(termo) || c.segmento.toLowerCase().includes(termo))
    );
  }, [lista, filtro, busca]);

  const contagem = (st: StatusCliente) => lista.filter((c) => c.status === st).length;

  return (
    <NexaShell aba="clientes">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Clientes</h1>
            <p>Gestão de clientes, pipeline e oportunidades da Nexa Lab.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
          <div className={u.acoesCabecalho}>
            <button type="button" className={u.btnPrimario} onClick={() => setModalAberto(true)}>
              <Plus size={18} strokeWidth={2.2} /> Novo cliente
            </button>
          </div>
        </div>

        <div className={u.grade2}>
          <section className={u.painel}>
            <header className={u.painelTopo}>
              <Users size={30} {...ICONE} />
              <div>
                <h2>Clientes</h2>
                <small>{lista.length} clientes cadastrados</small>
              </div>
              <label className={`${u.buscaPagina} ${u.empurra}`}>
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Buscar cliente ou segmento"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  aria-label="Buscar cliente"
                />
              </label>
            </header>

            <div className={u.filtros} role="tablist" aria-label="Filtrar por status">
              {(['Todos', ...STATUS_CLIENTE] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={filtro === st}
                  className={`${u.filtro} ${filtro === st ? u.filtroAtivo : ''}`}
                  onClick={() => setFiltro(st)}
                >
                  {st}
                  <span className={u.contador}>{st === 'Todos' ? lista.length : contagem(st)}</span>
                </button>
              ))}
            </div>

            <div className={u.tabelaCaixa} style={{ marginTop: 18 }}>
              <table className={u.tabela}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Status</th>
                    <th>Serviços</th>
                    <th>Última atividade</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className={u.entidade}>
                          <span className={u.avatar}>{iniciais(c.nome)}</span>
                          <div>
                            <Link href={`/clientes/${encodeURIComponent(c.id)}`} className={u.linkNome}>
                              <strong>{c.nome}</strong>
                            </Link>
                            <span>{c.segmento || (c.origem === 'venda' ? 'Cliente via CRM' : '')}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${u.status} ${classeStatusCliente(c.status)}`}>{c.status}</span>
                      </td>
                      <td>
                        <div className={u.linhaChips}>
                          {(c.servicos ?? []).map((sv) => (
                            <span key={sv} className={u.chip}>
                              {sv}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: '#d6d6d6' }}>{c.ultimaAtividade}</td>
                      <td>
                        <MenuAcoes
                          rotulo={`Ações de ${c.nome}`}
                          acoes={[
                            { tipo: 'link', rotulo: 'Abrir cliente', href: `/clientes/${encodeURIComponent(c.id)}` },
                            { tipo: 'link', rotulo: 'Nova proposta', href: `/documentos?novo=Proposta&cliente=${encodeURIComponent(c.nome)}` },
                            {
                              tipo: 'botao',
                              rotulo: 'Remover cliente',
                              perigo: true,
                              onClick: () => {
                                const ligados = leads.filter((l) => l.clienteId === c.id).length;
                                if (ligados) {
                                  window.alert(`${c.nome} tem ${ligados} negociação(ões) ligada(s) e não pode ser removido, para não perder o histórico. Abra o cliente para conferir.`);
                                  return;
                                }
                                if (window.confirm(`Remover ${c.nome} da lista?`)) setLista((l) => l.filter((x) => x.id !== c.id));
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visiveis.length === 0 && <p className={u.vazio}>Nenhum cliente encontrado com esse filtro.</p>}
            </div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 21 }}>
            <section className={u.painel}>
              <header className={u.painelTopo}>
                <LayoutGrid size={28} className={u.iconeVerde} {...ICONE} />
                <h2>Resumo</h2>
              </header>
              <ul className={u.resumoLista}>
                {STATUS_CLIENTE.map((st) => (
                  <li key={st} className={u.resumoItem}>
                    <span className={`${u.status} ${classeStatusCliente(st)}`}>{st}</span>
                    <strong>{contagem(st)}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className={u.painel}>
              <header className={u.painelTopo}>
                <h2>Atalhos</h2>
              </header>
              <div className={u.linkLista}>
                <Link href="/crm" className={u.linkItem}>
                  <LayoutGrid size={18} {...ICONE} /> Ver pipeline de vendas
                </Link>
                <Link href="/documentos?novo=Proposta" className={u.linkItem}>
                  <FilePlus size={18} {...ICONE} /> Nova proposta
                </Link>
                <Link href="/calculadora" className={u.linkItem}>
                  <Calculator size={18} {...ICONE} /> Calcular serviço
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      {modalAberto && (
        <ModalNovoCliente
          onFechar={() => setModalAberto(false)}
          onSalvar={(c) => {
            setLista((l) => [c, ...l]);
            setFiltro('Todos');
            setModalAberto(false);
          }}
        />
      )}
    </NexaShell>
  );
}

function ModalNovoCliente({ onFechar, onSalvar }: { onFechar: () => void; onSalvar: (c: Cliente) => void }) {
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');
  const [status, setStatus] = useState<StatusCliente>('Qualificação');
  const [servicos, setServicos] = useState('');

  return (
    <Modal
      titulo="Novo cliente"
      descricao="Preencha os dados principais. Você pode completar depois."
      onFechar={onFechar}
      textoEnviar="Adicionar cliente"
      podeEnviar={!!nome.trim()}
      onEnviar={() =>
        onSalvar({
          id: `novo-${Date.now()}`,
          nome: nome.trim(),
          segmento: segmento.trim() || '—',
          status,
          servicos: servicos
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          ultimaAtividade: 'agora',
        })
      }
    >
        <div className={u.formGrade}>
          <label className={`${u.campo} ${u.formCheia}`}>
            <span>Nome da empresa ou pessoa *</span>
            <input className={u.entrada} value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
          </label>
          <label className={u.campo}>
            <span>Segmento</span>
            <input className={u.entrada} value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Saúde" />
          </label>
          <label className={u.campo}>
            <span>Status</span>
            <select className={u.entrada} value={status} onChange={(e) => setStatus(e.target.value as StatusCliente)}>
              {STATUS_CLIENTE.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </select>
          </label>
          <label className={`${u.campo} ${u.formCheia}`}>
            <span>Serviços (separe por vírgula)</span>
            <input className={u.entrada} value={servicos} onChange={(e) => setServicos(e.target.value)} placeholder="Ex.: Site, Suporte" />
          </label>
        </div>
        <p className={u.nota} style={{ marginTop: 18 }}>
          <Info size={16} /> O cliente fica salvo neste navegador. Em outro computador ele não aparece, até existir um banco de dados.
        </p>
    </Modal>
  );
}
