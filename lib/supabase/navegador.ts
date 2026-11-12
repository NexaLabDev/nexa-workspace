'use client';

// ============================================
// SUPABASE NO NAVEGADOR (usa só a chave PUBLICÁVEL)
// ============================================
// Para login e leituras permitidas pelas regras do banco (RLS).
// Nunca recebe a chave secreta.
// ============================================

import { type SupabaseClient } from '@supabase/supabase-js';
import { configPublica } from './config';
import { createBrowserClient } from '@supabase/ssr';

let cliente: SupabaseClient | null = null;
let clienteChave = '';

export function supabaseNavegador(): SupabaseClient {
  const { url, chavePublica } = configPublica();
  const chave = `${url}::${chavePublica}`;
  // Recria se a URL/chave mudou (troca .env.local Docker ↔ cloud sem recarregar módulo antigo).
  if (cliente && clienteChave === chave) return cliente;
  cliente = createBrowserClient(url, chavePublica);
  clienteChave = chave;
  return cliente;
}
