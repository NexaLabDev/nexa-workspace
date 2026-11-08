// ============================================
// SERVIÇOS DA NEXA LAB E TABELA DA CALCULADORA
// ============================================
// Serviços: lista inicial do CLAUDE.md. Editável na aba Serviços
// (os valores ficam salvos; ver useServicos em dados.ts).
// Preços: [A DEFINIR] até serem cadastrados. Nenhum valor foi inventado.
// ============================================

export type ServicoNexa = {
  id: string;
  nome: string;
  descricao: string;
  /** Valor de implantação (projeto), em reais. null = ainda não definido. */
  precoBase: number | null;
  /** Valor da mensalidade (manutenção), em reais. Opcional. */
  mensalidade?: number | null;
  /** Campos personalizados que aparecem na Ficha dos projetos com este serviço (configurados na aba Serviços) */
  campos?: CampoServico[];
  /** Checklist padrão: pode ser copiado para o projeto como modelo de tarefas */
  checklist?: ItemChecklistModelo[];
};

/** Tipos de campo personalizado (o valor é sempre guardado como texto, ou sim/não no checkbox). */
export type TipoCampo = 'texto' | 'paragrafo' | 'numero' | 'data' | 'selecao' | 'url' | 'email' | 'telefone' | 'checkbox';

export const TIPOS_CAMPO: Array<{ id: TipoCampo; nome: string }> = [
  { id: 'texto', nome: 'Texto curto' },
  { id: 'paragrafo', nome: 'Texto longo' },
  { id: 'numero', nome: 'Número' },
  { id: 'data', nome: 'Data' },
  { id: 'selecao', nome: 'Seleção (lista de opções)' },
  { id: 'url', nome: 'Endereço (URL)' },
  { id: 'email', nome: 'E-mail' },
  { id: 'telefone', nome: 'Telefone' },
  { id: 'checkbox', nome: 'Caixa de marcar (sim/não)' },
];

export type CampoServico = {
  /** Fixo: renomear o campo não perde os valores já preenchidos */
  id: string;
  nome: string;
  tipo: TipoCampo;
  /** Só para "selecao" */
  opcoes?: string[];
  obrigatorio: boolean;
  /** Removido da configuração: some dos projetos novos, mas valores já preenchidos continuam visíveis */
  arquivado?: boolean;
};

export type ItemChecklistModelo = { id: string; texto: string };

export const servicosNexa: ServicoNexa[] = [
  {
    id: 'sites',
    nome: 'Sites e landing pages',
    descricao: 'Páginas para apresentar o negócio, divulgar uma oferta e receber contatos.',
    precoBase: null,
  },
  {
    id: 'apps',
    nome: 'Aplicativos web e PWAs',
    descricao: 'Aplicativos que funcionam no navegador e podem ser instalados no celular.',
    precoBase: null,
  },
  {
    id: 'gestao',
    nome: 'Sistemas de gestão',
    descricao: 'Sistemas e painéis administrativos para organizar clientes, pedidos e processos.',
    precoBase: null,
  },
  {
    id: 'automacoes',
    nome: 'Automações e integrações',
    descricao: 'Ligação entre ferramentas e tarefas repetitivas feitas automaticamente.',
    precoBase: null,
  },
  {
    id: 'consultoria',
    nome: 'Consultoria tecnológica',
    descricao: 'Ajuda para escolher ferramentas e organizar processos antes de investir.',
    precoBase: null,
  },
  {
    id: 'manutencao',
    nome: 'Manutenção',
    descricao: 'Correções, atualizações e ajustes em sistemas e sites já em uso.',
    precoBase: null,
  },
];

export type Escopo = { id: string; nome: string; multiplicador: number | null };

export const escopos: Escopo[] = [
  { id: 'basico', nome: 'Básico', multiplicador: null },
  { id: 'padrao', nome: 'Padrão', multiplicador: null },
  { id: 'avancado', nome: 'Avançado', multiplicador: null },
];

export type Prazo = { id: string; nome: string; multiplicador: number | null };

export const prazos: Prazo[] = [
  { id: '30d', nome: '30 dias', multiplicador: null },
  { id: '8s', nome: '8 semanas', multiplicador: null },
  { id: '12s', nome: '12 semanas', multiplicador: null },
];

/**
 * Valor estimado = preço base × multiplicador do escopo × multiplicador do prazo.
 * Multiplicador vazio conta como 1. Retorna null enquanto o preço base não for definido.
 */
export function calcularValor(servicoId: string, escopoId: string, prazoId: string, lista: ServicoNexa[] = servicosNexa): number | null {
  const servico = lista.find((s) => s.id === servicoId);
  if (!servico || servico.precoBase == null) return null;
  const me = escopos.find((e) => e.id === escopoId)?.multiplicador ?? 1;
  const mp = prazos.find((p) => p.id === prazoId)?.multiplicador ?? 1;
  return Math.round(servico.precoBase * me * mp);
}

export function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
