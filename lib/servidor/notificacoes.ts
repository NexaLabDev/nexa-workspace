// ============================================
// CENTRAL DE NOTIFICAÇÕES (gerada no servidor)
// ============================================
// A partir das cobranças (parcelas e mensalidades), o servidor cria notificações
// conforme a configuração: X dias antes, no dia e depois de vencida.
// - Cada notificação tem id = cobrança + vencimento + marco: nunca é criada duas vezes.
// - Quando a cobrança é paga, muda de data ou some, a notificação é resolvida
//   (sai da central e não gera mais push).
// - Uma notificação nova da mesma cobrança (ex.: "vence hoje") substitui a anterior.
// Não depende de a página estar aberta: roda no agendador e sempre que os leads chegam.
// ============================================

import type { Banco } from './armazem';
import { cobrancasDoLead, diasAte } from '../../components/nexa/financeiro';
import { dataLocal } from '../../components/nexa/dados-exemplo';

export type ConfigAvisos = {
  /** Dias de antecedência (ex.: [3, 1]) */
  diasAntes: number[];
  noDia: boolean;
  vencidas: boolean;
};

export const CONFIG_PADRAO: ConfigAvisos = { diasAntes: [3], noDia: true, vencidas: true };
export const OPCOES_DIAS_ANTES = [1, 2, 3, 5, 7, 10, 15];

export type Notificacao = {
  id: string;
  chave: string;
  leadId: string;
  cliente: string;
  responsavel?: string;
  rotulo: string;
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  /** antes-N | hoje | vencida */
  marco: string;
  criadaEm: string;
  lida?: boolean;
  resolvidaEm?: string;
};

export function configValida(x: unknown): ConfigAvisos | null {
  if (!x || typeof x !== 'object') return null;
  const c = x as Record<string, unknown>;
  if (!Array.isArray(c.diasAntes) || typeof c.noDia !== 'boolean' || typeof c.vencidas !== 'boolean') return null;
  const dias = Array.from(new Set(c.diasAntes.filter((d): d is number => typeof d === 'number' && OPCOES_DIAS_ANTES.includes(d)))).sort((a, b) => b - a);
  return { diasAntes: dias, noDia: c.noDia, vencidas: c.vencidas };
}

export const configDe = (b: Banco): ConfigAvisos => b.configAvisos ?? CONFIG_PADRAO;

/** Marco que vale para uma cobrança a `dias` do vencimento (o aviso "mais próximo" ainda não passado). */
export function marcoPara(dias: number, cfg: ConfigAvisos): string | null {
  if (dias > 0) {
    const n = [...cfg.diasAntes].sort((a, b) => a - b).find((x) => x >= dias);
    return n ? `antes-${n}` : null;
  }
  if (dias === 0) return cfg.noDia ? 'hoje' : null;
  return cfg.vencidas ? 'vencida' : null;
}

/** Atualiza b.notificacoes (altera o objeto recebido). Devolve as ativas. */
export function atualizarNotificacoes(b: Banco, agora = new Date()): Notificacao[] {
  const lista = b.notificacoes ?? [];
  if (!b.leads) {
    b.notificacoes = lista;
    return lista.filter((n) => !n.resolvidaEm);
  }
  const cfg = configDe(b);
  const hoje = dataLocal(agora);
  const iso = agora.toISOString();
  const validas = new Map<string, Notificacao>();

  for (const c of b.leads.flatMap((l) => cobrancasDoLead(l, hoje))) {
    if (c.pago || !c.vencimento) continue;
    const marco = marcoPara(diasAte(c.vencimento, hoje), cfg);
    if (!marco) continue;
    const id = `${c.chave}|${c.vencimento}|${marco}`;
    validas.set(id, {
      id,
      chave: c.chave,
      leadId: c.leadId,
      cliente: c.cliente,
      responsavel: c.responsavel,
      rotulo: c.rotulo,
      valor: c.valor,
      vencimento: c.vencimento,
      marco,
      criadaEm: iso,
    });
  }

  // existentes: atualiza dados, resolve o que deixou de valer
  const porId = new Map(lista.map((n) => [n.id, n]));
  for (const n of lista) {
    const atual = validas.get(n.id);
    if (atual) {
      // continua valendo (ou voltou a valer, ex.: pagamento desmarcado por engano)
      Object.assign(n, { cliente: atual.cliente, responsavel: atual.responsavel, rotulo: atual.rotulo, valor: atual.valor });
      delete n.resolvidaEm;
    } else if (!n.resolvidaEm) {
      n.resolvidaEm = iso;
    }
  }
  // novas: uma só por id (o push também não se repete, ver agendador)
  for (const [id, n] of validas) if (!porId.has(id)) lista.push(n);

  // limpa resolvidas antigas (60 dias)
  const corte = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  b.notificacoes = lista.filter((n) => !n.resolvidaEm || n.resolvidaEm > corte);
  return b.notificacoes.filter((n) => !n.resolvidaEm);
}
