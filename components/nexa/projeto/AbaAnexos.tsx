'use client';

// ============================================
// ABA ANEXOS — biblioteca de arquivos do projeto
// ============================================
// - Arquivos da biblioteca: enviar (vários / arrastar), renomear, categorizar, versões,
//   vincular a tarefas, pré-visualizar, baixar, excluir.
// - Referências (só leitura, sem copiar): comprovantes (Financeiro), documentos gerados
//   (Documentos) e arquivos da venda/conversa (CRM). Continuam sendo gerenciados lá.
// - Conteúdo da biblioteca fica no Storage privado do workspace. Nada aparece no link do cliente.
// ============================================

import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useEscapeEmPilha } from './esc';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Eye,
  FolderCog,
  HardDrive,
  LayoutGrid,
  Link2,
  List,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import j from './janela.module.css';
import a from './anexos.module.css';
import { useJanela } from './salvamento';
import { CampoLista, CampoTexto } from './campos';
import Previa, { Miniatura } from './Previa';
import { prepararEnvio, prepararVersao, type ReferenciaConteudo, type ResultadoEnvio } from './envio';
import type { ArquivoProjeto, CategoriaArquivo, Projeto } from '../dados-exemplo';
import { documentosDoLead, useCategoriasArquivos, useConversas, useDocumentos, useLeads } from '../dados';
import { cobrancasDoLead, dataBr } from '../financeiro';
import { apagarArquivo, apagarArquivoSeSemUso, baixarArquivo, tamanhoLegivel } from '../arquivos';
import {
  CATEGORIA_PADRAO,
  alterarEntrada,
  combinaBusca,
  desvincularTarefa,
  idCategoria,
  nomeCategoria,
  removerEntrada,
  rotuloTipo,
  versaoAtual,
  vincularTarefa,
} from '../biblioteca';

export type EstadoTelaAnexos = {
  busca: string;
  categoria: string;
  origem: 'todas' | 'biblioteca' | 'tarefas' | 'financeiro' | 'documentos' | 'venda';
  visao: 'lista' | 'grade';
  categoriaEnvio: string;
};

export const ESTADO_TELA_ANEXOS: EstadoTelaAnexos = { busca: '', categoria: 'todas', origem: 'todas', visao: 'lista', categoriaEnvio: CATEGORIA_PADRAO };

type OrigemRef = 'financeiro' | 'documentos' | 'venda';
type Referencia = {
  chave: string;
  origem: OrigemRef;
  nome: string;
  detalhe: string;
  arquivoId: string;
  em?: string;
  tamanho?: string;
  link: { href: string; texto: string };
};

const NOME_ORIGEM: Record<OrigemRef, string> = { financeiro: 'Financeiro', documentos: 'Documentos', venda: 'Venda (CRM)' };

function dataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tamanhoDe(v: { tamanho?: number; tamanhoTexto?: string }): string {
  return v.tamanho != null ? tamanhoLegivel(v.tamanho) : v.tamanhoTexto ?? '';
}

/** Arquivos de outras áreas ligados a este projeto (sem copiar nada). */
function useReferencias(projeto: Projeto): Referencia[] {
  const [leads] = useLeads();
  const [conversas] = useConversas();
  const [documentos] = useDocumentos();
  return useMemo(() => {
    const vistos = new Set<string>();
    const saida: Referencia[] = [];
    const add = (r: Referencia) => {
      if (vistos.has(r.arquivoId)) return;
      vistos.add(r.arquivoId);
      saida.push(r);
    };
    const lead = projeto.leadId ? leads.find((l) => l.id === projeto.leadId) : undefined;
    const linkLead = projeto.leadId ? `/crm?lead=${encodeURIComponent(projeto.leadId)}` : '/crm';
    if (lead) {
      for (const c of cobrancasDoLead(lead)) {
        if (c.comprovante?.arquivoId)
          add({ chave: `fin-${c.chave}`, origem: 'financeiro', nome: c.comprovante.nome, detalhe: `Comprovante · ${c.rotulo}`, arquivoId: c.comprovante.arquivoId, em: c.pagoEm, tamanho: c.comprovante.tamanho, link: { href: linkLead, texto: 'Pagamento no CRM' } });
      }
    }
    if (projeto.leadId) {
      for (const d of documentos) {
        if (d.leadId === projeto.leadId && d.arquivoId)
          add({ chave: `doc-${d.id}`, origem: 'documentos', nome: d.titulo, detalhe: `${d.tipo}${d.versao ? ` · v${d.versao}` : ''}`, arquivoId: d.arquivoId, em: d.criadoEm, link: { href: '/documentos', texto: 'Aba Documentos' } });
      }
    }
    const daVenda = lead ? documentosDoLead(lead, conversas.find((cv) => cv.leadId === lead.id)) : [];
    for (const d of [...daVenda, ...(projeto.documentos ?? [])]) {
      if (!d.arquivoId || d.id.startsWith('comp-')) continue;
      add({
        chave: `venda-${d.id}`,
        origem: d.tipo === 'gerado' ? 'documentos' : 'venda',
        nome: d.nome,
        detalhe: d.origem === 'cliente' ? 'Enviado pelo cliente' : d.origem === 'sistema' ? 'Gerado pelo sistema' : 'Anexado pela equipe',
        arquivoId: d.arquivoId,
        em: d.em,
        tamanho: d.tamanho,
        link: { href: linkLead, texto: 'Ficha no CRM' },
      });
    }
    return saida;
  }, [projeto.leadId, projeto.documentos, leads, conversas, documentos]);
}

export default function AbaAnexos({ tela, setTela }: { tela: EstadoTelaAnexos; setTela: (f: (e: EstadoTelaAnexos) => EstadoTelaAnexos) => void }) {
  const { projeto, salvarComAtividade, autor } = useJanela();
  const [categorias, setCategorias] = useCategoriasArquivos();
  const referencias = useReferencias(projeto);
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([]);
  const [previa, setPrevia] = useState<{ arquivoId: string; nome: string; titulo: string; detalhes?: string } | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [gerirCategorias, setGerirCategorias] = useState(false);
  const mudar = (m: Partial<EstadoTelaAnexos>) => setTela((e) => ({ ...e, ...m }));

  const biblioteca = projeto.arquivos ?? [];
  const tarefas = projeto.tarefasProjeto ?? [];
  const tituloTarefa = (id: string) => tarefas.find((t) => t.id === id)?.titulo ?? 'tarefa excluída';
  const categoriaEnvio = categorias.some((c) => c.id === tela.categoriaEnvio) ? tela.categoriaEnvio : CATEGORIA_PADRAO;

  const enviar = async (lista: File[]) => {
    if (!lista.length || enviando) return;
    setEnviando(true);
    setResultados([]);
    try {
      const refs: ReferenciaConteudo[] = referencias.map((r) => ({ arquivoId: r.arquivoId, nome: r.nome, origem: NOME_ORIGEM[r.origem] }));
      const plano = await prepararEnvio(lista, { projeto, categoria: categoriaEnvio, categorias, autor, referencias: refs });
      let res = plano.resultados;
      if (plano.resumo.length) {
        const texto = plano.resumo.length === 1 ? `Arquivo enviado (${nomeCategoria(categoriaEnvio, categorias)}): ${plano.resumo[0]}` : `${plano.resumo.length} arquivos enviados (${nomeCategoria(categoriaEnvio, categorias)}): ${plano.resumo.join(', ')}`;
        const ok = salvarComAtividade(plano.transformar, 'arquivo', texto);
        if (!ok) {
          // nada foi registrado: apaga o que acabou de ser guardado, para não sobrar arquivo solto
          for (const id of plano.conteudosNovos) await apagarArquivo(id).catch(() => undefined);
          res = res.map((r) => (r.situacao === 'erro' ? r : { ...r, situacao: 'erro', mensagem: 'Não foi possível salvar os dados neste navegador. Nada foi alterado; tente de novo.', arquivo: lista.find((f) => f.name === r.nome) }));
        }
      }
      setResultados(res);
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    const lista = Array.from(e.dataTransfer?.files ?? []);
    if (lista.length) enviar(lista);
  };

  // ---------- itens filtrados ----------
  const itensBiblioteca = biblioteca.filter((x) => {
    if (tela.categoria !== 'todas' && x.categoria !== tela.categoria) return false;
    if (tela.origem === 'tarefas' && !(x.tarefas ?? []).length) return false;
    if (!['todas', 'biblioteca', 'tarefas'].includes(tela.origem)) return false;
    return combinaBusca(x, tela.busca, [...(x.tarefas ?? []).map(tituloTarefa), nomeCategoria(x.categoria, categorias)]);
  });
  const itensRef = referencias.filter((r) => {
    if (tela.categoria !== 'todas') return false;
    if (tela.origem !== 'todas' && tela.origem !== r.origem) return false;
    const q = tela.busca.trim().toLowerCase();
    return !q || `${r.nome} ${r.detalhe} ${NOME_ORIGEM[r.origem]}`.toLowerCase().includes(q);
  });
  const filtrando = !!tela.busca.trim() || tela.categoria !== 'todas' || tela.origem !== 'todas';
  const detalhe = detalheId ? biblioteca.find((x) => x.id === detalheId) : undefined;

  return (
    <div
      className={`${j.aba} ${a.aba} ${arrastando ? a.arrastando : ''}`}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
          e.preventDefault();
          setArrastando(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setArrastando(false);
      }}
      onDrop={soltar}
    >
      <div className={a.envio}>
        <div className={a.envioLinha}>
          <button type="button" className={j.btnLima} onClick={() => entrada.current?.click()} disabled={enviando}>
            <Upload size={16} /> {enviando ? 'Enviando…' : 'Enviar arquivos'}
          </button>
          <label className={a.envioCategoria}>
            <span>Categoria</span>
            <select className={j.seletor} value={categoriaEnvio} onChange={(e) => mudar({ categoriaEnvio: e.target.value })}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <span className={a.envioDica}>ou arraste os arquivos para esta área (até 25 MB cada)</span>
          <input
            ref={entrada}
            type="file"
            multiple
            hidden
            aria-label="Escolher arquivos para enviar"
            onChange={(e) => enviar(Array.from(e.target.files ?? []))}
          />
        </div>
        <p className={a.local}>
          <HardDrive size={14} aria-hidden /> Guardados no Storage privado do workspace (Supabase). Em outro aparelho com o
          mesmo acesso, os anexos aparecem após sincronizar. Faça backup em Configurações quando precisar de cópia local.
        </p>
      </div>

      {resultados.length > 0 && (
        <div className={a.resultados} role="status">
          <div className={a.resultadosTopo}>
            <strong>Resultado do envio</strong>
            <button type="button" className={j.btnTopo} onClick={() => setResultados([])} aria-label="Fechar resultado do envio">
              <X size={15} />
            </button>
          </div>
          <ul>
            {resultados.map((r, i) => (
              <li key={`${r.nome}-${i}`} data-situacao={r.situacao}>
                {r.situacao === 'erro' ? <AlertTriangle size={14} /> : r.situacao === 'novo' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                <span>
                  <b>{r.nome}</b> — {r.mensagem}
                </span>
                {r.situacao === 'erro' && r.arquivo && (
                  <button type="button" className={j.linkAcao} onClick={() => enviar([r.arquivo!])}>
                    Tentar de novo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={a.filtros} role="group" aria-label="Busca e filtros dos arquivos">
        <label className={a.busca}>
          <Search size={15} aria-hidden />
          <span className={j.somenteLeitor}>Pesquisar arquivos</span>
          <input value={tela.busca} onChange={(e) => mudar({ busca: e.target.value })} placeholder="Pesquisar por nome, tarefa ou observação" />
        </label>
        <label className={a.filtro}>
          <span>Categoria</span>
          <select className={j.seletor} value={tela.categoria} onChange={(e) => mudar({ categoria: e.target.value })}>
            <option value="todas">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={a.filtro}>
          <span>Origem</span>
          <select className={j.seletor} value={tela.origem} onChange={(e) => mudar({ origem: e.target.value as EstadoTelaAnexos['origem'] })}>
            <option value="todas">Todas</option>
            <option value="biblioteca">Biblioteca do projeto</option>
            <option value="tarefas">Vinculados a tarefas</option>
            <option value="financeiro">Financeiro (comprovantes)</option>
            <option value="documentos">Documentos</option>
            <option value="venda">Venda (CRM)</option>
          </select>
        </label>
        <div className={a.visao} role="group" aria-label="Forma de exibição">
          <button type="button" aria-pressed={tela.visao === 'lista'} onClick={() => mudar({ visao: 'lista' })} title="Lista">
            <List size={16} />
            <span className={j.somenteLeitor}>Lista</span>
          </button>
          <button type="button" aria-pressed={tela.visao === 'grade'} onClick={() => mudar({ visao: 'grade' })} title="Grade com miniaturas">
            <LayoutGrid size={16} />
            <span className={j.somenteLeitor}>Grade</span>
          </button>
        </div>
        <button type="button" className={j.linkAcao} onClick={() => setGerirCategorias((v) => !v)} aria-expanded={gerirCategorias}>
          <FolderCog size={15} /> Categorias
        </button>
      </div>

      {gerirCategorias && <GerirCategorias categorias={categorias} setCategorias={setCategorias} emUso={new Set(biblioteca.map((x) => x.categoria))} onFechar={() => setGerirCategorias(false)} />}

      {!biblioteca.length && !referencias.length ? (
        <div className={a.vazio}>
          <Paperclip size={26} aria-hidden />
          <p>Nenhum arquivo ainda. Envie briefing, referências, identidade visual, arquivos técnicos ou entregáveis.</p>
        </div>
      ) : !itensBiblioteca.length && !itensRef.length ? (
        <p className={j.vazio}>
          Nenhum arquivo com esses filtros.{' '}
          {filtrando && (
            <button type="button" className={j.linkAcao} onClick={() => mudar({ busca: '', categoria: 'todas', origem: 'todas' })}>
              <X size={14} /> Limpar filtros
            </button>
          )}
        </p>
      ) : (
        <div className={tela.visao === 'grade' ? a.grade : a.lista}>
          {itensBiblioteca.map((x) => (
            <ItemBiblioteca
              key={x.id}
              arquivo={x}
              grade={tela.visao === 'grade'}
              categorias={categorias}
              tituloTarefa={tituloTarefa}
              onPrevia={() => {
                const v = versaoAtual(x);
                setPrevia({ arquivoId: v.arquivoId, nome: v.nomeOriginal, titulo: x.nome, detalhes: `v${v.numero} · ${nomeCategoria(x.categoria, categorias)}` });
              }}
              onDetalhe={() => setDetalheId(x.id)}
            />
          ))}
          {itensRef.map((r) => (
            <ItemReferencia key={r.chave} r={r} grade={tela.visao === 'grade'} onPrevia={() => setPrevia({ arquivoId: r.arquivoId, nome: r.nome, titulo: r.nome, detalhes: `${NOME_ORIGEM[r.origem]} · ${r.detalhe}` })} />
          ))}
        </div>
      )}

      {arrastando && (
        <div className={a.soltarAqui} aria-hidden>
          <Upload size={30} /> Solte para enviar em “{nomeCategoria(categoriaEnvio, categorias)}”
        </div>
      )}

      {previa && <Previa {...previa} onFechar={() => setPrevia(null)} />}
      {detalhe && <DetalheArquivo arquivo={detalhe} categorias={categorias} onFechar={() => setDetalheId(null)} onPrevia={setPrevia} />}
    </div>
  );
}

// ---------- Itens ----------

function ItemBiblioteca({
  arquivo,
  grade,
  categorias,
  tituloTarefa,
  onPrevia,
  onDetalhe,
}: {
  arquivo: ArquivoProjeto;
  grade: boolean;
  categorias: CategoriaArquivo[];
  tituloTarefa: (id: string) => string;
  onPrevia: () => void;
  onDetalhe: () => void;
}) {
  const v = versaoAtual(arquivo);
  const tarefas = arquivo.tarefas ?? [];
  const meta = `${rotuloTipo(v.nomeOriginal, v.tipo)}${tamanhoDe(v) ? ` · ${tamanhoDe(v)}` : ''}`;
  const acoes = (
    <div className={a.acoes}>
      <button type="button" className={a.btnMini} onClick={onPrevia} aria-label={`Visualizar ${arquivo.nome}`} title="Visualizar">
        <Eye size={15} />
      </button>
      <button type="button" className={a.btnMini} onClick={() => baixarArquivo(v.arquivoId, v.nomeOriginal)} aria-label={`Baixar ${arquivo.nome}`} title="Baixar">
        <Download size={15} />
      </button>
      <button type="button" className={a.btnDetalhes} onClick={onDetalhe} aria-label={`Detalhes de ${arquivo.nome}`}>
        Detalhes
      </button>
    </div>
  );
  if (grade)
    return (
      <article className={a.cartao} data-arquivo={arquivo.id}>
        <button type="button" className={a.cartaoMiniatura} onClick={onPrevia} aria-label={`Visualizar ${arquivo.nome}`}>
          <Miniatura arquivoId={v.arquivoId} nome={v.nomeOriginal} tipo={v.tipo} />
        </button>
        <strong title={arquivo.nome}>{arquivo.nome}</strong>
        <small>
          {nomeCategoria(arquivo.categoria, categorias)} · v{v.numero}
          {tarefas.length ? ` · ${tarefas.length} tarefa${tarefas.length > 1 ? 's' : ''}` : ''}
        </small>
        {acoes}
      </article>
    );
  return (
    <div className={a.linha} data-arquivo={arquivo.id}>
      <span className={a.icone}>
        <Paperclip size={16} aria-hidden />
      </span>
      <div className={a.nomeCol}>
        <button type="button" className={a.nome} onClick={onDetalhe} title={arquivo.nome}>
          {arquivo.nome}
        </button>
        <small>
          {meta} · enviado em {dataHora(v.em)}
          {v.autor ? ` por ${v.autor.nome}${v.autor.autenticado ? '' : ' (não autenticado)'}` : ''}
        </small>
      </div>
      <div className={a.chips}>
        <span className={a.chipCategoria}>{nomeCategoria(arquivo.categoria, categorias)}</span>
        {arquivo.versoes.length > 1 && <span className={a.chipVersao}>v{v.numero}</span>}
        {tarefas.slice(0, 2).map((id) => (
          <span key={id} className={a.chipTarefa} title="Tarefa vinculada">
            <Link2 size={11} aria-hidden /> {tituloTarefa(id)}
          </span>
        ))}
        {tarefas.length > 2 && <span className={a.chipTarefa}>+{tarefas.length - 2}</span>}
      </div>
      {acoes}
    </div>
  );
}

function ItemReferencia({ r, grade, onPrevia }: { r: Referencia; grade: boolean; onPrevia: () => void }) {
  const acoes = (
    <div className={a.acoes}>
      <button type="button" className={a.btnMini} onClick={onPrevia} aria-label={`Visualizar ${r.nome}`} title="Visualizar">
        <Eye size={15} />
      </button>
      <button type="button" className={a.btnMini} onClick={() => baixarArquivo(r.arquivoId, r.nome)} aria-label={`Baixar ${r.nome}`} title="Baixar">
        <Download size={15} />
      </button>
      <Link href={r.link.href} className={a.btnDetalhes}>
        {r.link.texto}
      </Link>
    </div>
  );
  if (grade)
    return (
      <article className={`${a.cartao} ${a.cartaoRef}`} data-ref={r.chave}>
        <button type="button" className={a.cartaoMiniatura} onClick={onPrevia} aria-label={`Visualizar ${r.nome}`}>
          <Miniatura arquivoId={r.arquivoId} nome={r.nome} />
        </button>
        <strong title={r.nome}>{r.nome}</strong>
        <small>
          {NOME_ORIGEM[r.origem]} · {r.detalhe}
        </small>
        {acoes}
      </article>
    );
  return (
    <div className={`${a.linha} ${a.linhaRef}`} data-ref={r.chave}>
      <span className={a.icone}>
        <Paperclip size={16} aria-hidden />
      </span>
      <div className={a.nomeCol}>
        <span className={a.nomeRef} title={r.nome}>
          {r.nome}
        </span>
        <small>
          {r.detalhe}
          {r.tamanho ? ` · ${r.tamanho}` : ''}
          {r.em ? ` · ${r.em.length === 10 ? dataBr(r.em) : dataHora(r.em)}` : ''}
        </small>
      </div>
      <div className={a.chips}>
        <span className={a.chipOrigem} title="Gerenciado em outra área; aparece aqui só como referência">
          {NOME_ORIGEM[r.origem]}
        </span>
      </div>
      {acoes}
    </div>
  );
}

// ---------- Detalhe (renomear, categoria, versões, tarefas, excluir) ----------

function DetalheArquivo({
  arquivo,
  categorias,
  onFechar,
  onPrevia,
}: {
  arquivo: ArquivoProjeto;
  categorias: CategoriaArquivo[];
  onFechar: () => void;
  onPrevia: (p: { arquivoId: string; nome: string; titulo: string; detalhes?: string }) => void;
}) {
  const { projeto, salvarComAtividade, autor, rascunho, mudarRascunho, descartarRascunho } = useJanela();
  const entradaVersao = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tarefaEscolhida, setTarefaEscolhida] = useState('');
  const idNota = `nota-versao:${arquivo.id}`;
  const nota = rascunho(idNota) ?? '';
  const tarefas = projeto.tarefasProjeto ?? [];
  const vinculadas = arquivo.tarefas ?? [];
  const livres = tarefas.filter((t) => !vinculadas.includes(t.id));
  const atual = versaoAtual(arquivo);
  const nomeA = `“${arquivo.nome}”`;

  // Esc fecha só o painel de detalhes
  useEscapeEmPilha(onFechar);

  const novaVersao = async (f: File) => {
    setMsg(null);
    setEnviando(true);
    try {
      const r = await prepararVersao(f, { projeto, entradaId: arquivo.id, autor, nota });
      if (r.erro || !r.transformar) return setMsg({ texto: r.erro ?? 'Não foi possível criar a versão.', erro: true });
      const ok = salvarComAtividade(r.transformar, 'arquivo', `Nova versão (v${r.numero}) de ${nomeA}${nota.trim() ? `: ${nota.trim()}` : ''}`);
      if (!ok) {
        for (const id of r.conteudosNovos) await apagarArquivo(id).catch(() => undefined);
        return setMsg({ texto: 'Não foi possível salvar neste navegador. A versão anterior continua como estava.', erro: true });
      }
      descartarRascunho(idNota);
      setMsg({ texto: `Versão ${r.numero} criada. As anteriores continuam no histórico.` });
    } finally {
      setEnviando(false);
      if (entradaVersao.current) entradaVersao.current.value = '';
    }
  };

  const excluir = async () => {
    const extra = vinculadas.length ? ` Ele será tirado de ${vinculadas.length} tarefa(s).` : '';
    if (!window.confirm(`Excluir ${nomeA} da biblioteca, com as ${arquivo.versoes.length} versão(ões)?${extra} O conteúdo só é apagado do navegador se nenhum outro lugar o usa.`)) return;
    const r = removerEntrada(projeto, arquivo.id);
    if (!salvarComAtividade((p) => removerEntrada(p, arquivo.id).projeto, 'arquivo', `Arquivo excluído da biblioteca: ${nomeA} (${arquivo.versoes.length} versão(ões))`)) return;
    onFechar();
    for (const id of r.conteudos) await apagarArquivoSeSemUso(id).catch(() => undefined);
  };

  return (
    <div className={a.gaveta} role="dialog" aria-modal="true" aria-label={`Detalhes de ${arquivo.nome}`}>
      <div className={a.gavetaTopo}>
        <strong>Detalhes do arquivo</strong>
        <button type="button" className={j.btnTopo} onClick={onFechar} aria-label="Fechar detalhes" autoFocus>
          <X size={18} />
        </button>
      </div>
      <div className={a.gavetaCorpo}>
        <div className={j.grade}>
          <CampoTexto
            id={`arq-nome:${arquivo.id}`}
            rotulo="Nome"
            valor={arquivo.nome}
            obrigatorio
            largo
            maxLength={160}
            aplicar={(t) => (p) => alterarEntrada(p, arquivo.id, { nome: t })}
            registro={{ tipo: 'arquivo', texto: (x, y) => `Arquivo renomeado: “${x}” → “${y}”` }}
          />
          <CampoLista
            id={`arq-cat:${arquivo.id}`}
            rotulo="Categoria"
            valor={arquivo.categoria}
            opcoes={categorias}
            textoVazio="Outros"
            aplicar={(t) => (p) => alterarEntrada(p, arquivo.id, { categoria: t || CATEGORIA_PADRAO })}
            registro={{ tipo: 'arquivo', texto: (x, y) => `Arquivo ${nomeA}: categoria ${x} → ${y}` }}
          />
          <div className={`${j.campo} ${j.campoInfo}`}>
            <span className={j.campoRotulo}>Projeto</span>
            <span className={j.infoValor}>
              {projeto.codigo} · {projeto.servico}
            </span>
          </div>
        </div>

        <section className={a.secao}>
          <h4>Versões ({arquivo.versoes.length})</h4>
          <ol className={a.versoes} reversed>
            {[...arquivo.versoes].reverse().map((v) => (
              <li key={v.numero} className={v === atual ? a.versaoAtual : ''}>
                <div>
                  <strong>
                    Versão {v.numero}
                    {v === atual ? ' · atual' : ''}
                  </strong>
                  {v.nota && <span className={a.versaoNota}>{v.nota}</span>}
                  <small>
                    {v.nomeOriginal} · {rotuloTipo(v.nomeOriginal, v.tipo)}
                    {tamanhoDe(v) ? ` · ${tamanhoDe(v)}` : ''} · {dataHora(v.em)}
                    {v.autor ? ` · ${v.autor.nome}${v.autor.autenticado ? '' : ' (não autenticado)'}` : ''}
                  </small>
                </div>
                <button type="button" className={a.btnMini} onClick={() => onPrevia({ arquivoId: v.arquivoId, nome: v.nomeOriginal, titulo: `${arquivo.nome} — versão ${v.numero}`, detalhes: v.nota })} aria-label={`Visualizar versão ${v.numero}`}>
                  <Eye size={15} />
                </button>
                <button type="button" className={a.btnMini} onClick={() => baixarArquivo(v.arquivoId, v.nomeOriginal)} aria-label={`Baixar versão ${v.numero}`}>
                  <Download size={15} />
                </button>
              </li>
            ))}
          </ol>
          <div className={a.novaVersao}>
            <label className={j.somenteLeitor} htmlFor={idNota}>
              Observação da nova versão
            </label>
            <input id={idNota} value={nota} maxLength={200} placeholder="Observação da nova versão (ex.: layout aprovado)" onChange={(e) => mudarRascunho(idNota, e.target.value)} />
            <button type="button" className={j.btnContorno} onClick={() => entradaVersao.current?.click()} disabled={enviando}>
              <Upload size={15} /> {enviando ? 'Enviando…' : 'Enviar nova versão'}
            </button>
            <input
              ref={entradaVersao}
              type="file"
              hidden
              aria-label={`Escolher nova versão de ${arquivo.nome}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) novaVersao(f);
              }}
            />
          </div>
          {msg && (
            <p className={msg.erro ? j.campoMsgErro : j.campoDica} role={msg.erro ? 'alert' : 'status'}>
              {msg.texto}
            </p>
          )}
        </section>

        <section className={a.secao}>
          <h4>Tarefas vinculadas ({vinculadas.length})</h4>
          {vinculadas.length ? (
            <ul className={a.vinculos}>
              {vinculadas.map((id) => {
                const t = tarefas.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <Link2 size={13} aria-hidden /> <span>{t?.titulo ?? 'Tarefa excluída'}</span>
                    <button
                      type="button"
                      className={j.linkAcao}
                      onClick={() => salvarComAtividade((p) => desvincularTarefa(p, arquivo.id, id), 'arquivo', `Arquivo ${nomeA} desvinculado da tarefa “${t?.titulo ?? id}” (continua na biblioteca)`)}
                    >
                      Desvincular
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={j.campoDica}>Nenhuma tarefa usa este arquivo.</p>
          )}
          {livres.length > 0 && (
            <div className={a.novaVersao}>
              <label className={j.somenteLeitor} htmlFor={`vinc-${arquivo.id}`}>
                Vincular a uma tarefa
              </label>
              <select id={`vinc-${arquivo.id}`} className={j.seletor} value={tarefaEscolhida} onChange={(e) => setTarefaEscolhida(e.target.value)}>
                <option value="">Vincular a uma tarefa…</option>
                {livres.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titulo}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={j.btnContorno}
                disabled={!tarefaEscolhida}
                onClick={() => {
                  const t = tarefas.find((x) => x.id === tarefaEscolhida);
                  if (t && salvarComAtividade((p) => vincularTarefa(p, arquivo.id, t.id, autor), 'arquivo', `Arquivo ${nomeA} vinculado à tarefa “${t.titulo}”`)) setTarefaEscolhida('');
                }}
              >
                <Link2 size={15} /> Vincular
              </button>
            </div>
          )}
        </section>

        <section className={a.secao}>
          <h4>Armazenamento</h4>
          <p className={j.campoDica}>
            <HardDrive size={13} aria-hidden /> Só neste navegador (ainda sem cópia na nuvem). O conteúdo nunca é aberto como página:
            a pré-visualização só mostra imagens, PDFs e textos conferidos pelo conteúdo.
          </p>
        </section>

        <div className={j.excluirLinha}>
          <button type="button" className={j.excluir} onClick={excluir}>
            <Trash2 size={15} /> Excluir da biblioteca
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Categorias ----------

function GerirCategorias({
  categorias,
  setCategorias,
  emUso,
  onFechar,
}: {
  categorias: CategoriaArquivo[];
  setCategorias: (f: (c: CategoriaArquivo[]) => CategoriaArquivo[]) => boolean;
  emUso: Set<string>;
  onFechar: () => void;
}) {
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const adicionar = () => {
    const nome = nova.trim().slice(0, 40);
    if (!nome) return;
    if (categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) return setErro('Já existe uma categoria com esse nome.');
    if (!setCategorias((l) => [...l, { id: idCategoria(nome, l), nome }])) return setErro('Não foi possível salvar neste navegador.');
    setNova('');
    setErro('');
  };
  return (
    <div className={a.categorias}>
      <div className={a.resultadosTopo}>
        <strong>Categorias de arquivos</strong>
        <button type="button" className={j.btnTopo} onClick={onFechar} aria-label="Fechar categorias">
          <X size={15} />
        </button>
      </div>
      <p className={j.campoDica}>Valem para todos os projetos. Só dá para remover categorias sem arquivos neste projeto; “Outros” é fixa.</p>
      <ul>
        {categorias.map((c) => (
          <li key={c.id}>
            <input
              defaultValue={c.nome}
              maxLength={40}
              aria-label={`Nome da categoria ${c.nome}`}
              onBlur={(e) => {
                const n = e.target.value.trim();
                if (n && n !== c.nome) setCategorias((l) => l.map((x) => (x.id === c.id ? { ...x, nome: n } : x)));
                else e.target.value = c.nome;
              }}
            />
            <button
              type="button"
              className={a.btnMini}
              disabled={c.id === CATEGORIA_PADRAO || emUso.has(c.id)}
              title={c.id === CATEGORIA_PADRAO ? 'Categoria fixa' : emUso.has(c.id) ? 'Tem arquivos neste projeto' : 'Remover'}
              aria-label={`Remover categoria ${c.nome}`}
              onClick={() => setCategorias((l) => l.filter((x) => x.id !== c.id))}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className={a.novaVersao}>
        <label className={j.somenteLeitor} htmlFor="nova-categoria">
          Nova categoria
        </label>
        <input
          id="nova-categoria"
          value={nova}
          maxLength={40}
          placeholder="Nova categoria (ex.: Contratos assinados)"
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <button type="button" className={j.btnContorno} onClick={adicionar} disabled={!nova.trim()}>
          <Plus size={15} /> Criar
        </button>
      </div>
      {erro && (
        <p className={j.campoMsgErro} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
