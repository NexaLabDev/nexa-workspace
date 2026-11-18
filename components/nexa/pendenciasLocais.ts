'use client';

// Diário local das alterações que ainda NÃO foram confirmadas pelo Supabase.
// Guarda somente edições pendentes, por usuário + workspace. Não guarda tokens.
// IndexedDB persiste após recarregar/fechar a aba (diferente de memória).
// Os dados são privados e ficam no dispositivo: não usar em computadores públicos.
import type { Identidade, Registro } from './remoto';

const BANCO = 'nexa-workspace-edicoes-pendentes';
const TABELA = 'pendencias';
const VERSAO = 1;

function chave({ workspace_id, id }: Pick<Identidade, 'workspace_id' | 'id'>) {
  return JSON.stringify([workspace_id, id]);
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('O navegador não oferece armazenamento persistente.'));
      return;
    }
    const req = indexedDB.open(BANCO, VERSAO);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(TABELA)) req.result.createObjectStore(TABELA);
    };
    req.onsuccess = () => {
      const banco = req.result;
      banco.onversionchange = () => banco.close();
      resolve(banco);
    };
    req.onerror = () => reject(req.error ?? new Error('Falha ao abrir as edições locais.'));
    req.onblocked = () => reject(new Error('Armazenamento local bloqueado por outra aba.'));
  });
}

function registroValido(r: unknown): r is Registro {
  if (!r || typeof r !== 'object') return false;
  const x = r as Partial<Registro>;
  return typeof x.colecao === 'string' && x.colecao.length > 0 &&
    typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 160 &&
    typeof x.ordem === 'number' && Number.isSafeInteger(x.ordem) && x.ordem >= 0 &&
    typeof x.versao === 'number' && Number.isSafeInteger(x.versao) && x.versao >= 0 &&
    Object.prototype.hasOwnProperty.call(x, 'conteudo');
}

export async function lerEdicoesLocais(perfil: Pick<Identidade, 'workspace_id' | 'id'>): Promise<Registro[]> {
  const banco = await abrir();
  try {
    return await new Promise<Registro[]>((resolve, reject) => {
      const tx = banco.transaction(TABELA, 'readonly');
      const pedido = tx.objectStore(TABELA).get(chave(perfil));
      tx.oncomplete = () => {
        const salvo = pedido.result as { versao?: number; registros?: unknown } | undefined;
        if (!salvo) { resolve([]); return; }
        if (salvo.versao !== VERSAO || !Array.isArray(salvo.registros) ||
            salvo.registros.length > 10000 || !salvo.registros.every(registroValido)) {
          reject(new Error('As edições locais não puderam ser interpretadas; não foram apagadas.'));
          return;
        }
        resolve(salvo.registros);
      };
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao ler as edições locais.'));
      tx.onabort = () => reject(tx.error ?? new Error('Leitura das edições locais interrompida.'));
    });
  } finally {
    banco.close();
  }
}

export async function gravarEdicoesLocais(
  perfil: Pick<Identidade, 'workspace_id' | 'id'>,
  registros: Registro[]
): Promise<void> {
  const banco = await abrir();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = banco.transaction(TABELA, 'readwrite');
      const store = tx.objectStore(TABELA);
      if (registros.length) {
        store.put({ versao: VERSAO, registros, atualizadoEm: new Date().toISOString() }, chave(perfil));
      } else {
        store.delete(chave(perfil));
      }
      // Confirma somente após o COMMIT completo da transação IndexedDB.
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao proteger edições locais.'));
      tx.onabort = () => reject(tx.error ?? new Error('Gravação das edições locais interrompida.'));
    });
  } finally {
    banco.close();
  }
}
