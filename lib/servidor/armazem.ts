// ============================================
// ARMAZÉM DO SERVIDOR (roda só no Node, neste computador)
// ============================================
// Um arquivo JSON em .dados/workspace.json guarda:
//  - uma cópia dos leads (enviada pelo navegador), para o agendador saber os vencimentos;
//  - as inscrições de push (cada navegador que ativou os avisos);
//  - o registro do que já foi avisado (para não repetir notificação).
// O navegador continua sendo a fonte principal dos dados; aqui é um espelho.
// A pasta .dados fica fora do Git (.gitignore) porque tem dados de clientes.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import type { Lead } from '../../components/nexa/dados-exemplo';
import type { RetratoPublico } from '../../components/nexa/acompanhamento';
import type { ConfigAvisos, Notificacao } from './notificacoes';

const PASTA = path.join(process.cwd(), '.dados');
const ARQUIVO = path.join(PASTA, 'workspace.json');

export type InscricaoPush = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Responsável cujos leads geram aviso; null = todos os leads */
  filtro: string | null;
  criadaEm: string;
};

export type Banco = {
  versao: 1;
  leads: Lead[] | null;
  leadsAtualizadoEm?: string;
  inscricoes: InscricaoPush[];
  /** chave do aviso → data/hora em que foi enviado */
  enviados: Record<string, string>;
  ultimaVerificacao?: string;
  /** Versão pública dos projetos com link de acompanhamento (código → dados visíveis ao cliente) */
  acompanhamentos?: Record<string, RetratoPublico>;
  /** Quando avisar (dias antes, no dia, vencidas) */
  configAvisos?: ConfigAvisos;
  /** Central de notificações (geradas pelo servidor) */
  notificacoes?: Notificacao[];
};

const VAZIO: Banco = { versao: 1, leads: null, inscricoes: [], enviados: {} };

/** Lê sempre do disco: o arquivo é pequeno e assim rotas e agendador nunca ficam dessincronizados. */
export function lerBanco(): Banco {
  try {
    const b = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')) as Partial<Banco>;
    return { ...VAZIO, ...b, inscricoes: b.inscricoes ?? [], enviados: b.enviados ?? {} };
  } catch {
    return { ...VAZIO, inscricoes: [], enviados: {} };
  }
}

/** Altera e grava de uma vez (escrita em arquivo temporário + troca, para não corromper). */
export function alterarBanco(fn: (b: Banco) => void): Banco {
  const b = lerBanco();
  fn(b);
  fs.mkdirSync(PASTA, { recursive: true });
  const texto = JSON.stringify(b);
  const tmp = `${ARQUIVO}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, texto);
    fs.renameSync(tmp, ARQUIVO);
  } catch {
    // Windows às vezes trava a troca (antivírus/indexador): grava direto
    fs.writeFileSync(ARQUIVO, texto);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* já não existe */
    }
  }
  return b;
}
