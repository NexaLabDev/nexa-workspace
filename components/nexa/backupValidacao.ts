'use client';

// Valida backups ANTES de qualquer upload/importação.
// Não acessa rede nem armazenamento: os testes usam este módulo puro.
export const FORMATO_BACKUP = 'nexa-workspace-backup' as const;
export const LIMITE_ANEXO_BACKUP = 25 * 1024 * 1024;
export const LIMITE_TOTAL_ANEXOS = 50 * 1024 * 1024;
export const LIMITE_JSON_BACKUP = 85 * 1024 * 1024;

export type ArquivoBackup = { id: string; tipo: string; nome?: string; base64: string; sha256?: string };
export type Backup = {
  formato: typeof FORMATO_BACKUP;
  versao: 1;
  criadoEm: string;
  dados: Record<string, unknown>;
  arquivos: ArquivoBackup[];
};

const LISTAS = new Set([
  'leads', 'clientes', 'vendas', 'projetos', 'documentos', 'conversas',
  'servicos', 'categorias-arquivos',
]);
const UNITARIOS = new Set([
  'metas', 'prestadora', 'preferencias', 'avisos', 'perfil',
]);
const ID_VALIDO = /^[A-Za-z0-9_-]{1,160}$/;
const BASE64_VALIDO = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function objeto(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function anexosReferenciados(valor: unknown, ids: Set<string>, profundidade = 0) {
  if (profundidade > 40) throw Error('Backup inválido: dados excessivamente aninhados.');
  if (Array.isArray(valor)) {
    for (const item of valor) anexosReferenciados(item, ids, profundidade + 1);
  } else if (objeto(valor)) {
    for (const [k, v] of Object.entries(valor)) {
      if (k === 'arquivoId' && typeof v === 'string') {
        if (!ID_VALIDO.test(v)) throw Error('Backup inválido: identificador de anexo incorreto.');
        ids.add(v);
      } else if (v && typeof v === 'object') anexosReferenciados(v, ids, profundidade + 1);
    }
  }
}

export function validarBackup(valor: unknown): Backup {
  if (!objeto(valor) || valor.formato !== FORMATO_BACKUP || valor.versao !== 1 ||
      !objeto(valor.dados) || !Array.isArray(valor.arquivos) ||
      typeof valor.criadoEm !== 'string' || !Number.isFinite(Date.parse(valor.criadoEm))) {
    throw Error('O arquivo não é um backup válido do Nexa Workspace.');
  }

  const dados = valor.dados;
  for (const [colecao, registros] of Object.entries(dados)) {
    if (LISTAS.has(colecao)) {
      if (!Array.isArray(registros) || registros.length > 10000) {
        throw Error('Backup inválido: lista de ' + colecao + ' incorreta.');
      }
      const vistos = new Set<string>();
      for (const registro of registros) {
        if (!objeto(registro) || typeof registro.id !== 'string' ||
            !registro.id.length || registro.id.length > 160 || vistos.has(registro.id)) {
          throw Error('Backup inválido: registro repetido ou sem ID em ' + colecao + '.');
        }
        vistos.add(registro.id);
      }
    } else if (UNITARIOS.has(colecao)) {
      if (!objeto(registros)) throw Error('Backup inválido: configuração incorreta em ' + colecao + '.');
    } else if (colecao === 'dias-trabalho') {
      if (!['seg-sex', 'seg-sab', 'todos'].includes(String(registros))) {
        throw Error('Backup inválido: dias de trabalho desconhecidos.');
      }
    } else {
      throw Error('Backup contém uma coleção não reconhecida: ' + colecao + '.');
    }
  }

  const anexos = new Set<string>();
  let total = 0;
  for (const arquivo of valor.arquivos) {
    if (!objeto(arquivo) || typeof arquivo.id !== 'string' ||
        !ID_VALIDO.test(arquivo.id) || anexos.has(arquivo.id) ||
        typeof arquivo.tipo !== 'string' || arquivo.tipo.length > 160 ||
        (arquivo.nome !== undefined && (typeof arquivo.nome !== 'string' || arquivo.nome.length > 255)) ||
        typeof arquivo.base64 !== 'string' || !BASE64_VALIDO.test(arquivo.base64) ||
        (arquivo.sha256 !== undefined && (typeof arquivo.sha256 !== 'string' ||
          !/^[a-f0-9]{64}$/.test(arquivo.sha256)))) {
      throw Error('Backup inválido: anexo duplicado, incompleto ou com conteúdo corrompido.');
    }
    anexos.add(arquivo.id);
    const bytes = arquivo.base64.length / 4 * 3 -
      (arquivo.base64.endsWith('==') ? 2 : arquivo.base64.endsWith('=') ? 1 : 0);
    if (bytes > LIMITE_ANEXO_BACKUP) throw Error('Backup contém anexo acima de 25 MB.');
    total += bytes;
    if (total > LIMITE_TOTAL_ANEXOS) throw Error('Backup excede 50 MB de anexos.');
  }

  const referenciados = new Set<string>();
  anexosReferenciados(dados, referenciados);
  for (const id of referenciados) {
    if (!anexos.has(id)) throw Error('Backup incompleto: falta o anexo ' + id + '.');
  }
  return valor as Backup;
}

/** Backups antigos não têm SHA; os novos verificam integridade antes de importar. */
export async function verificarHashesBackup(b: Backup): Promise<void> {
  for (const arquivo of b.arquivos) {
    if (!arquivo.sha256) continue;
    const bin = atob(arquivo.base64);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    if (hex !== arquivo.sha256) {
      throw Error('Backup corrompido: a verificação do anexo ' + arquivo.id + ' falhou.');
    }
  }
}
