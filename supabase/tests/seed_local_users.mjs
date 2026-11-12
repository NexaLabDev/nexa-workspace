const BASE = process.env.SUPABASE_URL || 'http://127.0.0.1:54621';
const SVC =
  process.env.SUPABASE_SECRET_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const headers = {
  apikey: SVC,
  Authorization: `Bearer ${SVC}`,
  'Content-Type': 'application/json',
};

async function listUsers() {
  const r = await fetch(`${BASE}/auth/v1/admin/users?page=1&per_page=50`, { headers });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j.users || [];
}

async function upsertUser({ email, password, nome }) {
  const users = await listUsers();
  const existente = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (existente) {
    const r = await fetch(`${BASE}/auth/v1/admin/users/${existente.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password, email_confirm: true, user_metadata: { nome } }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`update ${email}: ${JSON.stringify(j)}`);
    return j;
  }
  const r = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { nome } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create ${email}: ${JSON.stringify(j)}`);
  return j;
}

const contas = [
  { email: 'admin@teste.local', password: 'TesteAdmin!123', nome: 'Admin Teste', papel: 'administrador' },
  { email: 'gestor@teste.local', password: 'TesteGestor!123', nome: 'Gestor Teste', papel: 'gestor' },
  { email: 'colab@teste.local', password: 'TesteColab!123', nome: 'Colab Teste', papel: 'colaborador' },
  { email: 'viewer@teste.local', password: 'TesteViewer!123', nome: 'Viewer Teste', papel: 'visualizador' },
  { email: 'intruso@teste.local', password: 'TesteIntruso!123', nome: 'Intruso', papel: null },
];

for (const c of contas) {
  const u = await upsertUser(c);
  console.log('auth', c.email, u.id);
}

console.log('OK seed auth users');
