'use client';

// Atalhos para os dados compartilhados entre as telas (salvos no navegador).

import { CHAVES, usePersistido } from './store';
import {
  clientes as clientesExemplo,
  conversasExemplo,
  dataLocal,
  diasTrabalhoPadrao,
  documentos as documentosExemplo,
  ETAPA_GANHO,
  etapasLead,
  etapasProjeto,
  leads as leadsExemplo,
  metasExemplo,
  projetos as projetosExemplo,
  vendasExemplo,
  type Cliente,
  type Conversa,
  type DadosCadastro,
  type DiasTrabalho,
  type Documento,
  type DocumentoLead,
  type Lead,
  type Projeto,
  type Venda,
  type AtividadeProjeto,
  type AutorRegistro,
  type CategoriaArquivo,
  type TipoAtividade,
} from './dados-exemplo';
import { cobrancasDoLead, linhasPagamento, normalizarPagamento } from './financeiro';
import { servicosNexa, type ServicoNexa } from './servicos-nexa';
import type { Prestadora } from './documentos/modelos';
import { proximoCodigoProjeto } from './projetos';
import { DIAS_PRAZO_PROXIMO } from './tarefas';
import { CATEGORIAS_PADRAO } from './biblioteca';

export { proximoCodigoProjeto };

export const useLeads = () => usePersistido<Lead[]>(CHAVES.leads, leadsExemplo);
export const useVendas = () => usePersistido<Venda[]>(CHAVES.vendas, vendasExemplo);
export const useMetas = () => usePersistido<Record<string, number>>(CHAVES.metas, metasExemplo);
export const useDiasTrabalho = () => usePersistido<DiasTrabalho>(CHAVES.diasTrabalho, diasTrabalhoPadrao);
export const useProjetos = () => usePersistido<Projeto[]>(CHAVES.projetos, projetosExemplo);
export const useClientes = () => usePersistido<Cliente[]>(CHAVES.clientes, clientesExemplo);
export const useDocumentos = () => usePersistido<Documento[]>(CHAVES.documentos, documentosExemplo);
export const useConversas = () => usePersistido<Conversa[]>(CHAVES.conversas, conversasExemplo);
/** Cadastro de serviços (aba Serviços): alimenta a lista do lead, a calculadora e o Kanban */
export const useServicos = () => usePersistido<ServicoNexa[]>(CHAVES.servicos, servicosNexa);
/** Dados da prestadora usados nos documentos (Configurações). Começa vazio: nada vem do código. */
const PRESTADORA_VAZIA: Prestadora = {};
export const usePrestadora = () => usePersistido<Prestadora>(CHAVES.prestadora, PRESTADORA_VAZIA);

/** Perfil de quem usa este navegador (Configurações → Perfil). */
export type Perfil = { nome?: string; usuarioId?:string };
const PERFIL_VAZIO: Perfil = {};
export const usePerfil = () => usePersistido<Perfil>(CHAVES.perfil, PERFIL_VAZIO);

/** Categorias da biblioteca de arquivos (aba Anexos). Começa com as sugeridas; dá para criar novas. */
export const useCategoriasArquivos = () => usePersistido<CategoriaArquivo[]>(CHAVES.categoriasArquivos, CATEGORIAS_PADRAO);

/** Preferências gerais do Workspace (salvas neste navegador). */
export type Preferencias = {
  /** Tarefa com prazo em até N dias aparece como "prazo próximo" (aba Tarefas e sininho) */
  diasPrazoProximo?: number;
};
const PREFERENCIAS_PADRAO: Preferencias = {};
export const usePreferencias = () => usePersistido<Preferencias>(CHAVES.preferencias, PREFERENCIAS_PADRAO);
export const OPCOES_DIAS_PRAZO_PROXIMO = [0, 1, 2, 3, 5, 7];
export function diasPrazoProximo(p: Preferencias): number {
  const n = p.diasPrazoProximo;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 30 ? n : DIAS_PRAZO_PROXIMO;
}

/** Autor dos registros enquanto não existe login: o nome configurado, sem autenticação. */
export function autorAtual(perfil: Perfil): AutorRegistro {
  return perfil.usuarioId ? {nome:perfil.nome??'Usuário',autenticado:true,usuarioId:perfil.usuarioId} : {nome:perfil.nome??'Sem nome',autenticado:false};
}

/** Novo registro para a linha do tempo do projeto. */
export function novaAtividade(tipo: TipoAtividade, texto: string, autor: AutorRegistro, agora = new Date()): AtividadeProjeto {
  return { id: `a-${agora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, em: agora.toISOString(), tipo, texto, autor };
}

export function nomeEtapaProjeto(id: string): string {
  return etapasProjeto.find((e) => e.id === id)?.nome ?? id;
}

/** Muda a fase do projeto e registra na linha do tempo (usado pelo arrastar e pela janela). */
export function mudarFaseProjeto(p: Projeto, etapa: string, autor: AutorRegistro, agora = new Date()): Projeto {
  if (p.etapa === etapa) return p;
  return {
    ...p,
    etapa,
    // por fase: percentual fixo da fase; por tarefas: continua vindo das tarefas (nunca ajuste manual)
    progresso: p.modoProgresso === 'tarefas' ? p.progresso : progressoPadrao(etapa),
    atualizadoEm: agora.toISOString(),
    // guarda quando foi concluído (não encerra cliente nem cobranças recorrentes)
    ...(etapa === etapasProjeto[etapasProjeto.length - 1].id ? { concluidoEm: dataLocal(agora) } : {}),
    atividades: [
      ...(p.atividades ?? []),
      novaAtividade('fase', `Fase alterada: ${nomeEtapaProjeto(p.etapa)} → ${nomeEtapaProjeto(etapa)}`, autor, agora),
    ],
  };
}

export function nomeEtapaLead(id: string): string {
  if (id === 'perdido') return 'Perdido';
  return etapasLead.find((e) => e.id === id)?.nome ?? id;
}

/**
 * Aplica a mudança de etapa de um lead e mantém as vendas em sincronia:
 * - entrou em "Venda ganha": registra a venda com o valor do lead (data de hoje);
 * - saiu de "Venda ganha": remove a venda ligada a ele.
 */
export function aplicarEtapaLead(
  lead: Lead,
  novaEtapa: string,
  vendas: Venda[],
  extras: Partial<Lead> = {}
): { lead: Lead; vendas: Venda[] } {
  const agora = new Date();
  const mudou = lead.etapa !== novaEtapa;
  let atualizado: Lead = {
    ...lead,
    ...extras,
    etapa: novaEtapa,
    historico: mudou
      ? [...(lead.historico ?? []), { de: lead.etapa, para: novaEtapa, em: agora.toISOString() }]
      : lead.historico,
  };
  let novasVendas = vendas;

  if (novaEtapa === ETAPA_GANHO && lead.etapa !== ETAPA_GANHO) {
    const hoje = dataLocal(agora);
    atualizado = { ...atualizado, ganhoEm: hoje, contrato: true, motivoPerda: undefined };
    novasVendas = [
      ...vendas.filter((v) => v.leadId !== lead.id),
      { id: `v-${lead.id}-${agora.getTime()}`, cliente: lead.empresa, valor: atualizado.valor ?? 0, data: hoje, leadId: lead.id },
    ];
  } else if (lead.etapa === ETAPA_GANHO && novaEtapa !== ETAPA_GANHO) {
    atualizado = { ...atualizado, ganhoEm: undefined };
    novasVendas = vendas.filter((v) => v.leadId !== lead.id);
  } else if (novaEtapa === ETAPA_GANHO && extras.valor !== undefined) {
    // valor de uma venda já ganha foi corrigido
    novasVendas = vendas.map((v) => (v.leadId === lead.id ? { ...v, valor: extras.valor ?? 0 } : v));
  }

  return { lead: atualizado, vendas: novasVendas };
}

export function progressoPadrao(etapa: string): number {
  return etapasProjeto.find((e) => e.id === etapa)?.progresso ?? 0;
}

// ============================================
// FECHAMENTO → DOCUMENTOS → VENDA GANHA → KANBAN
// ============================================

/** Campos de cadastro usados nos documentos (ficam em "Dados do Lead") */
export const CAMPOS_CADASTRO: Array<{ chave: keyof DadosCadastro; rotulo: string; dica?: string; largo?: boolean }> = [
  { chave: 'nomeCompleto', rotulo: 'Nome completo ou razão social', largo: true },
  { chave: 'documento', rotulo: 'CPF ou CNPJ' },
  { chave: 'assinante', rotulo: 'Quem assina' },
  { chave: 'endereco', rotulo: 'Endereço completo', largo: true },
  { chave: 'servico', rotulo: 'Serviço contratado', largo: true },
  { chave: 'prazo', rotulo: 'Prazo de entrega', dica: 'Ex.: 30 dias' },
];

/** Confere se o CPF/CNPJ tem a quantidade certa de números (11 ou 14). */
export function documentoValido(texto?: string): boolean {
  const n = (texto ?? '').replace(/\D/g, '').length;
  return n === 11 || n === 14;
}

/** Quantos dados do Fechamento já foram preenchidos (inclui e-mail, telefone e valor). */
export function progressoCadastro(lead: Lead): { feitos: number; total: number } {
  const c = lead.cadastro ?? {};
  const itens = [
    ...CAMPOS_CADASTRO.map((x) => c[x.chave]),
    lead.email,
    lead.telefone,
    lead.valor == null ? '' : 'ok',
  ];
  return { feitos: itens.filter((v) => String(v ?? '').trim()).length, total: itens.length };
}

/**
 * Todos os arquivos do lead: os trocados na conversa (cliente e equipe)
 * mais os anexados à mão e os gerados pelo sistema.
 */
export function documentosDoLead(lead: Lead, conversa?: Conversa): DocumentoLead[] {
  const daConversa: DocumentoLead[] = (conversa?.mensagens ?? [])
    .filter((m) => m.arquivo)
    .map((m) => ({
      id: `msg-${m.id}`,
      nome: m.arquivo!.nome,
      tamanho: m.arquivo!.tamanho,
      tipo: 'arquivo' as const,
      origem: m.de === 'cliente' ? ('cliente' as const) : ('equipe' as const),
      arquivoId: m.arquivo!.arquivoId,
      em: m.em,
    }));
  // Comprovantes de pagamento também aparecem como documentos
  const comprovantes: DocumentoLead[] = cobrancasDoLead(lead)
    .filter((c) => c.comprovante)
    .map((c) => ({
      id: `comp-${c.chave}`,
      nome: `Comprovante (${c.rotulo}) – ${c.comprovante!.nome}`,
      tamanho: c.comprovante!.tamanho,
      tipo: 'arquivo' as const,
      origem: 'equipe' as const,
      arquivoId: c.comprovante!.arquivoId,
      // mesmo formato (ISO com fuso) das outras datas, para ordenar certo
      em: new Date(`${c.pagoEm ?? c.vencimento ?? new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString(),
    }));
  return [...daConversa, ...(lead.documentos ?? []), ...comprovantes].sort((a, b) => a.em.localeCompare(b.em));
}

/** Texto da "ficha de dados" para baixar (só dados preenchidos, sem texto jurídico). */
export function textoFichaDados(lead: Lead): string {
  const c = lead.cadastro ?? {};
  const linha = (rotulo: string, valor?: string | null) => `${rotulo}: ${valor && String(valor).trim() ? valor : '[A PREENCHER]'}`;
  return [
    `FICHA DE DADOS — ${lead.empresa}`,
    `Gerada em ${new Date().toLocaleString('pt-BR')} pelo Nexa Workspace`,
    '',
    ...CAMPOS_CADASTRO.map((x) => linha(x.rotulo, c[x.chave])),
    linha('E-mail', lead.email),
    linha('Telefone', lead.telefone),
    linha('Valor', lead.valor == null ? null : lead.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })),
    '',
    'PAGAMENTO',
    ...linhasPagamento(lead),
    '',
    `Interesse: ${lead.descricao}`,
    `Responsável na Nexa Lab: ${lead.responsavel ?? '[A DEFINIR]'}`,
  ].join('\n');
}

/** Cartão do Kanban criado quando o lead vira Venda ganha, com tudo da conversa. */
export function projetoDaVenda(lead: Lead, conversa?: Conversa, codigo?: string): Projeto {
  const agora = new Date().toISOString();
  const servicoNome = lead.cadastro?.servico?.trim();
  return {
    id: `p-venda-${lead.id}-${Date.now()}`,
    ...(codigo ? { codigo } : {}),
    // serviço escolhido no lead vira o serviço principal do projeto (o checklist pode ser copiado na Ficha)
    ...(servicoNome
      ? {
          servicos: [
            {
              id: `sp-${Date.now().toString(36)}`,
              ...(lead.cadastro?.servicoId ? { servicoId: lead.cadastro.servicoId } : {}),
              nome: servicoNome,
              principal: true,
              valores: {},
              adicionadoEm: agora,
            },
          ],
        }
      : {}),
    cliente: lead.empresa,
    servico: lead.cadastro?.servico?.trim() || lead.descricao,
    etapa: etapasProjeto[0].id,
    progresso: etapasProjeto[0].progresso,
    atualizadoEm: agora,
    leadId: lead.id,
    conversaId: conversa?.id,
    descricao: lead.descricao,
    valor: lead.valor,
    telefone: lead.telefone,
    email: lead.email,
    cadastro: lead.cadastro ? { ...lead.cadastro } : undefined,
    pagamento: lead.pagamento ? JSON.parse(JSON.stringify(normalizarPagamento(lead.pagamento))) : undefined,
    mensalidade: lead.mensalidade ? JSON.parse(JSON.stringify(lead.mensalidade)) : undefined,
    documentos: documentosDoLead(lead, conversa),
    anotacoes: [...(lead.comentarios ?? [])],
    tarefas: (lead.tarefas ?? []).map((t) => ({ ...t })),
    vendidoEm: agora,
  };
}

/** Se o lead acabou de virar Venda ganha e ainda não tem cartão no Kanban, cria. */
export function projetosAposMudanca(
  antes: Lead,
  depois: Lead,
  projetos: Projeto[],
  conversas: Conversa[]
): Projeto[] {
  if (depois.etapa !== ETAPA_GANHO || antes.etapa === ETAPA_GANHO) return projetos;
  if (projetos.some((p) => p.leadId === depois.id)) return projetos;
  const conversa = conversas.find((cv) => cv.leadId === depois.id);
  return [...projetos, projetoDaVenda(depois, conversa, proximoCodigoProjeto(projetos))];
}
