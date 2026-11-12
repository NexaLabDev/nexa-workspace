'use client';

// ============================================
// BACKUP COMPLETO DO WORKSPACE
// ============================================
// Junta num único arquivo .json todas as listas salvas no navegador e todos os
// anexos (comprovantes, documentos gerados, arquivos das conversas).
// Serve de rede de segurança antes de migrações e permite recuperar tudo.
// O arquivo contém dados de clientes: guarde em local seguro e não compartilhe.
// ============================================

import { lerTudoSalvo, gravarTudoSalvo } from './store';
import { guardarComId, listarArquivos, idsDeArquivoEmUso } from './arquivos';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { identidade, disponivel, temPendentes } from './remoto';

export const FORMATO_BACKUP = 'nexa-workspace-backup';

export type ArquivoBackup = { id: string; tipo: string; nome?: string; base64: string };
export type Backup = {
  formato: typeof FORMATO_BACKUP;
  versao: 1;
  criadoEm: string;
  dados: Record<string, unknown>;
  arquivos: ArquivoBackup[];
};

function blobParaBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

function base64ParaBlob(base64: string, tipo: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo || 'application/octet-stream' });
}

export async function montarBackup(): Promise<Backup> {
  // Leia primeiro os dados e, em seguida, os anexos. Falhe explicitamente se
  // algum anexo citado não puder ser recuperado do IndexedDB deste aparelho.
  // Nunca entregue um backup com zero arquivos quando há arquivos referenciados.
  const dados = lerTudoSalvo();
  const arquivos = await listarArquivos();
  const presentes = new Set(arquivos.map(({ id }) => id));
  const ausentes = [...idsDeArquivoEmUso(dados)].filter(id => !presentes.has(id));
  if (ausentes.length) {
    throw new Error(
      'Backup incompleto: ' + ausentes.length +
      ' anexo(s) referenciado(s) não foram encontrados neste navegador. ' +
      'Nenhum backup foi gerado. Confira o dispositivo original antes de importar.'
    );
  }
  return {
    formato: FORMATO_BACKUP,
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados,
    arquivos: await Promise.all(
      arquivos.map(async ({ id, arquivo }) => ({
        id,
        tipo: arquivo.type,
        nome: arquivo instanceof File ? arquivo.name : undefined,
        base64: await blobParaBase64(arquivo),
      }))
    ),
  };
}

/** Backup dos dados já sincronizados no Supabase, sem alterar nada no servidor. */
export async function montarBackupNuvem(): Promise<Backup> {
  const usuario = identidade();
  if (!usuario || usuario.papel !== 'administrador' || !disponivel() || temPendentes()) {
    throw new Error('Entre como administrador e conclua os salvamentos antes do backup da nuvem.');
  }

  // Lê novamente os registros do banco para não exportar uma cópia de tela desatualizada.
  const db = supabaseNavegador();
  const { data: registros, error } = await db.rpc('ler_registros');
  if (error || !Array.isArray(registros)) {
    throw new Error('Não foi possível ler todos os registros do Supabase. Nenhum backup foi gerado.');
  }

  const colecoesLista = new Set([
    'leads', 'clientes', 'vendas', 'projetos', 'documentos',
    'conversas', 'servicos', 'categorias-arquivos',
  ]);
  const dados: Record<string, unknown> = {};
  for (const r of registros as Array<{ colecao: string; id: string; conteudo: unknown }>) {
    if (r.conteudo === null) continue; // Exclusões já registradas no banco.
    if (colecoesLista.has(r.colecao)) {
      ((dados[r.colecao] ??= []) as unknown[]).push(r.conteudo);
    } else {
      dados[r.colecao] = r.conteudo;
    }
  }

  const bucket = db.storage.from('nexa-arquivos');
  const nomes: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data: pagina, error: erroLista } = await bucket.list(usuario.workspace_id, { limit: 100, offset });
    if (erroLista || !pagina) {
      throw new Error('Não foi possível listar os anexos privados. Nenhum backup foi gerado.');
    }
    for (const item of pagina) {
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(item.name)) {
        throw new Error('Existe um objeto inesperado no armazenamento privado. Backup interrompido.');
      }
      nomes.push(item.name);
    }
    if (pagina.length < 100) break;
  }
  const presentes = new Set(nomes);
  const ausentes = [...idsDeArquivoEmUso(dados)].filter(id => !presentes.has(id));
  if (ausentes.length) {
    throw new Error('Backup incompleto: ' + ausentes.length + ' anexo(s) referenciado(s) faltam na nuvem.');
  }

  const arquivos: ArquivoBackup[] = [];
  let bytesTotais = 0;
  for (const id of nomes) {
    const { data: arquivo, error: erroDownload } = await bucket.download(usuario.workspace_id + '/' + id);
    if (erroDownload || !arquivo) {
      throw new Error('Falha ao baixar o anexo ' + id + '. Nenhum backup foi gerado.');
    }
    bytesTotais += arquivo.size;
    if (bytesTotais > 50 * 1024 * 1024) {
      throw new Error('Os anexos excedem 50 MB. O backup único foi interrompido para não sobrecarregar o navegador.');
    }
    arquivos.push({ id, tipo: arquivo.type, base64: await blobParaBase64(arquivo) });
  }
  return { formato: FORMATO_BACKUP, versao: 1, criadoEm: new Date().toISOString(), dados, arquivos };
}

function nomeArquivo(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `nexa-workspace-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Gera e baixa o backup. Devolve o resumo (quantas listas e arquivos). */
export async function baixarBackup(): Promise<{ listas: number; arquivos: number }> {
  const b = await montarBackup();
  const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo();
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { listas: Object.keys(b.dados).length, arquivos: b.arquivos.length };
}

/** Baixa a cópia completa disponível no Supabase, incluindo os anexos privados. */
export async function baixarBackupNuvem(): Promise<{ listas: number; arquivos: number }> {
  const b = await montarBackupNuvem();
  const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo().replace('nexa-workspace-backup-', 'nexa-workspace-nuvem-');
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { listas: Object.keys(b.dados).length, arquivos: b.arquivos.length };
}

/** Confere se o arquivo é um backup válido, sem gravar nada. */
export async function lerBackup(arquivo: File): Promise<Backup> {
  let b: Partial<Backup>;
  try {
    b = JSON.parse(await arquivo.text()) as Partial<Backup>;
  } catch {
    throw new Error('O arquivo não é um backup do Nexa Workspace (JSON inválido).');
  }
  if (b.formato !== FORMATO_BACKUP || b.versao !== 1 || !b.dados || typeof b.dados !== 'object' || Array.isArray(b.dados) || !Array.isArray(b.arquivos)) {
    throw new Error('O arquivo não é um backup do Nexa Workspace.');
  }
  return b as Backup;
}

/**
 * Restaura um backup. Antes, baixa automaticamente um backup do estado atual,
 * para que a restauração também possa ser desfeita.
 */
export async function restaurarBackup(b: Backup): Promise<void> {
  await baixarBackup();
  for (const a of b.arquivos) {
    const blob = base64ParaBlob(a.base64, a.tipo);
    await guardarComId(a.id, a.nome ? new File([blob], a.nome, { type: a.tipo }) : blob);
  }
  gravarTudoSalvo(b.dados);
}
