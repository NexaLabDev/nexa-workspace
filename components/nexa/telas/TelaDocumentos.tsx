'use client';

// ABA GERADOR DE DOCUMENTOS — lista de todos os documentos.
// A geração acontece só no lead (Conversas → painel do lead → Documentos),
// com conferência dos campos obrigatórios. Aqui ficam a lista, os filtros e o atalho para o lead.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Eye, FilePlus, FileText, Info, Printer } from 'lucide-react';
import NexaShell from '../NexaShell';
import MenuAcoes from '../MenuAcoes';
import { useDocumentos, useLeads } from '../dados';
import u from '../ui.module.css';
import { ETAPA_PERDIDO, type SituacaoDocumento, type TipoDocumento } from '../dados-exemplo';
import { abrirArquivo, baixarArquivo, imprimirArquivo } from '../arquivos';
import { useParametro } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;
const TIPOS: TipoDocumento[] = ['Proposta', 'Contrato', 'Ordem de serviço', 'Recibo', 'Ficha de dados', 'Escopo'];
const NOME_FILTRO: Record<TipoDocumento, string> = {
  Proposta: 'Propostas',
  Contrato: 'Contratos',
  'Ordem de serviço': 'Ordens de serviço',
  Recibo: 'Recibos',
  'Ficha de dados': 'Fichas',
  Escopo: 'Escopos',
};

function classeSituacao(s: SituacaoDocumento): string {
  if (s === 'Assinado') return u.stLima;
  if (s === 'Enviada') return u.stCeu;
  return u.stAmbar;
}

export default function TelaDocumentos() {
  const filtroUrl = useParametro('filtro');
  const [lista, setLista] = useDocumentos();
  const [leads] = useLeads();
  const [filtro, setFiltro] = useState<TipoDocumento | 'Todos'>('Todos');
  const [leadEscolhido, setLeadEscolhido] = useState('');

  useEffect(() => {
    if (filtroUrl && TIPOS.includes(filtroUrl as TipoDocumento)) setFiltro(filtroUrl as TipoDocumento);
  }, [filtroUrl]);

  const visiveis = useMemo(() => lista.filter((d) => filtro === 'Todos' || d.tipo === filtro), [lista, filtro]);
  const tiposComDocs = TIPOS.filter((t) => t !== 'Escopo' || lista.some((d) => d.tipo === 'Escopo'));
  const leadsAtivos = leads.filter((l) => l.etapa !== ETAPA_PERDIDO);
  const nomeLead = (id?: string) => leads.find((l) => l.id === id)?.empresa;

  return (
    <NexaShell aba="documentos">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Gerador de Documentos</h1>
            <p>Propostas, contratos, ordens de serviço, recibos e fichas em um só lugar.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
        </div>

        <div className={u.grade2}>
          <section className={u.painel}>
            <header className={u.painelTopo}>
              <FileText size={30} {...ICONE} />
              <div>
                <h2>Documentos</h2>
                <small>Todos os documentos gerados nos leads.</small>
              </div>
            </header>

            <div className={u.filtros} role="tablist" aria-label="Filtrar por tipo">
              {(['Todos', ...tiposComDocs] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={filtro === t}
                  className={`${u.filtro} ${filtro === t ? u.filtroAtivo : ''}`}
                  onClick={() => setFiltro(t)}
                >
                  {t === 'Todos' ? 'Todos' : NOME_FILTRO[t]}
                  <span className={u.contador}>{t === 'Todos' ? lista.length : lista.filter((d) => d.tipo === t).length}</span>
                </button>
              ))}
            </div>

            <ul className={u.docLista} style={{ marginTop: 10 }}>
              {visiveis.map((d) => (
                <li key={d.id} className={u.docItem}>
                  <span className={u.docIcone}>
                    <FileText size={20} {...ICONE} />
                  </span>
                  <div className={u.docTexto}>
                    <strong>
                      {d.titulo}
                      {d.versao ? <span className={u.chip} style={{ marginLeft: 8 }}>v{d.versao}</span> : null}
                    </strong>
                    <span>
                      {d.descricao}
                      {d.atualizado ? ` · ${d.atualizado}` : ''}
                      {d.leadId && nomeLead(d.leadId) ? ` · lead ${nomeLead(d.leadId)}` : ''}
                    </span>
                  </div>
                  {d.situacao ? (
                    <span className={`${u.status} ${classeSituacao(d.situacao)}`}>{d.situacao}</span>
                  ) : (
                    <span className={u.chip}>{d.tipo}</span>
                  )}
                  {d.arquivoId && (
                    <>
                      <button type="button" className={u.btnIcone} onClick={() => abrirArquivo(d.arquivoId!, { confiavel: true, nome: d.titulo })} aria-label={`Ver ${d.titulo}`} title="Ver">
                        <Eye size={17} />
                      </button>
                      <button
                        type="button"
                        className={u.btnIcone}
                        onClick={() => imprimirArquivo(d.arquivoId!)}
                        aria-label={`Exportar ${d.titulo} em PDF`}
                        title="Exportar PDF (na janela de impressão, escolha “Salvar como PDF”)"
                      >
                        <Printer size={17} />
                      </button>
                      <button type="button" className={u.btnIcone} onClick={() => baixarArquivo(d.arquivoId!, `${d.titulo}${d.versao ? ` – v${d.versao}` : ''}.html`)} aria-label={`Baixar ${d.titulo}`} title="Baixar">
                        <Download size={17} />
                      </button>
                    </>
                  )}
                  <MenuAcoes
                    rotulo={`Ações de ${d.titulo}`}
                    acoes={[
                      ...(d.leadId ? [{ tipo: 'link' as const, rotulo: 'Abrir o lead', href: `/conversas?lead=${d.leadId}` }] : []),
                      {
                        tipo: 'botao',
                        rotulo: 'Remover documento',
                        perigo: true,
                        onClick: () => {
                          if (window.confirm(`Remover "${d.titulo}" desta lista?`)) setLista((l) => l.filter((x) => x.id !== d.id));
                        },
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
            {visiveis.length === 0 && <p className={u.vazio}>Nenhum documento desse tipo.</p>}
          </section>

          <section className={u.painel}>
            <header className={u.painelTopo}>
              <FilePlus size={28} className={u.iconeVerde} {...ICONE} />
              <h2>Gerar documento</h2>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className={u.nota}>
                <Info size={16} />
                Os documentos são gerados no lead, para usar os dados certos e conferir o que falta antes de gerar. Escolha o lead
                e use a seção Documentos do painel.
              </p>
              <label className={u.campo}>
                <span>Lead</span>
                <select className={u.entrada} value={leadEscolhido} onChange={(e) => setLeadEscolhido(e.target.value)}>
                  <option value="">Escolha…</option>
                  {leadsAtivos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.empresa}
                    </option>
                  ))}
                </select>
              </label>
              {leadEscolhido ? (
                <Link href={`/conversas?lead=${leadEscolhido}&documentos=1`} className={u.btnPrimario}>
                  <FilePlus size={18} strokeWidth={2} /> Abrir documentos do lead
                </Link>
              ) : (
                <button type="button" className={u.btnPrimario} disabled>
                  <FilePlus size={18} strokeWidth={2} /> Abrir documentos do lead
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </NexaShell>
  );
}
