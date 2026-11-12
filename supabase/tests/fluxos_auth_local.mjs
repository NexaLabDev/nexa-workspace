/**
 * Fluxos autenticados no Supabase local (sem dados reais).
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54621';
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login(email, password) {
  const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  assert(!error && data.session, `login ${email}: ${error?.message}`);
  return db;
}

// 1) Login admin
const admin = await login('admin@teste.local', 'TesteAdmin!123');
const { data: ws } = await admin.rpc('workspace_id_atual');
assert(ws, 'admin sem workspace');
console.log('OK login admin', ws);

// 2) Intruso sem vínculo
{
  const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({
    email: 'intruso@teste.local',
    password: 'TesteIntruso!123',
  });
  assert(!error && data.user, `intruso auth: ${error?.message}`);
  const { data: w } = await db.rpc('workspace_id_atual');
  assert(!w, 'intruso obteve workspace');
  console.log('OK intruso sem workspace');
}

// 3) Viewer lê e não grava
const viewer = await login('viewer@teste.local', 'TesteViewer!123');
{
  const { data, error } = await viewer.rpc('ler_registros');
  assert(!error && Array.isArray(data), `viewer ler: ${error?.message}`);
  const { error: e2 } = await viewer.rpc('gravar_registros', {
    p_workspace: ws,
    p_usuario: (await viewer.auth.getUser()).data.user.id,
    p_mudancas: [{ colecao: 'leads', id: 'lead-x', ordem: 0, versao: 0, conteudo: { id: 'lead-x', nome: 'X' } }],
  });
  assert(!!e2, 'viewer conseguiu gravar');
  console.log('OK viewer lê e não grava');
}

// 4) Colab grava lead + projeto e relê (sync)
const colab = await login('colab@teste.local', 'TesteColab!123');
const leadId = `lead-${randomUUID().slice(0, 8)}`;
const projId = `prj-${randomUUID().slice(0, 8)}`;
const codigoPublico = Buffer.from(randomUUID().replace(/-/g, ''), 'hex')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, ''); // 22 chars (16 bytes → base64url)
const agora = new Date().toISOString();
const lead = {
  id: leadId,
  nome: 'Lead Isolado',
  empresa: 'Empresa Teste',
  etapa: 'novo',
  origem: 'site',
  criadoEm: agora,
  atualizadoEm: agora,
};
const projeto = {
  id: projId,
  codigo: 'PRJ-TEST-1',
  codigoPublico,
  servico: 'Projeto Isolado',
  etapa: 'planejamento',
  progresso: 10,
  modoProgresso: 'fase',
  atualizadoEm: agora,
  leadId,
};

{
  const uid = (await colab.auth.getUser()).data.user.id;
  const { error } = await colab.rpc('gravar_registros', {
    p_workspace: ws,
    p_usuario: uid,
    p_mudancas: [
      { colecao: 'leads', id: leadId, ordem: 0, versao: 0, conteudo: lead },
      { colecao: 'projetos', id: projId, ordem: 0, versao: 0, conteudo: projeto },
    ],
  });
  assert(!error, `gravar: ${error?.message}`);
}

{
  const { data, error } = await admin.rpc('ler_registros');
  assert(!error, `admin ler após sync: ${error?.message}`);
  const leads = data.filter((r) => r.colecao === 'leads' && r.id === leadId);
  const projetos = data.filter((r) => r.colecao === 'projetos' && r.id === projId);
  assert(leads.length === 1, 'lead não sincronizou entre sessões');
  assert(projetos.length === 1, 'projeto não sincronizou');
  console.log('OK sync lead/projeto entre colab e admin');
}

// 5) Acompanhamento público (anon)
{
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.rpc('acompanhamento_projeto', { codigo: codigoPublico });
  assert(!error && data, `acompanhamento: ${error?.message}`);
  assert(data.nome === 'Projeto Isolado', 'nome público divergente');
  assert(!('leadId' in (data || {})), 'vazou leadId');
  assert(!JSON.stringify(data).includes('Empresa Teste'), 'vazou empresa');
  console.log('OK acompanhamento público');
}

// 6) Recuperação de senha (dispara e-mail local — só confere aceite da API)
{
  const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.resetPasswordForEmail('colab@teste.local', {
    redirectTo: 'http://127.0.0.1:3000/conta',
  });
  assert(!error, `reset: ${error?.message}`);
  console.log('OK pedido de recuperação de senha');
}

console.log('OK fluxos_auth_local');
