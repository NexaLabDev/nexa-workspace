// ============================================
// SUPABASE NO SERVIDOR (usa a chave SECRETA)
// ============================================
// Só pode ser importado por código que roda no servidor: rotas da API, agendador,
// scripts de migração. O import de 'server-only' faz o build FALHAR se algum
// componente de navegador tentar importar este arquivo.
// A chave secreta ignora as regras de acesso (RLS): use só onde o próprio
// servidor já validou quem está pedindo e o quê.
// ============================================

import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configPublica } from './config';

let cliente: SupabaseClient | null = null;

function chaveSecreta(): string {
  const chave = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!chave) throw new Error('Supabase sem chave secreta: defina SUPABASE_SECRET_KEY no .env.local (só no servidor).');
  // Nuvem: sb_secret_… · Supabase local (Docker): service_role JWT de demonstração
  if (chave.startsWith('sb_secret_') || chave.startsWith('eyJ')) return chave;
  throw new Error('SUPABASE_SECRET_KEY inválida (use sb_secret_ ou a service_role JWT local).');
}

/** Cliente com acesso total, para uso exclusivo do servidor. */
export function supabaseServidor(): SupabaseClient {
  if (cliente) return cliente;
  const { url } = configPublica();
  cliente = createClient(url, chaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cliente;
}
