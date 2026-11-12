// ============================================
// LIGAÇÕES ENTRE CRM, CLIENTES, VENDAS E PROJETOS
// ============================================
// Regra única, usada por todas as telas: toda venda ganha pertence a um
// cliente da aba Clientes. O cliente é encontrado nesta ordem:
//   1) o vínculo já gravado no lead (clienteId);
//   2) o mesmo CPF/CNPJ;
//   3) o mesmo nome (nome do lead ou razão social), desde que o CPF/CNPJ não seja diferente.
// Se nenhum servir, o cliente é criado. Venda e projeto recebem o mesmo clienteId.
// Tudo é idempotente: rodar de novo não duplica cliente, venda, projeto nem histórico.
// Não depende do navegador (pode rodar também no servidor / na migração).
// ============================================

import { ETAPA_GANHO, ETAPA_PERDIDO, dataLocal, etapasLead, type Cliente, type HistoricoCliente, type Lead, type Projeto, type Venda } from './dados-exemplo';

export const digitosDocumento = (s?: string): string | null => {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14 ? d : null;
};

export function normalizarNome(s?: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+(ltda|me|epp|eireli|sa|s a|mei)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const nomesDoLead = (l: Lead) => [l.empresa, l.cadastro?.nomeCompleto].map(normalizarNome).filter(Boolean);
const nomesDoCliente = (c: Cliente) => [c.nome, c.nomeCompleto].map(normalizarNome).filter(Boolean);

/** Cliente que corresponde ao lead (ou undefined se precisa criar). */
export function encontrarCliente(clientes: Cliente[], lead: Lead): Cliente | undefined {
  if (lead.clienteId) {
    const porId = clientes.find((c) => c.id === lead.clienteId);
    if (porId) return porId;
  }
  const doc = digitosDocumento(lead.cadastro?.documento);
  if (doc) {
    const porDoc = clientes.find((c) => digitosDocumento(c.documento) === doc);
    if (porDoc) return porDoc;
  }
  const nomes = nomesDoLead(lead);
  return clientes.find((c) => {
    const docCliente = digitosDocumento(c.documento);
    if (doc && docCliente && doc !== docCliente) return false; // mesmo nome, documento diferente = outro cliente
    return nomesDoCliente(c).some((n) => nomes.includes(n));
  });
}

/** Clientes com o mesmo CPF/CNPJ ou o mesmo nome (relatório de duplicidades, não altera nada). */
export function possiveisDuplicados(clientes: Cliente[]): Array<{ motivo: string; ids: string[] }> {
  const grupos = new Map<string, string[]>();
  for (const c of clientes) {
    const doc = digitosDocumento(c.documento);
    const chaves = [doc ? `CPF/CNPJ ${c.documento}` : null, ...nomesDoCliente(c).map((n) => `nome "${n}"`)].filter(Boolean) as string[];
    for (const k of new Set(chaves)) grupos.set(k, [...(grupos.get(k) ?? []), c.id]);
  }
  return Array.from(grupos.entries())
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([motivo, ids]) => ({ motivo, ids: Array.from(new Set(ids)) }));
}

/** Texto inicial do lead criado por "Nova contratação" (não é nome de serviço) */
export const DESCRICAO_NOVA_CONTRATACAO = 'Nova contratação';

const nomeServico = (l: Lead) => {
  const servico = l.cadastro?.servico?.trim();
  if (servico) return servico;
  const desc = l.descricao?.trim();
  return desc && desc !== DESCRICAO_NOVA_CONTRATACAO ? desc : 'Serviço a definir';
};
const brl = (v: number | null | undefined) =>
  v == null ? 'valor a definir' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

function ultimoEventoDoLead(c: Cliente, leadId: string): HistoricoCliente | undefined {
  return [...(c.historico ?? [])].reverse().find((h) => h.leadId === leadId && h.chave);
}

/** Copia para o cliente só os dados que ele ainda não tem (nunca sobrescreve). */
function completarCliente(c: Cliente, l: Lead): Cliente {
  const cad = l.cadastro ?? {};
  const novo: Cliente = { ...c };
  const preencher = <K extends keyof Cliente>(k: K, v: Cliente[K] | undefined) => {
    if (v != null && v !== '' && (novo[k] == null || novo[k] === '')) novo[k] = v;
  };
  preencher('nomeCompleto', cad.nomeCompleto?.trim());
  preencher('documento', cad.documento?.trim());
  preencher('endereco', cad.endereco?.trim());
  preencher('assinante', cad.assinante?.trim());
  preencher('email', l.email?.trim());
  preencher('telefone', l.telefone?.trim());
  return novo;
}

export type Relacoes = { leads: Lead[]; clientes: Cliente[]; vendas: Venda[]; projetos: Projeto[] };
export type MudancasRelacoes = Partial<Relacoes>;

/**
 * Confere as ligações e devolve só as listas que mudaram (ou {} se está tudo certo).
 * `agora` permite testar com data fixa.
 */
export function reconciliarRelacoes(r: Relacoes, agora = new Date()): MudancasRelacoes {
  let clientes = r.clientes;
  let leads = r.leads;
  let vendas = r.vendas;
  let projetos = r.projetos;
  const mudou = { clientes: false, leads: false, vendas: false, projetos: false };

  const salvarCliente = (c: Cliente) => {
    const existe = clientes.some((x) => x.id === c.id);
    clientes = existe ? clientes.map((x) => (x.id === c.id ? c : x)) : [c, ...clientes];
    mudou.clientes = true;
  };

  for (const lead of r.leads) {
    const ganho = lead.etapa === ETAPA_GANHO;

    if (ganho) {
      let cli = encontrarCliente(clientes, lead);
      const servico = nomeServico(lead);
      if (!cli) {
        cli = {
          id: `c-${lead.id}`,
          nome: lead.empresa,
          segmento: '',
          status: 'Ativo',
          servicos: [],
          ultimaAtividade: '',
          origem: 'venda',
          criadoEm: agora.toISOString(),
          historico: [],
        };
      }
      let atualizado = completarCliente(cli, lead);
      const ultimo = ultimoEventoDoLead(atualizado, lead.id);
      if (!ultimo?.chave?.startsWith('contratacao:')) {
        const quando = lead.ganhoEm ?? dataLocal(agora);
        const chave = `contratacao:${lead.id}:${quando}`;
        if (!(atualizado.historico ?? []).some((h) => h.chave === chave)) {
          atualizado = {
            ...atualizado,
            status: 'Ativo',
            servicos: (atualizado.servicos ?? []).includes(servico) ? (atualizado.servicos ?? []) : [...(atualizado.servicos ?? []), servico],
            ultimaAtividade: `Venda ganha em ${dataBr(quando)}`,
            historico: [
              ...(atualizado.historico ?? []),
              { em: agora.toISOString(), chave, leadId: lead.id, texto: `Contratou ${servico} (${brl(lead.valor)}) — venda ganha em ${dataBr(quando)}` },
            ],
          };
        }
      }
      if (JSON.stringify(atualizado) !== JSON.stringify(clientes.find((x) => x.id === atualizado.id))) salvarCliente(atualizado);

      const clienteId = atualizado.id;
      if (lead.clienteId !== clienteId) {
        leads = leads.map((l) => (l.id === lead.id ? { ...l, clienteId } : l));
        mudou.leads = true;
      }
      if (vendas.some((v) => v.leadId === lead.id && (v.clienteId !== clienteId || v.servico !== servico))) {
        vendas = vendas.map((v) => (v.leadId === lead.id ? { ...v, clienteId, servico } : v));
        mudou.vendas = true;
      }
      // o projeto guarda uma cópia do valor da venda: acompanha correções de valor
      if (projetos.some((p) => p.leadId === lead.id && (p.clienteId !== clienteId || (p.valor ?? null) !== (lead.valor ?? null)))) {
        projetos = projetos.map((p) => (p.leadId === lead.id ? { ...p, clienteId, valor: lead.valor } : p));
        mudou.projetos = true;
      }
    } else if (lead.clienteId) {
      // Venda desfeita (voltou de etapa ou perdida): registra no histórico do cliente, sem apagar nada
      const cli = clientes.find((c) => c.id === lead.clienteId);
      const ultimo = cli && ultimoEventoDoLead(cli, lead.id);
      if (cli && ultimo?.chave?.startsWith('contratacao:')) {
        const hoje = dataLocal(agora);
        const chave = `cancelada:${lead.id}:${hoje}`;
        const etapa = lead.etapa === ETAPA_PERDIDO ? 'perdida' : `voltou para ${etapasLead.find((e) => e.id === lead.etapa)?.nome ?? lead.etapa}`;
        salvarCliente({
          ...cli,
          ultimaAtividade: `Venda desfeita em ${dataBr(hoje)}`,
          historico: [
            ...(cli.historico ?? []),
            { em: agora.toISOString(), chave, leadId: lead.id, texto: `Venda de ${nomeServico(lead)} desfeita (${etapa}). A meta foi recalculada.` },
          ],
        });
      }
    }
  }

  // Projetos ligados a um cliente mostram o nome do cadastro (editar o cliente atualiza todos os projetos dele)
  const nomePorCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  if (projetos.some((p) => p.clienteId && nomePorCliente.has(p.clienteId) && nomePorCliente.get(p.clienteId) !== p.cliente)) {
    projetos = projetos.map((p) => {
      const nome = p.clienteId ? nomePorCliente.get(p.clienteId) : undefined;
      return nome && nome !== p.cliente ? { ...p, cliente: nome } : p;
    });
    mudou.projetos = true;
  }

  const saida: MudancasRelacoes = {};
  if (mudou.clientes) saida.clientes = clientes;
  if (mudou.leads) saida.leads = leads;
  if (mudou.vendas) saida.vendas = vendas;
  if (mudou.projetos) saida.projetos = projetos;
  return saida;
}

/** Lead novo para uma nova contratação do mesmo cliente (não mexe nos projetos anteriores). */
export function leadNovaContratacao(cliente: Cliente, agora = new Date()): Lead {
  return {
    id: `l-${agora.getTime().toString(36)}`,
    empresa: cliente.nome,
    descricao: DESCRICAO_NOVA_CONTRATACAO,
    valor: null,
    cor: '#9fca33',
    etapa: etapasLead[0]?.id ?? 'novo',
    clienteId: cliente.id,
    email: cliente.email,
    telefone: cliente.telefone,
    cadastro: {
      nomeCompleto: cliente.nomeCompleto,
      documento: cliente.documento,
      endereco: cliente.endereco,
      assinante: cliente.assinante,
    },
    historico: [],
  };
}
