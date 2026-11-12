'use client';

// ============================================
// ENVIO DE ARQUIVOS PARA A BIBLIOTECA DO PROJETO
// ============================================
// 1) Calcula o SHA-256 de cada arquivo (duplicidade real = mesmo conteúdo, não mesmo nome).
// 2) Se o conteúdo já existe (na biblioteca ou em comprovantes/documentos/arquivos da venda),
//    reaproveita: nenhuma cópia física nova é guardada.
// 3) Só conteúdo novo é guardado. Se a gravação dos dados falhar depois, quem chamou
//    apaga os conteúdos novos (conteudosNovos), para não sobrar arquivo solto.
// O conteúdo vai para o Storage privado do Supabase (`nexa-arquivos`).
// ============================================

import type { AutorRegistro, Projeto } from '../dados-exemplo';
import { LIMITE_BYTES, guardarArquivo, hashDoConteudo, lerArquivo, tamanhoLegivel } from '../arquivos';
import {
  adicionarEntrada,
  adicionarVersao,
  arquivosDe,
  conteudosSemHash,
  gravarHashes,
  nomeCategoria,
  novaEntrada,
  versaoAtual,
  vincularTarefa,
  type DadosConteudo,
} from '../biblioteca';
import type { CategoriaArquivo } from '../dados-exemplo';

/** Arquivo de outra área (Financeiro, Documentos, venda) que pode ter o mesmo conteúdo */
export type ReferenciaConteudo = { arquivoId: string; nome: string; origem: string };

export type ResultadoEnvio = {
  nome: string;
  situacao: 'novo' | 'reaproveitado' | 'ja-existe' | 'erro';
  mensagem: string;
  /** Guardado para "Tentar de novo" quando deu erro */
  arquivo?: File;
};

type Plano = (p: Projeto) => Projeto;

/** Cache de hashes de conteúdos de outras áreas (só nesta sessão) */
const cacheHash = new Map<string, string | null>();

async function hashDoGuardado(id: string): Promise<string | null> {
  if (cacheHash.has(id)) return cacheHash.get(id)!;
  try {
    const b = await lerArquivo(id);
    const h = b ? await hashDoConteudo(b) : null;
    cacheHash.set(id, h);
    return h;
  } catch {
    return null;
  }
}

/** Hashes que faltam nos arquivos antigos da biblioteca (calculados lendo o conteúdo). */
async function hashesQueFaltam(projeto: Projeto): Promise<Record<string, string>> {
  const saida: Record<string, string> = {};
  for (const id of conteudosSemHash(projeto)) {
    const h = await hashDoGuardado(id);
    if (h) saida[id] = h;
  }
  return saida;
}

export async function prepararEnvio(
  arquivos: File[],
  ctx: { projeto: Projeto; categoria: string; categorias: CategoriaArquivo[]; autor: AutorRegistro; tarefaId?: string; referencias?: ReferenciaConteudo[] }
): Promise<{ transformar: Plano; resultados: ResultadoEnvio[]; conteudosNovos: string[]; resumo: string[] }> {
  const { projeto, categoria, categorias, autor, tarefaId } = ctx;
  const hashesAntigos = await hashesQueFaltam(projeto);
  const base = gravarHashes(projeto, hashesAntigos);
  const nomeCat = nomeCategoria(categoria, categorias);

  // conteúdo conhecido → onde está
  const naBiblioteca = new Map<string, Array<{ entradaId: string; nome: string; categoria: string; arquivoId: string }>>();
  for (const a of arquivosDe(base)) for (const v of a.versoes) if (v.hash) naBiblioteca.set(v.hash, [...(naBiblioteca.get(v.hash) ?? []), { entradaId: a.id, nome: a.nome, categoria: a.categoria, arquivoId: v.arquivoId }]);
  const emOutrasAreas = new Map<string, ReferenciaConteudo>();
  for (const r of ctx.referencias ?? []) {
    const h = await hashDoGuardado(r.arquivoId);
    if (h && !emOutrasAreas.has(h)) emOutrasAreas.set(h, r);
  }

  const planos: Plano[] = [];
  const resultados: ResultadoEnvio[] = [];
  const conteudosNovos: string[] = [];
  const resumo: string[] = [];

  for (const arquivo of arquivos) {
    const nome = arquivo.name || 'arquivo';
    if (arquivo.size > LIMITE_BYTES) {
      resultados.push({ nome, situacao: 'erro', mensagem: `Tem ${tamanhoLegivel(arquivo.size)}; o limite é ${tamanhoLegivel(LIMITE_BYTES)} por arquivo.` });
      continue;
    }
    let hash: string;
    try {
      hash = await hashDoConteudo(arquivo);
    } catch {
      resultados.push({ nome, situacao: 'erro', mensagem: 'Não foi possível ler o arquivo.', arquivo });
      continue;
    }
    const conteudoBase = (arquivoId: string): DadosConteudo => ({ arquivoId, nomeOriginal: nome, tipo: arquivo.type || undefined, tamanho: arquivo.size, hash });
    const iguais = naBiblioteca.get(hash) ?? [];
    const mesmoNome = arquivosDe(base).find((a) => a.categoria === categoria && a.nome.toLowerCase() === nome.toLowerCase() && !a.versoes.some((v) => v.hash === hash));
    const avisoNome = mesmoNome ? ` Já existe outro “${mesmoNome.nome}” nesta categoria com conteúdo diferente; se for uma atualização, use “Nova versão” nele.` : '';

    // 1) conteúdo já está na biblioteca
    if (iguais.length) {
      const doMesmoLugar = iguais.find((x) => x.categoria === categoria) ?? iguais[0];
      if (tarefaId) {
        planos.push((p) => vincularTarefa(p, doMesmoLugar.entradaId, tarefaId, autor));
        resultados.push({ nome, situacao: 'reaproveitado', mensagem: `Mesmo conteúdo de “${doMesmoLugar.nome}”, que já está na biblioteca: vinculado à tarefa sem nova cópia.` });
        resumo.push(`${doMesmoLugar.nome} (já na biblioteca)`);
        continue;
      }
      if (iguais.some((x) => x.categoria === categoria)) {
        resultados.push({ nome, situacao: 'ja-existe', mensagem: `Já está na biblioteca como “${doMesmoLugar.nome}” (${nomeCat}). Nada foi duplicado.` });
        continue;
      }
      const entrada = novaEntrada(conteudoBase(iguais[0].arquivoId), categoria, autor);
      planos.push((p) => adicionarEntrada(p, entrada));
      naBiblioteca.set(hash, [...iguais, { entradaId: entrada.id, nome: entrada.nome, categoria, arquivoId: iguais[0].arquivoId }]);
      resultados.push({ nome, situacao: 'reaproveitado', mensagem: `Mesmo conteúdo de “${iguais[0].nome}” (${nomeCategoria(iguais[0].categoria, categorias)}): também listado em ${nomeCat}, sem nova cópia.${avisoNome}` });
      resumo.push(nome);
      continue;
    }

    // 2) conteúdo já existe em outra área (comprovante, documento, arquivo da venda)
    const externo = emOutrasAreas.get(hash);
    let arquivoId: string;
    let situacao: ResultadoEnvio['situacao'] = 'novo';
    let mensagem = `Enviado para ${nomeCat}.${avisoNome}`;
    if (externo) {
      arquivoId = externo.arquivoId;
      situacao = 'reaproveitado';
      mensagem = `Mesmo conteúdo de “${externo.nome}” (${externo.origem}): adicionado em ${nomeCat} sem nova cópia.${avisoNome}`;
    } else {
      // 3) conteúdo novo: guarda (se falhar, nada é registrado)
      try {
        arquivoId = await guardarArquivo(arquivo);
        conteudosNovos.push(arquivoId);
      } catch {
        resultados.push({ nome, situacao: 'erro', mensagem: 'Não foi possível guardar neste navegador (espaço cheio ou bloqueado).', arquivo });
        continue;
      }
    }
    const entrada = novaEntrada(conteudoBase(arquivoId), categoria, autor);
    planos.push((p) => adicionarEntrada(p, entrada));
    if (tarefaId) planos.push((p) => vincularTarefa(p, entrada.id, tarefaId, autor));
    naBiblioteca.set(hash, [{ entradaId: entrada.id, nome: entrada.nome, categoria, arquivoId }]);
    resultados.push({ nome, situacao, mensagem: tarefaId ? `${mensagem} Vinculado à tarefa.` : mensagem });
    resumo.push(nome);
  }

  return {
    transformar: (p) => planos.reduce((acc, f) => f(acc), gravarHashes(p, hashesAntigos)),
    resultados,
    conteudosNovos,
    resumo,
  };
}

/** Nova versão de um arquivo da biblioteca. Conteúdo igual à versão atual é recusado. */
export async function prepararVersao(
  arquivo: File,
  ctx: { projeto: Projeto; entradaId: string; autor: AutorRegistro; nota?: string }
): Promise<{ transformar?: Plano; erro?: string; conteudosNovos: string[]; numero?: number }> {
  const entrada = arquivosDe(ctx.projeto).find((a) => a.id === ctx.entradaId);
  if (!entrada) return { erro: 'Arquivo não encontrado.', conteudosNovos: [] };
  if (arquivo.size > LIMITE_BYTES) return { erro: `O arquivo tem ${tamanhoLegivel(arquivo.size)}; o limite é ${tamanhoLegivel(LIMITE_BYTES)}.`, conteudosNovos: [] };
  const hashesAntigos = await hashesQueFaltam(ctx.projeto);
  const base = gravarHashes(ctx.projeto, hashesAntigos);
  const atual = versaoAtual(arquivosDe(base).find((a) => a.id === ctx.entradaId)!);
  let hash: string;
  try {
    hash = await hashDoConteudo(arquivo);
  } catch {
    return { erro: 'Não foi possível ler o arquivo.', conteudosNovos: [] };
  }
  if (atual.hash === hash) return { erro: 'Este arquivo é igual à versão atual. Nenhuma versão nova foi criada.', conteudosNovos: [] };
  // conteúdo que já existe em algum lugar da biblioteca (ex.: voltar a uma versão antiga): reaproveita
  const existente = arquivosDe(base)
    .flatMap((a) => a.versoes)
    .find((v) => v.hash === hash);
  const conteudosNovos: string[] = [];
  let arquivoId = existente?.arquivoId;
  if (!arquivoId) {
    try {
      arquivoId = await guardarArquivo(arquivo);
      conteudosNovos.push(arquivoId);
    } catch {
      return { erro: 'Não foi possível guardar neste navegador (espaço cheio ou bloqueado).', conteudosNovos: [] };
    }
  }
  const conteudo: DadosConteudo = { arquivoId, nomeOriginal: arquivo.name || entrada.nome, tipo: arquivo.type || undefined, tamanho: arquivo.size, hash };
  const numero = Math.max(...entrada.versoes.map((v) => v.numero)) + 1;
  return {
    transformar: (p) => adicionarVersao(gravarHashes(p, hashesAntigos), ctx.entradaId, conteudo, ctx.autor, ctx.nota),
    conteudosNovos,
    numero,
  };
}
