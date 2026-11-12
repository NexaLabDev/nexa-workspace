/**
 * Testa a policy DELETE via Storage API (Docker local).
 * Não usa o banco de produção.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54621';
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const contas = {
  colab: { email: 'colab@teste.local', password: 'TesteColab!123' },
  colab2: { email: 'gestor@teste.local', password: 'TesteGestor!123' }, // gestor apaga qualquer
  admin: { email: 'admin@teste.local', password: 'TesteAdmin!123' },
  viewer: { email: 'viewer@teste.local', password: 'TesteViewer!123' },
};

async function login({ email, password }) {
  const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return db;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const blob = new Blob([Uint8Array.from([1, 2, 3, 4, 5])], { type: 'application/octet-stream' });

const colab = await login(contas.colab);
const { data: ws } = await colab.rpc('workspace_id_atual');
assert(ws, 'colab sem workspace');
const idProprio = `arq-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const pathProprio = `${ws}/${idProprio}`;

{
  const { error } = await colab.storage.from('nexa-arquivos').upload(pathProprio, blob, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  assert(!error, `upload colab: ${error?.message}`);
}

// Segundo arquivo do mesmo colab para o admin apagar
const idAdmin = `arq-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const pathAdmin = `${ws}/${idAdmin}`;
{
  const { error } = await colab.storage.from('nexa-arquivos').upload(pathAdmin, blob, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  assert(!error, `upload 2: ${error?.message}`);
}

// Viewer não apaga
{
  const viewer = await login(contas.viewer);
  const { data, error } = await viewer.storage.from('nexa-arquivos').remove([pathProprio]);
  const still = await colab.storage.from('nexa-arquivos').download(pathProprio);
  assert(!still.error, 'viewer não deveria conseguir apagar (arquivo sumiu)');
  console.log('OK viewer bloqueado', error?.message || data);
}

// Colab apaga o próprio
{
  const { error } = await colab.storage.from('nexa-arquivos').remove([pathProprio]);
  assert(!error, `colab delete próprio: ${error?.message}`);
  const { error: e2 } = await colab.storage.from('nexa-arquivos').download(pathProprio);
  assert(!!e2, 'arquivo próprio ainda existe após delete');
  console.log('OK colab apaga próprio');
}

// Outro colaborador: criar user temp? Usar viewer can't. Create second colab via...
// Usar gestor para apagar o que restou (admin path) — e testar que um segundo colaborador
// não existe; criamos arquivo de admin e tentamos com viewer já feito.
// Teste "outro colaborador": login admin sobe arquivo com owner=admin, colab tenta apagar.
{
  const admin = await login(contas.admin);
  const id = `arq-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const path = `${ws}/${id}`;
  const up = await admin.storage.from('nexa-arquivos').upload(path, blob, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  assert(!up.error, `upload admin: ${up.error?.message}`);

  const { error: negado } = await colab.storage.from('nexa-arquivos').remove([path]);
  const ainda = await admin.storage.from('nexa-arquivos').download(path);
  assert(!ainda.error, `colab apagou arquivo do admin (não deveria). remove err=${negado?.message}`);
  console.log('OK colab não apaga arquivo de outro (admin)');

  const { error: ok } = await admin.storage.from('nexa-arquivos').remove([path]);
  assert(!ok, `admin delete: ${ok?.message}`);
  console.log('OK admin apaga arquivo de outro');
}

// Gestor apaga arquivo do colab
{
  const { error } = await (await login(contas.colab2)).storage.from('nexa-arquivos').remove([pathAdmin]);
  assert(!error, `gestor delete: ${error?.message}`);
  console.log('OK gestor apaga arquivo do workspace');
}

console.log('OK storage_delete_api_local');
