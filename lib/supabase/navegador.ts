'use client';

// ============================================
// SUPABASE NO NAVEGADOR (usa só a chave PUBLICÁVEL)
// ============================================
// Para login e leituras permitidas pelas regras do banco (RLS).
// Nunca recebe a chave secreta.
// ============================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configPublica } from './config';

let cliente: SupabaseClient | null = null;

export function supabaseNavegador(): SupabaseClient {
  if (cliente) return cliente;
  const { url, chavePublica } = configPublica();
  cliente = createClient(url, chavePublica);
  return cliente;
}
