// ============================================
// CÁLCULOS DA META MENSAL
// ============================================
// Meta diária = quanto falta ÷ dias de trabalho que restam no mês (contando hoje).
// "Realizado" = soma das vendas ganhas do mês (vindas do CRM).
// ============================================

import { dataLocal, mesChave, type DiasTrabalho, type Venda } from './dados-exemplo';

export const NOMES_DIAS_TRABALHO: Record<DiasTrabalho, string> = {
  'seg-sex': 'Segunda a sexta',
  'seg-sab': 'Segunda a sábado',
  todos: 'Todos os dias',
};

function ehDiaDeTrabalho(d: Date, regra: DiasTrabalho): boolean {
  const dia = d.getDay(); // 0 domingo … 6 sábado
  if (regra === 'todos') return true;
  if (regra === 'seg-sab') return dia !== 0;
  return dia !== 0 && dia !== 6;
}

/** Dias de trabalho de `inicio` (inclusive) até o fim do mês de `inicio`. */
export function diasDeTrabalhoRestantes(inicio: Date, regra: DiasTrabalho): number {
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const mes = d.getMonth();
  let n = 0;
  while (d.getMonth() === mes) {
    if (ehDiaDeTrabalho(d, regra)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export type ResumoMeta = {
  mes: string; // AAAA-MM
  meta: number | null;
  realizado: number;
  falta: number;
  percentual: number; // 0–100+ (arredondado)
  vendas: number;
  ticketMedio: number;
  metaDiaria: number | null;
  diasRestantes: number;
  realizadoHoje: number;
  /** Comparação "realizado hoje" com a meta diária, em % (ex.: +67) */
  variacaoHoje: number | null;
  /** Variações em relação ao mês anterior (null sem dados) */
  variacaoVendas: number | null;
  variacaoTicket: number | null;
  /** Realizado acumulado ao fim de cada semana (1–7, 8–14, 15–21, 22–28, 29+) */
  semanas: Array<{ rotulo: string; acumulado: number | null }>;
  situacao: 'sem-meta' | 'batida' | 'no-ritmo' | 'abaixo';
  mesAtual: boolean;
};

function somar(vendas: Venda[]): number {
  return vendas.reduce((s, v) => s + v.valor, 0);
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return mesChave(new Date(a, m - 2, 1));
}

function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return Math.round((atual / anterior - 1) * 100);
}

export function calcularResumoMeta(
  mes: string,
  todasVendas: Venda[],
  metas: Record<string, number>,
  regra: DiasTrabalho,
  agora: Date = new Date()
): ResumoMeta {
  const [ano, mesNum] = mes.split('-').map(Number);
  const doMes = todasVendas.filter((v) => v.data.startsWith(mes));
  const anteriores = todasVendas.filter((v) => v.data.startsWith(mesAnterior(mes)));

  const meta = metas[mes] ?? null;
  const realizado = somar(doMes);
  const falta = meta == null ? 0 : Math.max(0, meta - realizado);
  const percentual = meta ? Math.round((realizado / meta) * 100) : 0;
  const ticketMedio = doMes.length ? realizado / doMes.length : 0;
  const ticketAnterior = anteriores.length ? somar(anteriores) / anteriores.length : 0;

  const mesAtual = mes === mesChave(agora);
  const fimDoMes = new Date(ano, mesNum, 0);
  const passado = new Date(ano, mesNum - 1, 1) < new Date(agora.getFullYear(), agora.getMonth(), 1);
  // Mês futuro conta do dia 1; mês atual conta de hoje; mês passado não tem dias restantes.
  const inicioContagem = mesAtual ? agora : new Date(ano, mesNum - 1, 1);
  const diasRestantes = passado ? 0 : diasDeTrabalhoRestantes(inicioContagem, regra);
  const metaDiaria = meta == null || passado ? null : diasRestantes > 0 ? falta / diasRestantes : falta;

  const hojeTexto = dataLocal(agora);
  const realizadoHoje = mesAtual ? somar(doMes.filter((v) => v.data === hojeTexto)) : 0;
  const variacaoHoje =
    mesAtual && metaDiaria && metaDiaria > 0 ? Math.round((realizadoHoje / metaDiaria - 1) * 100) : null;

  // Semanas do mês (acumulado). Semanas futuras ficam vazias.
  const limites = [7, 14, 21, 28, fimDoMes.getDate()];
  const diaHoje = mesAtual ? agora.getDate() : passado ? fimDoMes.getDate() : 0;
  const semanas = limites
    .filter((lim, i) => i < 4 || lim > 28)
    .map((lim, i) => {
      const inicioSemana = i * 7 + 1;
      const acumulado = somar(doMes.filter((v) => Number(v.data.slice(8, 10)) <= lim));
      return { rotulo: `Sem. ${i + 1}`, acumulado: inicioSemana <= diaHoje ? acumulado : null };
    });

  let situacao: ResumoMeta['situacao'] = 'sem-meta';
  if (meta != null) {
    if (realizado >= meta) situacao = 'batida';
    else {
      // Ritmo: projeção do realizado até o fim do mês, pelos dias de trabalho já passados.
      const totalDias = diasDeTrabalhoRestantes(new Date(ano, mesNum - 1, 1), regra);
      const passados = totalDias - diasRestantes;
      const esperado = totalDias ? (meta * passados) / totalDias : 0;
      situacao = realizado >= esperado ? 'no-ritmo' : 'abaixo';
    }
  }

  return {
    mes,
    meta,
    realizado,
    falta,
    percentual,
    vendas: doMes.length,
    ticketMedio,
    metaDiaria,
    diasRestantes,
    realizadoHoje,
    variacaoHoje,
    variacaoVendas: variacao(doMes.length, anteriores.length),
    variacaoTicket: variacao(ticketMedio, ticketAnterior),
    semanas,
    situacao,
    mesAtual,
  };
}

export function reaisCentavos(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export function nomeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} / ${a}`;
}
