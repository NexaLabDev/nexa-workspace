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

export function supabaseNavegador(): SupabaseClient {
  if (cliente) return cliente;
  const { url, chavePublica } = configPublica();
  cliente = createBrowserClient(url, chavePublica);
  return cliente;
}
