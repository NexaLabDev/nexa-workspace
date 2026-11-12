// ============================================
// FINANCEIRO DO LEAD (pagamento do projeto + mensalidade recorrente)
// ============================================
// Regras únicas, usadas pela tela, pelo calendário de recebimentos, pelo sininho
// e pelo agendador de notificações no servidor. Não depende do navegador.
//
// Para não contar nada duas vezes:
// - "Vendido" (Meta de vendas) = valor do projeto, contado na venda ganha.
// - "Recebido" (Recebimentos) = dinheiro que entrou, pela data do pagamento.
// - Mensalidade = receita recorrente, separada do projeto.
// ============================================

import {
  dataLocal,
  ETAPA_PERDIDO,
  type Comprovante,
  type FaixaMensalidade,
  type FormaPagamento,
  type Lead,
  type MensalidadeLead,
  type PagamentoLead,
  type PagamentoLegado,
  type ParcelaContrato,
  type RegistroMensalidade,
} from './dados-exemplo';

export const FORMAS_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: 'Pix',
  cartao: 'Cartão de crédito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  outro: 'Outro',
};

// ---------- utilidades ----------
export function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBr(iso?: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function hojeIso(): string {
  return dataLocal(new Date());
}

/** Soma meses mantendo o dia (31/01 + 1 mês = último dia de fevereiro). */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return dataLocal(alvo);
}

/** Divide em partes iguais em centavos; a sobra vai para a 1ª. */
export function dividir(total: number, n: number): number[] {
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const sobra = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? sobra : 0)) / 100);
}

export function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Dias corridos de `hoje` até `data` (negativo = já passou). */
export function diasAte(data: string, hoje = hojeIso()): number {
  const [a1, m1, d1] = hoje.split('-').map(Number);
  const [a2, m2, d2] = data.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function textoDias(n: number): string {
  if (n === 0) return 'vence hoje';
  if (n === 1) return 'vence amanhã';
  if (n > 1) return `vence em ${n} dias`;
  if (n === -1) return 'venceu ontem';
  return `venceu há ${-n} dias`;
}

// ---------- conversão do formato antigo ----------
function ehNovo(p: PagamentoLead | PagamentoLegado): p is PagamentoLead {
  return (p as PagamentoLead).versao === 2;
}

/**
 * Lê o pagamento em qualquer formato. O antigo é convertido sem perder dados:
 * - "entrada": vira entrada + parcelas, com pagas e comprovantes;
 * - "à vista", "link" e "parcelado": viram à vista (o link fica na observação).
 */
export function normalizarPagamento(raw?: PagamentoLead | PagamentoLegado): PagamentoLead | undefined {
  if (!raw) return undefined;
  if (ehNovo(raw)) return raw;
  const itens = raw.itens ?? [];
  if (raw.condicao === 'entrada') {
    const ent = itens.find((i) => i.rotulo === 'Entrada');
    const parcelas: ParcelaContrato[] = itens
      .filter((i) => i.rotulo !== 'Entrada')
      .map((i, n) => ({
        id: i.id,
        numero: n + 1,
        valor: i.valor,
        vencimento: i.vencimento,
        pago: i.pago,
        pagoEm: i.pago ? i.pagoEm ?? i.vencimento : undefined,
        comprovante: i.comprovante,
      }));
    return {
      versao: 2,
      modalidade: 'entrada',
      entrada: {
        valor: ent?.valor ?? raw.entrada ?? null,
        forma: raw.forma,
        pagoEm: ent?.pago ? ent.pagoEm ?? ent.vencimento : undefined,
        comprovante: ent?.comprovante,
      },
      qtdParcelas: parcelas.length || raw.parcelas,
      formaParcelas: raw.forma,
      primeiroVencimento: parcelas[0]?.vencimento,
      parcelas,
    };
  }
  const unico = itens[0];
  const porLink = raw.condicao !== 'avista';
  return {
    versao: 2,
    modalidade: 'avista',
    forma: porLink ? 'cartao' : raw.forma,
    valor: unico?.valor ?? raw.total ?? null,
    pagoEm: unico?.pago ? unico.pagoEm ?? unico.vencimento : undefined,
    comprovante: unico?.comprovante,
    observacao: porLink ? (raw.link ? `Pago por link de pagamento: ${raw.link}` : 'Pago por link de pagamento') : undefined,
  };
}

// ---------- entrada + parcelas ----------
/** Remonta as parcelas não pagas (quantidade, valores iguais e datas mensais). As pagas ficam como estão. */
export function montarParcelas(qtd: number, restante: number, primeiroVencimento: string, anteriores: ParcelaContrato[] = []): ParcelaContrato[] {
  const n = Math.max(1, Math.min(48, Math.round(qtd)));
  const pagas = anteriores.filter((p) => p.pago && p.numero <= n);
  const jaPago = pagas.reduce((s, p) => s + p.valor, 0);
  const abertas = Array.from({ length: n }, (_, i) => i + 1).filter((num) => !pagas.some((p) => p.numero === num));
  const valores = abertas.length ? dividir(Math.max(0, restante - jaPago), abertas.length) : [];
  return Array.from({ length: n }, (_, i) => {
    const numero = i + 1;
    const paga = pagas.find((p) => p.numero === numero);
    if (paga) return paga;
    const antes = anteriores.find((p) => p.numero === numero);
    return {
      id: antes?.id ?? `parc-${Date.now()}-${numero}`,
      numero,
      valor: valores[abertas.indexOf(numero)],
      vencimento: somarMeses(primeiroVencimento, i),
      pago: false,
      comprovante: antes?.comprovante,
    };
  });
}

/** Valor somado do pagamento do projeto (à vista ou entrada + parcelas). */
export function totalPagamento(pg?: PagamentoLead): number {
  if (!pg) return 0;
  if (pg.modalidade === 'avista') return arredondar(pg.valor ?? 0);
  return arredondar((pg.entrada?.valor ?? 0) + (pg.parcelas ?? []).reduce((s, p) => s + p.valor, 0));
}

/** Diferença entre o pagamento e o valor negociado (0 = bate). null quando não há o que comparar. */
export function diferencaPagamento(pg: PagamentoLead | undefined, valorNegociado: number | null): number | null {
  if (!pg || valorNegociado == null) return null;
  if (pg.modalidade === 'avista' && pg.valor == null) return null;
  if (pg.modalidade === 'entrada' && !(pg.parcelas ?? []).length && pg.entrada?.valor == null) return null;
  return arredondar(totalPagamento(pg) - valorNegociado);
}

// ---------- mensalidade recorrente ----------
function vencimentoDoMes(competencia: string, dia: number): string {
  const [a, m] = competencia.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return `${competencia}-${String(Math.min(Math.max(1, dia), ultimo)).padStart(2, '0')}`;
}

function proximaCompetencia(c: string): string {
  return somarMeses(`${c}-01`, 1).slice(0, 7);
}

export type CicloMensalidade = {
  competencia: string;
  vencimento: string;
  valor: number;
  pago: boolean;
  pagoEm?: string;
  comprovante?: Comprovante;
};

/**
 * Ciclos da mensalidade, do início até o mês seguinte a `hoje`
 * (respeitando encerramento e pausa). Não tem quantidade limitada.
 */
/** Faixas de valor em ordem (dados antigos sem faixas viram uma faixa única desde o início). */
export function faixasMensalidade(m?: MensalidadeLead): FaixaMensalidade[] {
  if (!m) return [];
  if (m.faixas?.length) return [...m.faixas].sort((a, b) => a.desde.localeCompare(b.desde));
  if (m.valor == null || !m.inicio) return [];
  return [{ desde: m.inicio.slice(0, 7), valor: m.valor, dia: m.diaVencimento }];
}

/** Faixa que vale para o mês (antes da primeira faixa, vale a primeira). */
export function faixaDoMes(faixas: FaixaMensalidade[], competencia: string): FaixaMensalidade | undefined {
  let atual = faixas[0];
  for (const f of faixas) if (f.desde <= competencia) atual = f;
  return atual;
}

/**
 * Reajuste a partir de um mês: as faixas anteriores ficam como estão (meses passados não mudam)
 * e as que começariam depois deste mês são substituídas.
 */
export function reajustarMensalidade(m: MensalidadeLead, desde: string, valor: number, dia: number, agora = new Date()): MensalidadeLead {
  const faixas = [...faixasMensalidade(m).filter((f) => f.desde < desde), { desde, valor, dia, em: agora.toISOString() }];
  const ultima = faixas[faixas.length - 1];
  return { ...m, faixas, valor: ultima.valor, diaVencimento: ultima.dia };
}

export function ciclosMensalidade(m: MensalidadeLead | undefined, hoje = hojeIso()): CicloMensalidade[] {
  if (!m || !m.inicio) return [];
  const faixas = faixasMensalidade(m);
  if (!faixas.length) return [];
  const vencDe = (comp: string) => vencimentoDoMes(comp, (faixaDoMes(faixas, comp) as FaixaMensalidade).dia);
  const limiteGeracao = vencimentoDoMes(proximaCompetencia(hoje.slice(0, 7)), 31);
  const limites = [limiteGeracao, m.fim, m.pausadaEm].filter(Boolean) as string[];
  const limite = limites.sort()[0];
  let comp = m.inicio.slice(0, 7);
  if (vencDe(comp) < m.inicio) comp = proximaCompetencia(comp);
  const ciclos: CicloMensalidade[] = [];
  const doRegistro = (comp: string, r?: RegistroMensalidade): CicloMensalidade => {
    const faixa = faixaDoMes(faixas, comp) as FaixaMensalidade;
    return {
      competencia: comp,
      // mês já registrado guarda o próprio valor/vencimento: reajuste posterior não altera
      vencimento: r?.vencimento ?? vencimentoDoMes(comp, faixa.dia),
      valor: r?.valor ?? faixa.valor,
      pago: !!r?.pago,
      pagoEm: r?.pagoEm,
      comprovante: r?.comprovante,
    };
  };
  for (let i = 0; i < 600; i++) {
    const reg = m.registros.find((r) => r.competencia === comp);
    const ciclo = doRegistro(comp, reg);
    if (ciclo.vencimento > limite) break;
    ciclos.push(ciclo);
    comp = proximaCompetencia(comp);
  }
  // registros de ciclos que ficaram fora (ex.: data de início mudou) não somem
  m.registros
    .filter((r) => !ciclos.some((c) => c.competencia === r.competencia) && (r.pago || r.comprovante))
    .forEach((r) => ciclos.push(doRegistro(r.competencia, r)));
  return ciclos.sort((a, b) => a.competencia.localeCompare(b.competencia));
}

export function nomeCompetencia(c: string): string {
  const [a, m] = c.split('-').map(Number);
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${String(a).slice(2)}`;
}

export function mensalidadeAtiva(m?: MensalidadeLead, hoje = hojeIso()): boolean {
  if (!m || !m.ativa || m.valor == null) return false;
  if (m.pausadaEm && m.pausadaEm <= hoje) return false;
  if (m.fim && m.fim < hoje) return false;
  return true;
}

// ---------- cobranças unificadas ----------
export type TipoCobranca = 'avista' | 'entrada' | 'parcela' | 'mensalidade';

export type Cobranca = {
  /** Chave estável (usada também para não repetir notificações) */
  chave: string;
  leadId: string;
  cliente: string;
  responsavel?: string;
  tipo: TipoCobranca;
  rotulo: string;
  valor: number;
  /** Só parcelas e mensalidades têm vencimento */
  vencimento?: string;
  pago: boolean;
  pagoEm?: string;
  forma?: FormaPagamento;
  comprovante?: Comprovante;
};

export type SituacaoCobranca = 'paga' | 'vencida' | 'hoje' | 'proxima' | 'pendente' | 'aguardando';

/** Todas as cobranças do lead (lead perdido não gera cobrança). */
export function cobrancasDoLead(lead: Lead, hoje = hojeIso()): Cobranca[] {
  if (lead.etapa === ETAPA_PERDIDO) return [];
  const base = { leadId: lead.id, cliente: lead.cadastro?.nomeCompleto?.trim() || lead.empresa, responsavel: lead.responsavel };
  const lista: Cobranca[] = [];
  const pg = normalizarPagamento(lead.pagamento);
  if (pg?.modalidade === 'avista' && pg.valor != null) {
    lista.push({
      ...base,
      chave: `${lead.id}:avista`,
      tipo: 'avista',
      rotulo: 'Pagamento à vista',
      valor: pg.valor,
      pago: !!pg.pagoEm,
      pagoEm: pg.pagoEm,
      forma: pg.forma,
      comprovante: pg.comprovante,
    });
  }
  if (pg?.modalidade === 'entrada') {
    if (pg.entrada?.valor != null) {
      lista.push({
        ...base,
        chave: `${lead.id}:entrada`,
        tipo: 'entrada',
        rotulo: 'Entrada',
        valor: pg.entrada.valor,
        pago: !!pg.entrada.pagoEm,
        pagoEm: pg.entrada.pagoEm,
        forma: pg.entrada.forma,
        comprovante: pg.entrada.comprovante,
      });
    }
    const total = (pg.parcelas ?? []).length;
    (pg.parcelas ?? []).forEach((p) =>
      lista.push({
        ...base,
        chave: `${lead.id}:parcela:${p.id}`,
        tipo: 'parcela',
        rotulo: `Parcela ${p.numero}/${total}`,
        valor: p.valor,
        vencimento: p.vencimento,
        pago: p.pago,
        pagoEm: p.pagoEm,
        forma: pg.formaParcelas,
        comprovante: p.comprovante,
      })
    );
  }
  ciclosMensalidade(lead.mensalidade, hoje).forEach((c) =>
    lista.push({
      ...base,
      chave: `${lead.id}:mensalidade:${c.competencia}`,
      tipo: 'mensalidade',
      rotulo: `Mensalidade ${nomeCompetencia(c.competencia)}`,
      valor: c.valor,
      vencimento: c.vencimento,
      pago: c.pago,
      pagoEm: c.pagoEm,
      forma: lead.mensalidade?.forma,
      comprovante: c.comprovante,
    })
  );
  return lista;
}

export function situacaoCobranca(c: Pick<Cobranca, 'pago' | 'vencimento'>, hoje = hojeIso()): SituacaoCobranca {
  if (c.pago) return 'paga';
  if (!c.vencimento) return 'aguardando';
  const d = diasAte(c.vencimento, hoje);
  if (d < 0) return 'vencida';
  if (d === 0) return 'hoje';
  if (d <= 3) return 'proxima';
  return 'pendente';
}

/** Cobranças vencidas, que vencem hoje ou nos próximos 3 dias (para o sininho e os alertas). */
export function alertasCobranca(leads: Lead[], hoje = hojeIso()): Array<Cobranca & { situacao: SituacaoCobranca; dias: number }> {
  return leads
    .flatMap((l) => cobrancasDoLead(l, hoje))
    .filter((c) => c.vencimento && !c.pago)
    .map((c) => ({ ...c, situacao: situacaoCobranca(c, hoje), dias: diasAte(c.vencimento as string, hoje) }))
    .filter((c) => c.situacao === 'vencida' || c.situacao === 'hoje' || c.situacao === 'proxima')
    .sort((a, b) => a.dias - b.dias);
}

// ---------- calendário de recebimentos ----------
export type ItemRecebimento = Cobranca & { situacao: SituacaoCobranca; dataReferencia: string };

/**
 * Recebimentos do mês (AAAA-MM):
 * - previsto  = cobranças com vencimento no mês + pagamentos sem vencimento feitos no mês;
 * - recebido  = tudo que foi pago com data dentro do mês;
 * - pendente  = vencimento no mês, ainda não pago e não vencido;
 * - vencido   = vencimento no mês, não pago e com a data já passada.
 */
export function resumoRecebimentos(leads: Lead[], mes: string, hoje = hojeIso()) {
  const todas = leads.flatMap((l) => cobrancasDoLead(l, hoje));
  const itens: ItemRecebimento[] = todas
    .filter((c) => (c.vencimento ? c.vencimento.startsWith(mes) : false) || (c.pago && c.pagoEm?.startsWith(mes)))
    .map((c) => ({ ...c, situacao: situacaoCobranca(c, hoje), dataReferencia: c.vencimento ?? (c.pagoEm as string) }))
    .sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));
  const soma = (xs: ItemRecebimento[]) => arredondar(xs.reduce((s, x) => s + x.valor, 0));
  const doMes = itens.filter((i) => (i.vencimento ? i.vencimento.startsWith(mes) : true));
  const semData = todas.filter((c) => !c.vencimento && !c.pago);
  const atrasadasAntes = todas.filter((c) => c.vencimento && !c.pago && c.vencimento < `${mes}-01` && c.vencimento < hoje);
  return {
    itens,
    previsto: soma(doMes),
    recebido: soma(itens.filter((i) => i.pago && i.pagoEm?.startsWith(mes))),
    pendente: soma(doMes.filter((i) => !i.pago && i.situacao !== 'vencida')),
    vencido: soma(doMes.filter((i) => i.situacao === 'vencida')),
    semData,
    atrasadasAntes,
  };
}

/** Receita recorrente (mensalidades) do mês: quanto está previsto e quanto entrou. */
export function receitaRecorrente(leads: Lead[], mes: string, hoje = hojeIso()) {
  const ciclos = leads
    .filter((l) => l.etapa !== ETAPA_PERDIDO)
    .flatMap((l) => ciclosMensalidade(l.mensalidade, hoje).map((c) => ({ ...c, leadId: l.id })));
  const doMes = ciclos.filter((c) => c.competencia === mes);
  return {
    clientes: leads.filter((l) => l.etapa !== ETAPA_PERDIDO && mensalidadeAtiva(l.mensalidade, hoje)).length,
    previsto: arredondar(doMes.reduce((s, c) => s + c.valor, 0)),
    recebido: arredondar(doMes.filter((c) => c.pago).reduce((s, c) => s + c.valor, 0)),
  };
}

// ---------- textos (ficha, contrato, Kanban) ----------
export function resumoPagamentoTexto(pg?: PagamentoLead): string {
  if (!pg) return 'Pagamento não registrado';
  if (pg.modalidade === 'avista') {
    return `À vista · ${pg.forma ? FORMAS_PAGAMENTO[pg.forma] : 'forma a definir'} · ${pg.valor != null ? dinheiro(pg.valor) : 'valor a definir'}${pg.pagoEm ? ` · pago em ${dataBr(pg.pagoEm)}` : ''}`;
  }
  const parcelas = pg.parcelas ?? [];
  const iguais = new Set(parcelas.map((p) => p.valor)).size === 1;
  const cada = parcelas.length ? (iguais ? `${parcelas.length}x de ${dinheiro(parcelas[0].valor)}` : `${parcelas.length} parcelas`) : 'parcelas a definir';
  return `Entrada de ${pg.entrada?.valor != null ? dinheiro(pg.entrada.valor) : '—'} + ${cada} · total ${dinheiro(totalPagamento(pg))}`;
}

export function resumoMensalidadeTexto(m?: MensalidadeLead): string {
  if (!m || !m.ativa || m.valor == null) return '';
  const hojeComp = hojeIso().slice(0, 7);
  const faixas = faixasMensalidade(m);
  const vigente = faixaDoMes(faixas, hojeComp);
  const futura = faixas.find((f) => f.desde > hojeComp);
  const reajuste = futura ? ` · a partir de ${nomeCompetencia(futura.desde)}: ${dinheiro(futura.valor)}` : '';
  return `Mensalidade de ${dinheiro(vigente?.valor ?? m.valor)}${reajuste} · ${FORMAS_PAGAMENTO[m.forma]} · todo dia ${vigente?.dia ?? m.diaVencimento} · desde ${dataBr(m.inicio)}${m.fim ? ` até ${dataBr(m.fim)}` : ''}${m.pausadaEm ? ` · pausada em ${dataBr(m.pausadaEm)}` : ''}`;
}

/** Linhas do pagamento para a ficha de dados e o contrato. */
export function linhasPagamento(lead: Lead): string[] {
  const pg = normalizarPagamento(lead.pagamento);
  const linhas: string[] = [];
  if (!pg) linhas.push('[A PREENCHER]');
  else {
    linhas.push(resumoPagamentoTexto(pg));
    if (pg.observacao) linhas.push(pg.observacao);
    if (pg.modalidade === 'entrada') {
      if (pg.entrada?.valor != null)
        linhas.push(`  Entrada: ${dinheiro(pg.entrada.valor)} · ${FORMAS_PAGAMENTO[pg.entrada.forma]}${pg.entrada.pagoEm ? ` · paga em ${dataBr(pg.entrada.pagoEm)}` : ''}`);
      (pg.parcelas ?? []).forEach((p) =>
        linhas.push(`  Parcela ${p.numero}/${pg.parcelas!.length}: ${dinheiro(p.valor)} — vence ${dataBr(p.vencimento)}${p.pago ? ` — paga${p.pagoEm ? ` em ${dataBr(p.pagoEm)}` : ''}` : ''}`)
      );
    }
  }
  const m = resumoMensalidadeTexto(lead.mensalidade);
  if (m) linhas.push(m + (lead.mensalidade?.descricao ? ` · ${lead.mensalidade.descricao}` : ''));
  return linhas;
}

// ---------- indicadores financeiros (Meta Mensal) ----------
/**
 * Quatro visões que NÃO se somam entre si:
 * - vendas fechadas: valor dos contratos ganhos no mês (mesma base da meta);
 * - recebido: dinheiro que entrou no mês (entradas, parcelas, à vista e mensalidades pagas);
 * - a receber: cobranças em aberto (do mês e o total ainda não pago);
 * - receita recorrente: mensalidades ativas no mês.
 * Tudo sai das mesmas cobranças do calendário de Recebimentos (cobrancasDoLead).
 */
export function indicadoresFinanceiros(leads: Lead[], vendas: Array<{ valor: number; data: string }>, mes: string, hoje = hojeIso()) {
  const rec = resumoRecebimentos(leads, mes, hoje);
  const abertas = leads.flatMap((l) => cobrancasDoLead(l, hoje)).filter((c) => !c.pago);
  const doMes = vendas.filter((v) => typeof v.data === 'string' && v.data.startsWith(mes));
  return {
    vendasFechadas: arredondar(doMes.reduce((s, v) => s + (typeof v.valor === 'number' && Number.isFinite(v.valor) ? v.valor : 0), 0)),
    qtdVendas: doMes.length,
    recebido: rec.recebido,
    aReceberMes: arredondar(rec.pendente + rec.vencido),
    aReceberTotal: arredondar(abertas.reduce((s, c) => s + c.valor, 0)),
    vencidoTotal: arredondar(abertas.filter((c) => c.vencimento && c.vencimento < hoje).reduce((s, c) => s + c.valor, 0)),
    recorrente: receitaRecorrente(leads, mes, hoje),
  };
}
