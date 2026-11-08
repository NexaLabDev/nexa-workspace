// ============================================
// BIBLIOTECA DE ARQUIVOS DO PROJETO (aba Anexos)
// ============================================
// Sem dependência do navegador (testável). Regras:
// - Cada arquivo tem versões; a atual é a última. Nova versão NUNCA sobrescreve a anterior.
// - Duplicidade é pelo CONTEÚDO (hash), nunca pelo nome. O mesmo conteúdo pode estar em
//   várias entradas/categorias/tarefas sem nova cópia física (mesmo arquivoId).
// - Anexo de tarefa = vínculo com uma entrada da biblioteca. Desvincular não apaga nada.
// - Apagar o conteúdo físico só acontece se nenhum outro dado ainda o usa (arquivos.ts).
// ============================================

import type { AnexoTarefa, ArquivoProjeto, AutorRegistro, CategoriaArquivo, Projeto, TarefaProjeto, VersaoArquivo } from './dados-exemplo';

export const CATEGORIAS_PADRAO: CategoriaArquivo[] = [
  { id: 'briefing', nome: 'Briefing' },
  { id: 'referencias', nome: 'Referências' },
  { id: 'identidade', nome: 'Identidade visual' },
  { id: 'tecnicos', nome: 'Arquivos técnicos' },
  { id: 'entregaveis', nome: 'Entregáveis' },
  { id: 'outros', nome: 'Outros' },
];

/** Categoria usada quando nenhuma é escolhida (e para anexos antigos de tarefas) */
export const CATEGORIA_PADRAO = 'outros';

const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function arquivosDe(p: Projeto): ArquivoProjeto[] {
  return p.arquivos ?? [];
}

export function versaoAtual(a: ArquivoProjeto): VersaoArquivo {
  return a.versoes[a.versoes.length - 1];
}

export function nomeCategoria(id: string, categorias: CategoriaArquivo[]): string {
  return categorias.find((c) => c.id === id)?.nome ?? (id === CATEGORIA_PADRAO ? 'Outros' : 'Categoria removida');
}

/** Id novo para uma categoria a partir do nome (sem repetir os existentes). */
export function idCategoria(nome: string, existentes: CategoriaArquivo[]): string {
  const base =
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'categoria';
  let id = base;
  let i = 2;
  while (existentes.some((c) => c.id === id)) id = `${base}-${i++}`;
  return id;
}

// ---------- Entradas e versões ----------

export type DadosConteudo = Pick<VersaoArquivo, 'arquivoId' | 'nomeOriginal' | 'tipo' | 'tamanho' | 'hash'>;

export function novaEntrada(conteudo: DadosConteudo, categoria: string, autor?: AutorRegistro, agora = new Date(), nome?: string): ArquivoProjeto {
  return {
    id: novoId('arqp'),
    nome: (nome ?? conteudo.nomeOriginal).slice(0, 160),
    categoria,
    versoes: [{ numero: 1, ...conteudo, em: agora.toISOString(), ...(autor ? { autor } : {}), armazenamento: { tipo: 'navegador' } }],
    criadoEm: agora.toISOString(),
  };
}

export function adicionarEntrada(p: Projeto, a: ArquivoProjeto): Projeto {
  return { ...p, arquivos: [...arquivosDe(p), a] };
}

export function alterarEntrada(p: Projeto, id: string, mud: Partial<ArquivoProjeto> | ((a: ArquivoProjeto) => ArquivoProjeto)): Projeto {
  return { ...p, arquivos: arquivosDe(p).map((a) => (a.id === id ? (typeof mud === 'function' ? mud(a) : { ...a, ...mud }) : a)) };
}

/** Acrescenta uma versão (a anterior continua no histórico). */
export function adicionarVersao(p: Projeto, id: string, conteudo: DadosConteudo, autor?: AutorRegistro, nota?: string, agora = new Date()): Projeto {
  return alterarEntrada(p, id, (a) => ({
    ...a,
    versoes: [
      ...a.versoes,
      {
        numero: Math.max(...a.versoes.map((v) => v.numero)) + 1,
        ...conteudo,
        em: agora.toISOString(),
        ...(autor ? { autor } : {}),
        ...(nota?.trim() ? { nota: nota.trim().slice(0, 200) } : {}),
        armazenamento: { tipo: 'navegador' },
      },
    ],
  }));
}

/** Grava hashes calculados depois (arquivos antigos que ainda não tinham). */
export function gravarHashes(p: Projeto, hashes: Record<string, string>): Projeto {
  if (!Object.keys(hashes).length) return p;
  return { ...p, arquivos: arquivosDe(p).map((a) => ({ ...a, versoes: a.versoes.map((v) => (!v.hash && hashes[v.arquivoId] ? { ...v, hash: hashes[v.arquivoId] } : v)) })) };
}

// ---------- Vínculo com tarefas ----------

function tamanhoTexto(v: VersaoArquivo): string | undefined {
  if (v.tamanhoTexto) return v.tamanhoTexto;
  if (v.tamanho == null) return undefined;
  return v.tamanho < 1024 * 1024 ? `${Math.max(1, Math.round(v.tamanho / 1024))} KB` : `${(v.tamanho / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Liga o arquivo à tarefa (sem duplicar o vínculo). */
export function vincularTarefa(p: Projeto, arquivoProjetoId: string, tarefaId: string, autor: AutorRegistro, agora = new Date()): Projeto {
  const a = arquivosDe(p).find((x) => x.id === arquivoProjetoId);
  const t = (p.tarefasProjeto ?? []).find((x) => x.id === tarefaId);
  if (!a || !t) return p;
  const jaNaTarefa = (t.anexos ?? []).some((x) => x.arquivoProjetoId === a.id);
  const v = versaoAtual(a);
  const anexo: AnexoTarefa = { id: novoId('an'), nome: a.nome, tamanho: tamanhoTexto(v), arquivoId: v.arquivoId, em: agora.toISOString(), autor, arquivoProjetoId: a.id };
  return {
    ...p,
    arquivos: arquivosDe(p).map((x) => (x.id === a.id && !(x.tarefas ?? []).includes(tarefaId) ? { ...x, tarefas: [...(x.tarefas ?? []), tarefaId] } : x)),
    tarefasProjeto: jaNaTarefa ? p.tarefasProjeto : (p.tarefasProjeto ?? []).map((x) => (x.id === tarefaId ? { ...x, anexos: [...(x.anexos ?? []), anexo] } : x)),
  };
}

/** Tira o arquivo da tarefa. O arquivo continua na biblioteca (e nas outras tarefas). */
export function desvincularTarefa(p: Projeto, arquivoProjetoId: string, tarefaId: string): Projeto {
  return {
    ...p,
    arquivos: arquivosDe(p).map((x) => (x.id === arquivoProjetoId ? { ...x, tarefas: (x.tarefas ?? []).filter((id) => id !== tarefaId) } : x)),
    tarefasProjeto: (p.tarefasProjeto ?? []).map((t) =>
      t.id === tarefaId ? { ...t, anexos: (t.anexos ?? []).filter((an) => an.arquivoProjetoId !== arquivoProjetoId) } : t
    ),
  };
}

/** Remove a entrada da biblioteca e os vínculos com tarefas. Devolve os conteúdos que ela usava (para apagar se ninguém mais usar). */
export function removerEntrada(p: Projeto, id: string): { projeto: Projeto; conteudos: string[] } {
  const a = arquivosDe(p).find((x) => x.id === id);
  if (!a) return { projeto: p, conteudos: [] };
  return {
    projeto: {
      ...p,
      arquivos: arquivosDe(p).filter((x) => x.id !== id),
      tarefasProjeto: (p.tarefasProjeto ?? []).map((t) => (t.anexos?.some((an) => an.arquivoProjetoId === id) ? { ...t, anexos: t.anexos.filter((an) => an.arquivoProjetoId !== id) } : t)),
    },
    conteudos: Array.from(new Set(a.versoes.map((v) => v.arquivoId))),
  };
}

/** Quando a tarefa é excluída: os arquivos ficam na biblioteca, só perdem o vínculo. */
export function soltarArquivosDaTarefa(p: Projeto, tarefaId: string): Projeto {
  if (!arquivosDe(p).some((a) => a.tarefas?.includes(tarefaId))) return p;
  return { ...p, arquivos: arquivosDe(p).map((a) => (a.tarefas?.includes(tarefaId) ? { ...a, tarefas: a.tarefas.filter((x) => x !== tarefaId) } : a)) };
}

/** Entrada da biblioteca a que o anexo da tarefa se refere (pelo vínculo ou, em dados antigos, pelo conteúdo). */
export function entradaDoAnexo(p: Projeto, an: AnexoTarefa): ArquivoProjeto | undefined {
  const l = arquivosDe(p);
  return (an.arquivoProjetoId && l.find((a) => a.id === an.arquivoProjetoId)) || l.find((a) => a.versoes.some((v) => v.arquivoId === an.arquivoId));
}

/**
 * Anexos de tarefas de antes da biblioteca: cada um vira (ou encontra) uma entrada na biblioteca,
 * sem copiar o conteúdo. Mesma lista se nada mudou (idempotente).
 */
export function garantirBibliotecaDasTarefas(projetos: Projeto[]): Projeto[] {
  let mudouAlgum = false;
  const saida = projetos.map((p) => {
    const pendentes = (p.tarefasProjeto ?? []).some((t) => (t.anexos ?? []).some((an) => !an.arquivoProjetoId));
    if (!pendentes) return p;
    mudouAlgum = true;
    let arquivos = [...arquivosDe(p)];
    const tarefas: TarefaProjeto[] = (p.tarefasProjeto ?? []).map((t) => {
      if (!(t.anexos ?? []).some((an) => !an.arquivoProjetoId)) return t;
      const anexos = (t.anexos ?? []).map((an) => {
        if (an.arquivoProjetoId) return an;
        let entrada = arquivos.find((a) => a.versoes.some((v) => v.arquivoId === an.arquivoId));
        if (!entrada) {
          entrada = {
            id: `arqp-${an.id}`,
            nome: an.nome,
            categoria: CATEGORIA_PADRAO,
            versoes: [{ numero: 1, arquivoId: an.arquivoId, nomeOriginal: an.nome, tamanhoTexto: an.tamanho, em: an.em, autor: an.autor, armazenamento: { tipo: 'navegador' } }],
            criadoEm: an.em,
          };
          arquivos.push(entrada);
        }
        const id = entrada.id;
        arquivos = arquivos.map((a) => (a.id === id && !(a.tarefas ?? []).includes(t.id) ? { ...a, tarefas: [...(a.tarefas ?? []), t.id] } : a));
        return { ...an, arquivoProjetoId: id };
      });
      return { ...t, anexos };
    });
    return { ...p, arquivos, tarefasProjeto: tarefas };
  });
  return mudouAlgum ? saida : projetos;
}

// ---------- Duplicidade (pelo conteúdo) ----------

/** Entradas que já têm este conteúdo (em qualquer versão). */
export function entradasComConteudo(p: Projeto, hash: string): ArquivoProjeto[] {
  return arquivosDe(p).filter((a) => a.versoes.some((v) => v.hash === hash));
}

/** Versões sem hash (arquivos antigos), para calcular antes de comparar. */
export function conteudosSemHash(p: Projeto): string[] {
  return Array.from(new Set(arquivosDe(p).flatMap((a) => a.versoes.filter((v) => !v.hash).map((v) => v.arquivoId))));
}

// ---------- Busca ----------

export function combinaBusca(a: ArquivoProjeto, busca: string, extras: string[] = []): boolean {
  const q = busca
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  if (!q) return true;
  const alvo = [a.nome, ...a.versoes.map((v) => v.nomeOriginal), ...a.versoes.map((v) => v.nota ?? ''), ...extras]
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return q.split(/\s+/).every((p) => alvo.includes(p));
}

/** Rótulo curto do tipo, pela extensão do nome original (ex.: "PDF", "PNG"). */
export function rotuloTipo(nome: string, mime?: string): string {
  const ext = nome.includes('.') ? nome.split('.').pop()!.toUpperCase().slice(0, 5) : '';
  if (ext) return ext;
  if (mime?.includes('/')) return mime.split('/')[1].toUpperCase().slice(0, 6);
  return 'Arquivo';
}
