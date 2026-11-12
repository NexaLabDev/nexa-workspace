/**
 * Exercita gravação/leitura de estruturas dos módulos (CRM, Kanban, tarefas, financeiro, docs)
 * no banco Docker isolado — sem UI, sem dados reais.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54621';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function id(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
function codigo22() {
  return Buffer.from(randomUUID().replace(/-/g, ''), 'hex')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: loginErr } = await db.auth.signInWithPassword({
  email: 'colab@teste.local',
  password: 'TesteColab!123',
});
assert(!loginErr, loginErr?.message);
const uid = (await db.auth.getUser()).data.user.id;
const { data: ws } = await db.rpc('workspace_id_atual');
const agora = new Date().toISOString();

const leadId = id('lead');
const clienteId = id('cli');
const vendaId = id('vnd');
const projId = id('prj');
const docId = id('doc');
const convId = id('cnv');
const tarefaId = id('tar');

const lead = {
  id: leadId,
  nome: 'Lead Modulo',
  empresa: 'Co Isolada',
  etapa: 'proposta',
  origem: 'indicacao',
  valor: 1500,
  responsavel: 'Colab Teste',
  criadoEm: agora,
  atualizadoEm: agora,
  cobrancas: [
    {
      id: 'cob-1',
      rotulo: 'Entrada',
      valor: 500,
      vencimento: agora.slice(0, 10),
      pago: false,
    },
  ],
};
const cliente = {
  id: clienteId,
  nome: 'Cliente Modulo',
  status: 'Ativo',
  leadId,
  criadoEm: agora,
};
const venda = {
  id: vendaId,
  leadId,
  clienteId,
  valor: 1500,
  fechadaEm: agora.slice(0, 10),
};
const projeto = {
  id: projId,
  codigo: 'PRJ-MOD-1',
  codigoPublico: codigo22(),
  servico: 'Entrega Modulo',
  etapa: 'execucao',
  progresso: 40,
  modoProgresso: 'tarefas',
  leadId,
  clienteId,
  atualizadoEm: agora,
  tarefasProjeto: [
    { id: tarefaId, titulo: 'Tarefa A', status: 'aberta', responsavel: 'Colab Teste', prazo: agora.slice(0, 10) },
  ],
};
const documento = {
  id: docId,
  titulo: 'Contrato Isolado',
  tipo: 'contrato',
  leadId,
  criadoEm: agora,
};
const conversa = {
  id: convId,
  leadId,
  mensagens: [{ id: id('msg'), texto: 'Olá teste', em: agora, autor: 'Colab Teste' }],
};

const { error } = await db.rpc('gravar_registros', {
  p_workspace: ws,
  p_usuario: uid,
  p_mudancas: [
    { colecao: 'leads', id: leadId, ordem: 0, versao: 0, conteudo: lead },
    { colecao: 'clientes', id: clienteId, ordem: 0, versao: 0, conteudo: cliente },
    { colecao: 'vendas', id: vendaId, ordem: 0, versao: 0, conteudo: venda },
    { colecao: 'projetos', id: projId, ordem: 0, versao: 0, conteudo: projeto },
    { colecao: 'documentos', id: docId, ordem: 0, versao: 0, conteudo: documento },
    { colecao: 'conversas', id: convId, ordem: 0, versao: 0, conteudo: conversa },
  ],
});
assert(!error, `gravar módulos: ${error?.message}`);

const admin = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
await admin.auth.signInWithPassword({ email: 'admin@teste.local', password: 'TesteAdmin!123' });
const { data, error: e2 } = await admin.rpc('ler_registros');
assert(!e2, e2?.message);
const by = (c, i) => data.find((r) => r.colecao === c && r.id === i)?.conteudo;
assert(by('leads', leadId)?.cobrancas?.[0]?.valor === 500, 'financeiro/cobrança não persistiu');
assert(by('projetos', projId)?.tarefasProjeto?.[0]?.titulo === 'Tarefa A', 'tarefa não persistiu');
assert(by('documentos', docId)?.titulo === 'Contrato Isolado', 'documento não persistiu');
assert(by('conversas', convId)?.mensagens?.length === 1, 'conversa não persistiu');
assert(by('vendas', vendaId)?.valor === 1500, 'venda não persistiu');
assert(by('clientes', clienteId)?.status === 'Ativo', 'cliente não persistiu');

// Movimentação de lead (etapa)
const lead2 = { ...lead, etapa: 'ganho', atualizadoEm: new Date().toISOString() };
const { error: e3 } = await db.rpc('gravar_registros', {
  p_workspace: ws,
  p_usuario: uid,
  p_mudancas: [{ colecao: 'leads', id: leadId, ordem: 0, versao: 1, conteudo: lead2 }],
});
assert(!e3, `mover lead: ${e3?.message}`);
const { data: d2 } = await admin.rpc('ler_registros');
assert(d2.find((r) => r.id === leadId)?.conteudo?.etapa === 'ganho', 'etapa do lead não atualizou');

const { data: pub } = await createClient(URL, ANON, { auth: { persistSession: false } }).rpc('acompanhamento_projeto', {
  codigo: projeto.codigoPublico,
});
assert(pub?.nome === 'Entrega Modulo', 'acompanhamento do módulo falhou');

console.log('OK modulos_operacionais_local');
