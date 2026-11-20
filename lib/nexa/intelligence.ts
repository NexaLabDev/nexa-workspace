export type CustoFixo = { id: string; nome: string; valor: number };
export type ConfigFinanceira = {
  valorHora: number; aliquota: number; taxaPagamento: number; margem: number;
  projetosPorMes: number; clientesAtivos: number; percentualImplantacao: number;
  custos: CustoFixo[];
};
export type ProjetoPrecificado = {
  nome: string; categoria: string; horasImplantacao: number; despesasImplantacao: number;
  horasSuporte: number; despesasMensais: number; precoVendido?: number; mensalidadeVendida?: number;
};
export type CalculoFinanceiro = {
  custoFixoTotal: number; rateioImplantacao: number; rateioMensal: number;
  custoImplantacao: number; custoMensal: number;
  precoImplantacao: number | null; mensalidade: number | null;
  lucroImplantacao: number | null; lucroMensal: number | null; 
  alertas: string[];
};
export const configInicial: ConfigFinanceira = {
  valorHora: 0, aliquota: 16, taxaPagamento: 4, margem: 25,
  projetosPorMes: 3, clientesAtivos: 5, percentualImplantacao: 40,
  custos: [
    { id: 'vercel', nome: 'Vercel / hospedagem', valor: 0 },
    { id: 'supabase', nome: 'Supabase / banco de dados', valor: 0 },
    { id: 'dominio', nome: 'Domínios (média mensal)', valor: 0 },
    { id: 'zapclaw', nome: 'ZapClaw / integração', valor: 0 },
    { id: 'meta', nome: 'Meta / WhatsApp', valor: 0 },
    { id: 'openai', nome: 'OpenAI / tokens', valor: 0 },
    { id: 'outros', nome: 'Contabilidade e outros gastos', valor: 0 },
  ],
};
export const projetoInicial: ProjetoPrecificado = {
  nome: '', categoria: 'Automação', horasImplantacao: 0, despesasImplantacao: 0,
  horasSuporte: 0, despesasMensais: 0,
};
export const categorias = ['Automação','CRM','Kanban','CRM + Kanban','Sistema personalizado','Integração/API','Site','Manutenção','Outro'];
const numero = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
const arred = (v: number) => Math.round((v+Number.EPSILON)*100)/100;
export const dinheiro = (v: number | null) =>
  v === null ? '—' : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function calcularProjeto(p: ProjetoPrecificado, c: ConfigFinanceira): CalculoFinanceiro {
  const alertas: string[] = [];
  const fixos = (c.custos || []).reduce((s,x)=>s+numero(x.valor),0);
  const proporcao = Math.min(100,numero(c.percentualImplantacao))/100;
  const rateioImplantacao = fixos*proporcao/Math.max(1,numero(c.projetosPorMes));
  const rateioMensal = fixos*(1-proporcao)/Math.max(1,numero(c.clientesAtivos));
  const custoImplantacao = numero(p.horasImplantacao)*numero(c.valorHora)+numero(p.despesasImplantacao)+rateioImplantacao;
  const custoMensal = numero(p.horasSuporte)*numero(c.valorHora)+numero(p.despesasMensais)+rateioMensal;
  const despesasPercentuais = (numero(c.aliquota)+numero(c.taxaPagamento))/100;
  const divisor = 1-despesasPercentuais-numero(c.margem)/100;
  if (!numero(c.valorHora)) alertas.push('Preencha o valor da sua hora antes de usar o preço sugerido.');
  if (!fixos) alertas.push('Nenhum custo fixo foi informado; o rateio está zerado.');
  if (divisor <= 0) alertas.push('Impostos, taxas e margem somam 100% ou mais; revise as configurações.');
  if (numero(c.aliquota) === 16) alertas.push('A reserva tributária é apenas uma hipótese; confirme o enquadramento com contador.');
  const valido = divisor > 0 && numero(c.valorHora) > 0;
  const precoImplantacao = valido ? arred(custoImplantacao/divisor) : null;
  const mensalidade = valido ? arred(custoMensal/divisor) : null;
  const lucroImplantacao = precoImplantacao === null ? null : arred(precoImplantacao*(1-despesasPercentuais)-custoImplantacao);
  const lucroMensal = mensalidade === null ? null : arred(mensalidade*(1-despesasPercentuais)-custoMensal);
  return {
    custoFixoTotal: arred(fixos), rateioImplantacao: arred(rateioImplantacao),
    rateioMensal: arred(rateioMensal), custoImplantacao: arred(custoImplantacao),
    custoMensal: arred(custoMensal), precoImplantacao, mensalidade,
    lucroImplantacao, lucroMensal, alertas,
  };
}
