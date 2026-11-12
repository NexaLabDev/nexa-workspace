'use client';

// ============================================
// ARQUIVOS ANEXADOS (conteúdo no Storage privado do Supabase)
// ============================================
// Upload/leitura vão para o bucket `nexa-arquivos` (por workspace).
// IndexedDB local ficou só como fallback legado de limpeza/restauração antiga.
// ============================================

import { baixarPrivado, removerPrivado, subirPrivado } from './storage';

const BANCO = 'nexa-workspace-arquivos';
const TABELA = 'arquivos';
/** Limite por arquivo (o navegador pode recusar arquivos muito grandes) */
export const LIMITE_BYTES = 25 * 1024 * 1024;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABELA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

/**
 * Formato guardado: bytes simples + tipo + nome. Guardar o objeto "Blob" direto no IndexedDB
 * falha em alguns Safaris (iPhone): o arquivo pode ficar ilegível depois. Registros antigos
 * (Blob) continuam sendo lidos normalmente; nada é convertido nem apagado.
 */
type Registro = { formato: 2; dados: ArrayBuffer; tipo: string; nome?: string };

async function paraRegistro(arquivo: Blob): Promise<Registro> {
  return { formato: 2, dados: await arquivo.arrayBuffer(), tipo: arquivo.type || '', nome: (arquivo as File).name || undefined };
}

function deRegistro(valor: unknown): Blob | undefined {
  if (!valor) return undefined;
  if (valor instanceof Blob) return valor;
  const r = valor as Registro;
  if (r.formato === 2 && r.dados) {
    try {
      return r.nome ? new File([r.dados], r.nome, { type: r.tipo }) : new Blob([r.dados], { type: r.tipo });
    } catch {
      return new Blob([r.dados], { type: r.tipo });
    }
  }
  return undefined;
}

async function operar<T>(modo: IDBTransactionMode, acao: (t: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(TABELA, modo);
    const req = acao(tx.objectStore(TABELA));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Guarda o arquivo e devolve a chave para encontrá-lo depois. */
export async function guardarArquivo(arquivo: File): Promise<string> {
  if (arquivo.size > LIMITE_BYTES) throw new Error('Arquivo maior que 25 MB.');
  const id = 'arq-'+crypto.randomUUID();
  await subirPrivado(id,arquivo);
  return id;
}

export async function baixarArquivo(id: string, nome: string): Promise<boolean> {
  const blob = await lerArquivo(id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export async function apagarArquivo(id: string): Promise<void> {
  try {
    await removerPrivado(id);
  } catch {
    /* pode falhar se a policy DELETE ainda não existir ou o objeto já não estiver lá */
  }
  try {
    await operar('readwrite', (t) => t.delete(id));
  } catch {
    /* IndexedDB legado pode não ter a chave */
  }
}

export async function apagarTodosArquivos(): Promise<void> {
  await operar('readwrite', (t) => t.clear());
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Baixa um texto como arquivo (ex.: ficha de dados). */
export function baixarTexto(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Abre o arquivo numa nova aba para visualizar — só se o CONTEÚDO for imagem, PDF ou texto.
 * Qualquer outra coisa (HTML, SVG, executáveis, tipos desconhecidos) é BAIXADA em vez de aberta:
 * um arquivo enviado nunca roda dentro do Workspace nem acessa os dados dele.
 * `confiavel` = documento gerado pelo próprio Workspace (HTML dos modelos), que pode abrir normalmente.
 */
export async function abrirArquivo(id: string, opcoes: { confiavel?: boolean; nome?: string } = {}): Promise<boolean> {
  const blob = await lerArquivo(id);
  if (!blob) return false;
  const nome = opcoes.nome ?? (blob as File).name ?? 'arquivo';
  if (opcoes.confiavel) return abrirDocumentoIsolado(blob, false);
  const tipo = await tipoSeguro(blob, nome);
  if (!tipo) return baixarBlob(blob, nome);
  const url = URL.createObjectURL(new Blob([blob], { type: tipo }));
  const janela = window.open(url, '_blank');
  if (janela) janela.opener = null;
  else {
    // bloqueador de pop-up: baixa em vez de abrir
    URL.revokeObjectURL(url);
    return baixarBlob(blob, nome);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

function baixarBlob(blob: Blob, nome: string): boolean {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

/** Conteúdo guardado (ou undefined se não existe mais). */
export async function lerArquivo(id: string): Promise<Blob | undefined> {
  return baixarPrivado(id);
}

export type TipoPrevia = 'imagem' | 'pdf' | 'texto';

const EXT_TEXTO = new Set(['txt', 'md', 'csv', 'json', 'log', 'tsv']);
export const LIMITE_PREVIA_TEXTO = 512 * 1024;

/**
 * Descobre pelo CONTEÚDO (assinatura dos primeiros bytes) se é seguro mostrar o arquivo
 * e com qual tipo. Não confia no nome nem no tipo informado pelo navegador.
 */
export async function tipoSeguro(blob: Blob, nome = ''): Promise<string | null> {
  const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const comeca = (...x: number[]) => x.every((v, i) => b[i] === v);
  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (comeca(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (comeca(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (comeca(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (comeca(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  const ext = nome.toLowerCase().split('.').pop() ?? '';
  if (EXT_TEXTO.has(ext) && blob.size <= LIMITE_PREVIA_TEXTO) {
    const amostra = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
    if (!amostra.includes(0)) return 'text/plain;charset=utf-8';
  }
  return null;
}

export function tipoDePrevia(tipo: string | null): TipoPrevia | null {
  if (!tipo) return null;
  if (tipo.startsWith('image/')) return 'imagem';
  if (tipo === 'application/pdf') return 'pdf';
  if (tipo.startsWith('text/plain')) return 'texto';
  return null;
}

/** SHA-256 do conteúdo (em hexadecimal): identifica duplicidade real, não pelo nome. */
export async function hashDoConteudo(blob: Blob): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(dig))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

/** Todos os ids de arquivo citados em qualquer dado salvo (qualquer campo "arquivoId"). */
export function idsDeArquivoEmUso(dados: unknown, saida = new Set<string>()): Set<string> {
  if (Array.isArray(dados)) dados.forEach((x) => idsDeArquivoEmUso(x, saida));
  else if (dados && typeof dados === 'object') {
    for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
      if (k === 'arquivoId' && typeof v === 'string') saida.add(v);
      else if (v && typeof v === 'object') idsDeArquivoEmUso(v, saida);
    }
  }
  return saida;
}

/**
 * Apaga o conteúdo só se NENHUM dado salvo (CRM, projetos, tarefas, biblioteca, conversas,
 * documentos, comprovantes) ainda usa este arquivo. Chame DEPOIS de gravar a remoção do vínculo.
 */
export async function apagarArquivoSeSemUso(id: string): Promise<boolean> {
  // Outros registros ou dispositivos podem manter referências. O vínculo é
  // removido da entidade; o objeto privado fica disponível para recuperação.
  return false;
}

/** Todos os arquivos guardados (para o backup completo). */
export async function listarArquivos(): Promise<Array<{ id: string; arquivo: Blob }>> {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABELA, 'readonly');
    const loja = tx.objectStore(TABELA);
    const chaves = loja.getAllKeys();
    const valores = loja.getAll();
    tx.oncomplete = () => {
      db.close();
      try {resolve((chaves.result as IDBValidKey[]).map((k,i)=>{const arquivo=deRegistro(valores.result[i]);if(!arquivo)throw Error('Anexo local ilegível: '+String(k));return {id:String(k),arquivo};}));}catch(e){reject(e);}
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Grava um arquivo com a chave informada (usado ao restaurar um backup). */
export async function guardarComId(id: string, arquivo: Blob): Promise<void> {
  if (arquivo.size > LIMITE_BYTES) throw new Error('Arquivo maior que 25 MB.');
  await subirPrivado(id, arquivo);
}

/**
 * Abre o documento numa janela e chama a impressão, onde dá para escolher "Salvar como PDF".
 * Usado SÓ para exportar em PDF os documentos gerados pelo próprio Workspace (HTML dos modelos).
 */
export async function imprimirArquivo(id: string): Promise<boolean> {
  const blob = await lerArquivo(id);
  if (!blob) return false;
  return abrirDocumentoIsolado(blob,true);
}

function abrirDocumentoIsolado(blob:Blob, imprimir:boolean){
  const janela=window.open('about:blank','_blank');
  if(!janela)return false;
  janela.opener=null;
  const frame=janela.document.createElement('iframe');
  frame.setAttribute('sandbox','');
  frame.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0';
  const url=URL.createObjectURL(blob.slice(0,blob.size,'text/html'));
  frame.onload=()=>{if(imprimir)janela.print();};
  frame.src=url;janela.document.body.appendChild(frame);
  janela.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
  return true;
}
