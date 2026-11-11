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
import { guardarComId, listarArquivos } from './arquivos';

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
  const arquivos = await listarArquivos();
  return {
    formato: FORMATO_BACKUP,
    versao: 1,
    criadoEm: new Date().toISOString(),
    dados: lerTudoSalvo(),
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

/** Confere se o arquivo é um backup válido, sem gravar nada. */
export async function lerBackup(arquivo: File): Promise<Backup> {
  let b: Partial<Backup>;
  try {
    b = JSON.parse(await arquivo.text()) as Partial<Backup>;
  } catch {
    throw new Error('O arquivo não é um backup do Nexa Workspace (JSON inválido).');
  }
  if (b.formato !== FORMATO_BACKUP || b.versao !== 1 || typeof b.dados !== 'object' || !Array.isArray(b.arquivos)) {
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
