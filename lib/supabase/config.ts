// ============================================
// CONFIGURAÇÃO DO SUPABASE (chaves novas: sb_publishable_ / sb_secret_)
// ============================================
// - NEXT_PUBLIC_SUPABASE_URL ............ endereço do projeto (pode ir ao navegador)
// - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  chave pública (pode ir ao navegador; o acesso
//                                          aos dados é limitado pelas regras do banco - RLS)
// - SUPABASE_SECRET_KEY ................. chave SECRETA: só no servidor (lib/supabase/servidor.ts).
//                                          Nunca usar em componente de navegador nem em NEXT_PUBLIC_*.
// Este arquivo só lê as variáveis públicas, então pode ser importado pelos dois lados.
// ============================================

export type ConfigPublica = { url: string; chavePublica: string };

/** Lê e confere URL + chave pública. Lança erro claro se faltar algo. */
export function configPublica(): ConfigPublica {
  // Acesso direto (process.env.NOME) para o Next embutir as variáveis públicas no navegador
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const chavePublica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !chavePublica) {
    throw new Error('Supabase sem configuração: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local.');
  }
  // http só é aceito para um Supabase de testes rodando neste computador
  if (!/^https:\/\/\S+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL precisa ser um endereço https.');
  }
  if (chavePublica.startsWith('sb_secret_')) {
    // Proteção: a chave secreta nunca pode ir para uma variável pública
    throw new Error('A chave em NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY é SECRETA (sb_secret_). Troque pela publishable (sb_publishable_) e gere uma nova secret no Supabase.');
  }
  if (!chavePublica.startsWith('sb_publishable_')) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY precisa começar com sb_publishable_.');
  return { url: url.replace(/\/+$/, ''), chavePublica };
}

export function supabaseConfigurado(): boolean {
  try {
    configPublica();
    return true;
  } catch {
    return false;
  }
}
