// ============================================
// MODELOS DE DOCUMENTO DO LEAD
// ============================================
// Reaproveita a estrutura do gerador "Nexa_Lab_Gerador_Montserrat_Fina.html":
// proposta comercial, contrato-base de desenvolvimento (cláusulas sem alteração)
// e ordem de serviço. Recibo e ficha de dados usam só dados, sem cláusulas.
// Aditivo contratual: modelo ainda não existe (pendente).
//
// Regra: nunca preencher o que falta com dados inventados. O que faltar
// aparece em `pendencias()` e, na pré-visualização, como [FALTA: …].
// Os dados da prestadora vêm de Configurações (nunca do código).
// ============================================

import { CLAUSULAS_CONTRATO } from './clausulas-contrato';
import type { Lead } from '../dados-exemplo';
import {
  cobrancasDoLead,
  dataBr,
  dinheiro,
  FORMAS_PAGAMENTO,
  linhasPagamento,
  normalizarPagamento,
  resumoMensalidadeTexto,
  resumoPagamentoTexto,
  type Cobranca,
} from '../financeiro';

export type TipoDocLead = 'proposta' | 'contrato' | 'aditivo' | 'os' | 'recibo' | 'ficha';

export const TIPOS_DOC: Array<{ id: TipoDocLead; nome: string; disponivel: boolean; minuta: boolean; nota: string }> = [
  { id: 'proposta', nome: 'Proposta comercial', disponivel: true, minuta: true, nota: 'Modelo do gerador Nexa (minuta).' },
  { id: 'contrato', nome: 'Contrato de prestação de serviços', disponivel: true, minuta: true, nota: 'Contrato-base de desenvolvimento do gerador Nexa, 13 cláusulas sem alteração (minuta, revisão jurídica pendente).' },
  { id: 'os', nome: 'Ordem de serviço', disponivel: true, minuta: true, nota: 'Ordem de Serviço e escopo do gerador Nexa (minuta).' },
  { id: 'aditivo', nome: 'Aditivo contratual', disponivel: false, minuta: true, nota: 'Modelo pendente: ainda não existe texto aprovado para o aditivo.' },
  { id: 'recibo', nome: 'Recibo', disponivel: true, minuta: false, nota: 'Só com os dados do pagamento escolhido, sem cláusulas.' },
  { id: 'ficha', nome: 'Ficha de dados', disponivel: true, minuta: false, nota: 'Todos os dados do lead; o que faltar aparece como [A PREENCHER].' },
];

/** Dados da prestadora (Configurações) */
export type Prestadora = { nome?: string; cpf?: string; email?: string; endereco?: string; cidade?: string };

/** Informações que só existem no documento (guardadas no lead) */
export type ComplementosDoc = {
  entregas?: string;
  exclusoes?: string;
  validade?: string;
  suporte?: string;
  prazoResposta?: string;
  prazoCorrecao?: string;
  anosSigilo?: string;
  prazoDisputa?: string;
  prazoValidacao?: string;
  prazoDefeitos?: string;
  /** chave da cobrança paga usada no recibo */
  cobrancaRecibo?: string;
};

/** Valores que o gerador original já trazia preenchidos (editáveis). */
export const COMPLEMENTOS_PADRAO: ComplementosDoc = {
  validade: '15',
  prazoResposta: '5',
  prazoCorrecao: '10',
  anosSigilo: '3',
  prazoDisputa: '10',
  prazoValidacao: '5',
  prazoDefeitos: '30',
};

export type Pendencia = {
  rotulo: string;
  /** onde preencher */
  onde: 'lead' | 'pagamento' | 'documento' | 'configuracoes';
  /** id do campo para levar até ele */
  alvo?: string;
};

type Ctx = { lead: Lead; prestadora: Prestadora; comp: ComplementosDoc };

const vazio = (s?: string | null) => !s || !String(s).trim();

/** Campos obrigatórios que faltam para o tipo escolhido. */
export function pendencias(tipo: TipoDocLead, { lead, prestadora, comp }: Ctx): Pendencia[] {
  const p: Pendencia[] = [];
  const cad = lead.cadastro ?? {};
  const pg = normalizarPagamento(lead.pagamento);
  const lead_ = (cond: boolean, rotulo: string, alvo: string) => cond && p.push({ rotulo, onde: 'lead', alvo });
  const doc_ = (cond: boolean, rotulo: string, alvo: string) => cond && p.push({ rotulo, onde: 'documento', alvo });
  const conf_ = (cond: boolean, rotulo: string) => cond && p.push({ rotulo, onde: 'configuracoes' });
  const prestadoraCompleta = () => {
    conf_(vazio(prestadora.nome), 'Nome da prestadora');
    conf_(vazio(prestadora.cpf), 'CPF da prestadora');
    conf_(vazio(prestadora.email), 'E-mail da prestadora');
    conf_(vazio(prestadora.endereco), 'Endereço da prestadora');
  };
  const clienteCompleto = () => {
    lead_(vazio(cad.nomeCompleto), 'Nome completo ou razão social', 'campo-nomeCompleto');
    lead_(vazio(cad.documento), 'CPF ou CNPJ', 'campo-documento');
    lead_(vazio(cad.endereco), 'Endereço completo', 'campo-endereco');
    lead_(vazio(lead.email), 'E-mail', 'campo-email');
  };

  switch (tipo) {
    case 'proposta':
      lead_(vazio(cad.nomeCompleto), 'Nome completo ou razão social', 'campo-nomeCompleto');
      lead_(vazio(cad.servico), 'Serviço contratado', 'campo-servico');
      lead_(vazio(lead.descricao) || lead.descricao === '—', 'Interesse (objetivo)', 'campo-interesse');
      lead_(vazio(cad.prazo), 'Prazo de entrega', 'campo-prazo');
      lead_(lead.valor == null, 'Valor (R$)', 'campo-valor');
      if (!pg) p.push({ rotulo: 'Pagamento (à vista ou entrada + parcelas)', onde: 'pagamento' });
      doc_(vazio(comp.entregas), 'O que será entregue', 'doc-entregas');
      doc_(vazio(comp.validade), 'Validade da proposta (dias)', 'doc-validade');
      break;
    case 'contrato':
      prestadoraCompleta();
      conf_(vazio(prestadora.cidade), 'Cidade/UF da prestadora');
      clienteCompleto();
      doc_(vazio(comp.prazoResposta), 'Prazo de resposta (dias úteis)', 'doc-prazoResposta');
      doc_(vazio(comp.prazoCorrecao), 'Prazo para corrigir pendências (dias úteis)', 'doc-prazoCorrecao');
      doc_(vazio(comp.anosSigilo), 'Sigilo (anos)', 'doc-anosSigilo');
      doc_(vazio(comp.prazoDisputa), 'Prazo para resolver divergências (dias úteis)', 'doc-prazoDisputa');
      break;
    case 'os':
      prestadoraCompleta();
      conf_(vazio(prestadora.cidade), 'Cidade/UF da prestadora');
      clienteCompleto();
      lead_(vazio(cad.servico), 'Serviço contratado', 'campo-servico');
      lead_(vazio(lead.descricao) || lead.descricao === '—', 'Interesse (objetivo)', 'campo-interesse');
      lead_(vazio(cad.prazo), 'Prazo de entrega', 'campo-prazo');
      lead_(lead.valor == null, 'Valor (R$)', 'campo-valor');
      if (!pg) p.push({ rotulo: 'Pagamento (à vista ou entrada + parcelas)', onde: 'pagamento' });
      doc_(vazio(comp.entregas), 'O que será entregue', 'doc-entregas');
      doc_(vazio(comp.prazoValidacao), 'Prazo para testar (dias úteis)', 'doc-prazoValidacao');
      doc_(vazio(comp.prazoDefeitos), 'Prazo para corrigir defeitos (dias)', 'doc-prazoDefeitos');
      break;
    case 'recibo': {
      conf_(vazio(prestadora.nome), 'Nome da prestadora');
      conf_(vazio(prestadora.cpf), 'CPF da prestadora');
      lead_(vazio(cad.nomeCompleto), 'Nome completo ou razão social', 'campo-nomeCompleto');
      lead_(vazio(cad.documento), 'CPF ou CNPJ', 'campo-documento');
      const pagas = cobrancasDoLead(lead).filter((c) => c.pago && c.pagoEm);
      if (!pagas.length) p.push({ rotulo: 'Um pagamento marcado como pago, com data', onde: 'pagamento' });
      else doc_(!pagas.some((c) => c.chave === comp.cobrancaRecibo), 'Qual pagamento o recibo comprova', 'doc-cobrancaRecibo');
      break;
    }
    case 'aditivo':
      p.push({ rotulo: 'Modelo de aditivo ainda não existe', onde: 'documento' });
      break;
    case 'ficha':
      break;
  }
  return p;
}

// ---------- montagem do HTML ----------
const esc = (s?: string | null) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const falta = (rotulo: string) => `<span class="empty">[FALTA: ${esc(rotulo)}]</span>`;
const ou = (valor: string | null | undefined, rotulo: string) => (vazio(valor) ? falta(rotulo) : esc(valor));
const lista = (txt?: string) =>
  vazio(txt)
    ? falta('o que será entregue')
    : `<ul>${String(txt)
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => `<li>${esc(x)}</li>`)
        .join('')}</ul>`;

const CSS = `
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1b1f1a;font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.5}
.page{max-width:780px;margin:0 auto;padding:36px 44px}
.letterhead{display:flex;justify-content:space-between;gap:14px;align-items:center;padding-bottom:12px;border-bottom:2px solid #baff43}
.brand{display:flex;align-items:center;gap:10px}.brand img{width:30px;height:auto}.brand b{font-size:18px;letter-spacing:-.01em}
.lettersub{font-size:10.5px;color:#5e6a5d}.sm{font-size:11px;color:#5e6a5d}
h1{font-size:22px;margin:22px 0 2px}h2{font-size:14px;margin:20px 0 6px}.meta{color:#5e6a5d;font-size:11px}
.minuta{margin:14px 0 0;padding:7px 10px;border:1px dashed #c9a227;background:#fff8e1;color:#7a5a00;font-size:11px}
.intro{margin:20px 0}.dataBlock{border:1px solid #dce2db;padding:12px 15px;margin:17px 0;background:#fbfdfb}
.dataBlock p{margin:4px 0}.compactParties{font-size:11.5px}
.invest{display:flex;gap:18px;border:1px solid #dce2db;padding:12px 15px;margin:10px 0}.investMain{min-width:180px}
.investLabel{font-size:10.5px;color:#5e6a5d;text-transform:uppercase;letter-spacing:.04em}.amount{font-size:20px;font-weight:800;margin:2px 0}
.investTerms p{margin:3px 0}
.importanttext{background:#f7f9f3;border-left:3px solid #a4d731;padding:10px 12px;font-size:12px}
.longP{margin:8px 0;font-size:12.4px;line-height:1.54}.clause{display:flex;gap:8px;break-inside:avoid;page-break-inside:avoid}.clauseNum{min-width:30px}
.docTable{border-collapse:collapse;width:100%;font-size:12px;margin:9px 0 18px}.docTable th,.docTable td{border:1px solid #dce2db;padding:7px 9px;text-align:left;vertical-align:top}
.docTable th{background:#f3f6f2}
.signature{display:flex;gap:32px;margin-top:64px;page-break-inside:avoid}.signature div{flex:1;border-top:1px solid #1b1f1a;padding-top:6px;font-size:11.5px}
.foot{border-top:1px solid #dfe5de;margin-top:36px;padding-top:10px;color:#667166;font-size:10px;display:flex;justify-content:space-between;gap:10px}
.empty{color:#967021;background:#fff2c9;padding:0 3px}
.recibo{border:1px solid #dce2db;padding:18px 20px;margin-top:18px}.recibo .amount{margin:8px 0}
ul{margin:4px 0 4px 18px;padding:0}
@media screen and (max-width:520px){.invest{flex-direction:column;gap:8px}.investMain{min-width:0}.page{padding:20px 16px}}
@media print{.page{padding:0}@page{margin:16mm}}
`;

export type OpcoesHtml = Ctx & { tipo: TipoDocLead; logoUrl: string };

function cabecalho(logoUrl: string) {
  return `<div class="letterhead"><div><div class="brand"><img src="${logoUrl}" alt=""><b>Nexa Lab</b></div><div class="lettersub">Soluções tecnológicas sob medida</div></div><div class="sm">Do caos à solução.</div></div>`;
}

function rodape(minuta: boolean) {
  return `<div class="foot"><span>Nexa Lab · Identificação comercial de pessoa física${minuta ? ' · Minuta — revisão jurídica pendente' : ''}</span><span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span></div>`;
}

function titulo(t: string, descricao: string, minuta: boolean) {
  return `<h1>${esc(t)}</h1><div class="meta">${esc(descricao)} · ${new Date().toLocaleDateString('pt-BR')}</div>${minuta ? '<p class="minuta">Minuta — texto jurídico ainda sem revisão de advogado.</p>' : ''}`;
}

function partes({ lead, prestadora }: Ctx, compacto: boolean) {
  const cad = lead.cadastro ?? {};
  const prest = `${ou(prestadora.nome, 'nome da prestadora')}, ${compacto ? '' : 'pessoa física, '}CPF ${ou(prestadora.cpf, 'CPF da prestadora')}, e-mail ${ou(prestadora.email, 'e-mail da prestadora')}, ${compacto ? '' : 'endereço '}${ou(prestadora.endereco, 'endereço da prestadora')}, ${compacto ? 'identificação comercial Nexa Lab, sem CNPJ' : 'atuando sob a identificação comercial Nexa Lab, sem CNPJ'}.`;
  const cli = `${ou(cad.nomeCompleto, 'nome do cliente')}, CPF/CNPJ ${ou(cad.documento, 'CPF/CNPJ')}, ${compacto ? '' : 'endereço '}${ou(cad.endereco, 'endereço')}, e-mail ${ou(lead.email, 'e-mail')}${cad.assinante ? `, representado(a), se aplicável, por ${esc(cad.assinante)}` : ''}.`;
  return compacto
    ? `<p class="compactParties"><b>PRESTADORA:</b> ${prest}<br><b>CONTRATANTE:</b> ${cli}</p>`
    : `<div class="dataBlock"><p><strong>PRESTADORA:</strong> ${prest}</p><p><strong>CONTRATANTE:</strong> ${cli}</p></div>`;
}

function assinaturas({ lead, prestadora }: Ctx) {
  return `<p style="margin-top:24px"><b>Local e data:</b> ${ou(prestadora.cidade, 'cidade/UF')}, ____/____/________.</p><div class="signature"><div>${ou(prestadora.nome, 'nome da prestadora')}<br>Contratada — pessoa física / Nexa Lab</div><div>${ou(lead.cadastro?.nomeCompleto, 'nome do cliente')}<br>Contratante</div></div>`;
}

function clausulas(comp: ComplementosDoc, prestadora: Prestadora) {
  const valores: Record<string, string | undefined> = {
    '2.1': comp.prazoResposta,
    '3.2': comp.prazoCorrecao,
    '5.2': comp.anosSigilo,
    '7.1': comp.prazoCorrecao,
    '7.2': comp.prazoDisputa,
  };
  return CLAUSULAS_CONTRATO.map((t) => {
    if (/^\d+\.\s/.test(t)) return `<h2>${esc(t)}</h2>`;
    const num = (t.match(/^(\d+\.\d+)/) || [])[1] || '';
    const val = valores[num] ?? '';
    let x = t.replaceAll('[CIDADE/UF]', prestadora.cidade || '[CIDADE/UF]');
    x = x
      .replaceAll('[___] dias úteis', val ? `${val} dias úteis` : '[PRAZO PENDENTE] dias úteis')
      .replaceAll('[___] anos', val ? `${val} anos` : '[PRAZO PENDENTE] anos');
    const m = x.match(/^(\d+\.\d+)\s+/);
    return m ? `<p class="longP clause"><b class="clauseNum">${m[1]}</b><span>${esc(x.slice(m[0].length))}</span></p>` : `<p class="longP">${esc(x)}</p>`;
  }).join('');
}

function textoPagamentoHtml(lead: Lead) {
  const pg = normalizarPagamento(lead.pagamento);
  return pg ? esc(resumoPagamentoTexto(pg)) : falta('condição de pagamento');
}

/** Monta o documento completo (HTML pronto para imprimir/salvar em PDF). */
export function montarHtml(o: OpcoesHtml): string {
  const { tipo, lead, prestadora, comp, logoUrl } = o;
  const cad = lead.cadastro ?? {};
  const info = TIPOS_DOC.find((t) => t.id === tipo)!;
  const mensal = resumoMensalidadeTexto(lead.mensalidade);
  let corpo = '';

  if (tipo === 'proposta') {
    corpo = `${titulo('Proposta comercial', cad.servico || 'Projeto personalizado', info.minuta)}
<p class="intro">Proposta de solução tecnológica da Nexa Lab para ${ou(cad.nomeCompleto, 'nome do cliente')}.</p>
<h2>01 · Objetivo</h2><p>${ou(lead.descricao === '—' ? '' : lead.descricao, 'objetivo')}</p>
<h2>02 · O que será entregue</h2>${lista(comp.entregas)}
${comp.exclusoes ? `<p><b>Não incluído:</b> ${esc(comp.exclusoes)}</p>` : ''}
<h2>03 · Prazo e investimento</h2><div class="invest"><div class="investMain"><span class="investLabel">Investimento</span><p class="amount">${lead.valor != null ? dinheiro(lead.valor) : falta('valor')}</p>${mensal ? `<p><b>Mensalidade:</b> ${esc(dinheiro(lead.mensalidade?.valor ?? 0))}</p>` : ''}</div><div class="investTerms"><p><b>Prazo:</b> ${ou(cad.prazo, 'prazo de entrega')} após o início acordado.</p><p><b>Pagamento:</b> ${textoPagamentoHtml(lead)}</p><p><b>Suporte:</b> ${comp.suporte ? esc(comp.suporte) : 'Conforme contrato'}</p></div></div>
<p><b>Validade:</b> ${ou(comp.validade, 'validade')} dias. Esta proposta descreve condições comerciais; contratação e início dependem de aceite expresso e formalização dos documentos aplicáveis.</p>
<p class="importanttext">Mudanças no escopo, integrações ou serviços externos não previstos serão previamente negociados.</p>`;
  }

  if (tipo === 'contrato') {
    corpo = `${titulo('Contrato-base de desenvolvimento', 'Documento 1 · Desenvolvimento tecnológico sob encomenda', info.minuta)}${partes(o, false)}<p>As partes ajustam as seguintes condições gerais, complementadas pela Ordem de Serviço e pelos anexos selecionados.</p><div>${clausulas(comp, prestadora)}</div>${assinaturas(o)}`;
  }

  if (tipo === 'os') {
    corpo = `${titulo('Ordem de Serviço e escopo', 'Documento 2 · Condições específicas', info.minuta)}${partes(o, true)}
<table class="docTable"><tr><th>Item</th><th>O que foi acordado</th></tr>
<tr><td>Projeto e objetivo</td><td><b>${ou(cad.servico, 'serviço contratado')}</b><br>${ou(lead.descricao === '—' ? '' : lead.descricao, 'objetivo')}</td></tr>
<tr><td>Modalidade</td><td>Desenvolvimento sob encomenda</td></tr>
<tr><td>Entregas</td><td>${lista(comp.entregas)}</td></tr>
<tr><td>Exclusões</td><td>${comp.exclusoes ? esc(comp.exclusoes) : 'Nenhuma exclusão adicional declarada'}</td></tr>
<tr><td>Prazo e validação</td><td>${ou(cad.prazo, 'prazo de entrega')}; ${ou(comp.prazoValidacao, 'dias para testar')} dias úteis para testar e comunicar defeitos em relação ao escopo.</td></tr>
<tr><td>Preço e pagamento</td><td>${lead.valor != null ? dinheiro(lead.valor) : falta('valor')}; ${textoPagamentoHtml(lead)}</td></tr>
${mensal ? `<tr><td>Mensalidade</td><td>${esc(mensal)}${lead.mensalidade?.descricao ? ` · ${esc(lead.mensalidade.descricao)}` : ''}</td></tr>` : ''}
<tr><td>Correções e suporte</td><td>Até ${ou(comp.prazoDefeitos, 'dias para corrigir defeitos')} dias para defeitos do escopo; ${comp.suporte ? esc(comp.suporte) : 'Sem suporte recorrente contratado'}.</td></tr>
<tr><td>Direitos sobre o software</td><td>Conforme condições do contrato-base e acordo de direitos por escrito antes do desenvolvimento.</td></tr>
</table><p class="importanttext">Serviços não descritos nesta OS dependem de aprovação de novo escopo, preço e prazo. Esta OS integra o contrato principal.</p>${assinaturas(o)}`;
  }

  if (tipo === 'recibo') {
    const c: Cobranca | undefined = cobrancasDoLead(lead).find((x) => x.chave === comp.cobrancaRecibo && x.pago);
    corpo = `${titulo('Recibo', c ? c.rotulo : 'Pagamento', false)}
<div class="recibo"><p class="amount">${c ? dinheiro(c.valor) : falta('pagamento')}</p>
<p>Recebi de ${ou(cad.nomeCompleto, 'nome do cliente')}, CPF/CNPJ ${ou(cad.documento, 'CPF/CNPJ')}, a importância acima, referente a ${c ? esc(c.rotulo.toLowerCase()) : falta('referência')}${cad.servico ? ` do serviço ${esc(cad.servico)}` : ''}, paga em ${c?.pagoEm ? dataBr(c.pagoEm) : falta('data do pagamento')}${c?.forma ? ` por ${esc(FORMAS_PAGAMENTO[c.forma])}` : ''}.</p>
<p>${ou(prestadora.cidade, 'cidade/UF')}, ${new Date().toLocaleDateString('pt-BR')}.</p></div>
<div class="signature"><div>${ou(prestadora.nome, 'nome da prestadora')}<br>CPF ${ou(prestadora.cpf, 'CPF da prestadora')} · Nexa Lab</div></div>`;
  }

  if (tipo === 'ficha') {
    const l = (rotulo: string, v?: string | null) => `<tr><td>${esc(rotulo)}</td><td>${vazio(v) ? '<span class="empty">[A PREENCHER]</span>' : esc(v)}</td></tr>`;
    corpo = `${titulo('Ficha de dados', lead.empresa, false)}
<table class="docTable">
${l('Nome completo ou razão social', cad.nomeCompleto)}${l('CPF ou CNPJ', cad.documento)}${l('Quem assina', cad.assinante)}${l('Endereço completo', cad.endereco)}
${l('Serviço contratado', cad.servico)}${l('Prazo de entrega', cad.prazo)}${l('E-mail', lead.email)}${l('Telefone', lead.telefone)}
${l('Valor', lead.valor != null ? dinheiro(lead.valor) : '')}${l('Interesse', lead.descricao === '—' ? '' : lead.descricao)}${l('Responsável na Nexa Lab', lead.responsavel)}
</table><h2>Pagamento</h2><p>${linhasPagamento(lead).map(esc).join('<br>')}</p>`;
  }

  if (tipo === 'aditivo') {
    corpo = `${titulo('Aditivo contratual', 'Modelo pendente', true)}<p class="importanttext">O modelo de aditivo ainda não existe. Envie o texto aprovado para que ele seja incluído.</p>`;
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(info.nome)} – ${esc(cad.nomeCompleto || lead.empresa)}</title><style>${CSS}</style></head><body><div class="page">${cabecalho(logoUrl)}${corpo}${rodape(info.minuta)}</div></body></html>`;
}
