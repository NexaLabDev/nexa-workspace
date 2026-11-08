// ============================================
// AGENDADOR DE AVISOS DE VENCIMENTO
// ============================================
// Roda dentro do servidor do Workspace (a cada 15 minutos):
//  1) atualiza a central de notificações (notificacoes.ts) a partir das cobranças;
//  2) envia push das notificações ativas para os navegadores inscritos.
// O push de cada notificação sai uma vez por navegador (registro em .dados),
// mesmo se o servidor reiniciar. Cobrança paga = notificação resolvida = sem push.
// Push só entre 8h e 21h; a central é atualizada a qualquer hora.
// ============================================

import { createHash } from 'node:crypto';
import { alterarBanco, lerBanco, type InscricaoPush } from './armazem';
import { enviarPush, pushConfigurado, type AvisoPush } from './push';
import { atualizarNotificacoes, type Notificacao } from './notificacoes';
import { dataBr, diasAte, dinheiro } from '../../components/nexa/financeiro';
import { dataLocal } from '../../components/nexa/dados-exemplo';

const INTERVALO_MS = 15 * 60 * 1000;
const HORA_INICIO = 8;
const HORA_FIM = 21;
/** Vencidas há mais tempo que isso não geram push (continuam na central e em Recebimentos) */
const LIMITE_VENCIDA_DIAS = 30;
/** Acima disso, o navegador recebe um resumo em vez de vários avisos seguidos */
const MAX_AVISOS_SEPARADOS = 3;

const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

function recebe(insc: InscricaoPush, n: Notificacao): boolean {
  if (!insc.filtro) return true;
  return !!n.responsavel && normalizar(n.responsavel) === normalizar(insc.filtro);
}

const idNavegador = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 16);

export function textoQuando(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`;
}

function textoAviso(n: Notificacao, dias: number): AvisoPush {
  return {
    titulo: `${n.rotulo} ${textoQuando(dias)}`,
    corpo: `${n.cliente} · ${dinheiro(n.valor)} · vencimento ${dataBr(n.vencimento)}`,
    url: `/conversas?lead=${encodeURIComponent(n.leadId)}`,
    tag: n.chave,
  };
}

export type ResultadoVerificacao = {
  verificado: boolean;
  motivo?: string;
  enviados: number;
  falhas: number;
  removidas: number;
  /** Notificações ativas na central depois da verificação */
  ativas: number;
};

export async function verificarVencimentos(agora = new Date(), ignorarHorario = false): Promise<ResultadoVerificacao> {
  const r: ResultadoVerificacao = { verificado: false, enviados: 0, falhas: 0, removidas: 0, ativas: 0 };
  if (!lerBanco().leads) return { ...r, motivo: 'O navegador ainda não enviou os leads ao servidor' };

  // 1) Central de notificações (sempre)
  let ativas: Notificacao[] = [];
  alterarBanco((b) => {
    ativas = atualizarNotificacoes(b, agora);
    b.ultimaVerificacao = agora.toISOString();
  });
  r.ativas = ativas.length;

  // 2) Push
  if (!pushConfigurado()) return { ...r, verificado: true, motivo: 'Central atualizada; push sem chaves VAPID no .env.local' };
  const hora = agora.getHours();
  if (!ignorarHorario && (hora < HORA_INICIO || hora >= HORA_FIM)) return { ...r, verificado: true, motivo: 'Central atualizada; push só das 8h às 21h' };
  const banco = lerBanco();
  if (!banco.inscricoes.length) return { ...r, verificado: true, motivo: 'Central atualizada; nenhum navegador com push ativado' };

  const hoje = dataLocal(agora);
  const candidatas = ativas
    .map((n) => ({ n, dias: diasAte(n.vencimento, hoje) }))
    .filter((x) => x.dias >= -LIMITE_VENCIDA_DIAS)
    .sort((a, b) => a.dias - b.dias);

  const enviadosAgora: Record<string, string> = {};
  const expiradas = new Set<string>();

  for (const insc of banco.inscricoes) {
    const nav = idNavegador(insc.endpoint);
    const fila = candidatas
      .filter((x) => recebe(insc, x.n))
      .map((x) => ({ ...x, chave: `${x.n.id}|${nav}` }))
      .filter((x) => !banco.enviados[x.chave]);
    if (!fila.length) continue;

    const avisos: AvisoPush[] =
      fila.length > MAX_AVISOS_SEPARADOS
        ? [
            {
              titulo: `${fila.length} cobranças precisam de atenção`,
              corpo: fila
                .slice(0, 3)
                .map((x) => `${x.n.cliente}: ${x.n.rotulo}`)
                .join(' · ')
                .concat(fila.length > 3 ? ' · …' : ''),
              url: '/recebimentos',
              tag: `resumo-${hoje}`,
            },
          ]
        : fila.map((x) => textoAviso(x.n, x.dias));

    let ok = true;
    for (const aviso of avisos) {
      const res = await enviarPush(insc, aviso);
      if (res === 'expirada') {
        expiradas.add(insc.endpoint);
        ok = false;
        break;
      }
      if (res === 'erro') {
        r.falhas += 1;
        ok = false;
        break;
      }
      r.enviados += 1;
    }
    // Só marca como avisado o que chegou ao serviço de push (falha tenta de novo na próxima volta)
    if (ok) fila.forEach((x) => (enviadosAgora[x.chave] = agora.toISOString()));
  }

  const corte = new Date(agora.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();
  alterarBanco((b) => {
    Object.assign(b.enviados, enviadosAgora);
    for (const [k, em] of Object.entries(b.enviados)) if (em < corte) delete b.enviados[k];
    if (expiradas.size) b.inscricoes = b.inscricoes.filter((i) => !expiradas.has(i.endpoint));
  });
  r.removidas = expiradas.size;
  r.verificado = true;
  return r;
}

/** Liga o agendador uma única vez por processo (o modo dev recarrega módulos). */
export function iniciarAgendador() {
  const g = globalThis as typeof globalThis & { __nexaAgendador?: NodeJS.Timeout };
  if (g.__nexaAgendador) return;
  const rodar = () =>
    verificarVencimentos().catch((e) => console.error('[agendador] erro na verificação:', (e as Error).message));
  setTimeout(rodar, 20_000);
  g.__nexaAgendador = setInterval(rodar, INTERVALO_MS);
  console.log('[agendador] central de notificações e push ativos (verifica a cada 15 min; push das 8h às 21h)');
}
