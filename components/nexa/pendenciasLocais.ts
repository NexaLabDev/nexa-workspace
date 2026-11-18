'use client';

// Diário local das alterações que ainda NÃO foram confirmadas pelo Supabase.
// Guarda somente edições pendentes, por usuário + workspace. Não guarda tokens.
// IndexedDB persiste após recarregar/fechar a aba (diferente de memória).
// Os dados são privados e ficam no dispositivo: não usar em computadores públicos.
import type { Identidade, Registro } from './remoto';

const BANCO = 'nexa-workspace-edicoes-pendentes';
const TABELA = 'pendencias';
const VERSAO = 1;

// Cada aba acompanha quais registros alterou. Uma aba não apaga pendências
// distintas deixadas por outra janela do mesmo usuário e workspace.
const fotografias = new Map<string, Registro[]>();
const identidadeRegistro = (r: Registro) => JSON.stringify([r.colecao, r.id]);
const igualRegistro = (a: Registro | undefined, b: Registro | undefined) =>
  a === b || (!!a && !!b && JSON.stringify(a) === JSON.stringify(b));

function conferirRegistros(registros: unknown): asserts registros is Registro[] {
  if (!Array.isArray(registros) || registros.length > 10000 || !registros.every(registroValido)) {
    throw new Error('As edições locais não puderam ser interpretadas; não foram apagadas.');
  }
  const ids = new Set(registros.map(identidadeRegistro));
  if (ids.size !== registros.length) {
    throw new Error('Diário local com registros duplicados; nenhuma edição foi apagada.');
  }
}

function registrosDoDiario(salvo: unknown): Registro[] {
  if (!salvo) return [];
  const s = salvo as { versao?: number; registros?: unknown };
  if (s.versao !== VERSAO) {
    throw new Error('Diário local de formato desconhecido; nenhuma edição foi apagada.');
  }
  conferirRegistros(s.registros);
  return s.registros;
}

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
  const id = chave(perfil);
  try {
    const resultado = await new Promise<Registro[]>((resolve, reject) => {
      const tx = banco.transaction(TABELA, 'readonly');
      const pedido = tx.objectStore(TABELA).get(id);
      tx.oncomplete = () => {
        try { resolve(registrosDoDiario(pedido.result)); }
        catch (erro) { reject(erro); }
      };
      tx.onerror = () => reject(tx.error ?? new Error('Falha ao ler as edições locais.'));
      tx.onabort = () => reject(tx.error ?? new Error('Leitura das edições locais interrompida.'));
    });
    fotografias.set(id, [...resultado]);
    return resultado;
  } finally {
    banco.close();
  }
}

export async function gravarEdicoesLocais(
  perfil: Pick<Identidade, 'workspace_id' | 'id'>,
  registros: Registro[]
): Promise<void> {
  conferirRegistros(registros);
  const id = chave(perfil);
  const anterior = new Map((fotografias.get(id) ?? []).map((r) => [identidadeRegistro(r), r]));
  const desejado = new Map(registros.map((r) => [identidadeRegistro(r), r]));
  const banco = await abrir();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = banco.transaction(TABELA, 'readwrite');
      const store = tx.objectStore(TABELA);
      const pedido = store.get(id);
      let falha: unknown = null;
      pedido.onsuccess = () => {
        try {
          const existente = registrosDoDiario(pedido.result);
          const combinado = new Map(existente.map((r) => [identidadeRegistro(r), r]));
          // Remove só o que ESTA aba havia mantido e agora confirmou ou descartou.
          // Se outra aba mudou o registro desde a nossa última leitura, preserva.
          for (const [k, antigo] of anterior) {
            if (!desejado.has(k) && igualRegistro(combinado.get(k), antigo)) combinado.delete(k);
          }
          for (const [k, novo] of desejado) {
            const atual = combinado.get(k);
            const vistoAntes = anterior.get(k);
            // Outra aba gravou o MESMO registro depois da nossa última leitura:
            // não substitui silenciosamente a edição mais recente no diário.
            if (atual && !igualRegistro(atual, novo) &&
                !igualRegistro(atual, vistoAntes)) {
              throw new Error('Conflito local: outra aba alterou o mesmo registro. Exporte sua edição antes de resolver.');
            }
            combinado.set(k, novo);
          }
          if (combinado.size > 10000) throw new Error('O diário local excedeu o limite de registros.');
          if (combinado.size) {
            store.put({
              versao: VERSAO,
              registros: [...combinado.values()],
              atualizadoEm: new Date().toISOString(),
            }, id);
          } else {
            store.delete(id);
          }
        } catch (erro) {
          falha = erro;
          tx.abort();
        }
      };
      pedido.onerror = () => {
        falha = pedido.error;
      };
      tx.oncomplete = () => {
        // Salva a fotografia DESTA aba, não a junção com alterações de outras abas.
        // Assim confirmar um lote não apaga pendências de outra janela.
        fotografias.set(id, [...registros]);
        resolve();
      };
      tx.onerror = () => reject(falha ?? tx.error ?? new Error('Falha ao proteger edições locais.'));
      tx.onabort = () => reject(falha ?? tx.error ?? new Error('Gravação das edições locais interrompida.'));
    });
  } finally {
    banco.close();
  }
}
