import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { configPublica } from './config';

export function clienteSessao() {
  const { url, chavePublica } = configPublica();
  const jar = cookies();
  return createServerClient(url, chavePublica, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (lista) => {
      // Server Components apenas leem cookies. O middleware cuida da renovação.
      try { for (const c of lista) jar.set(c.name, c.value, c.options); } catch {}
    },
  } });
}

export async function perfilAtivo() {
  const db = clienteSessao();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db.from('perfis').select('id,workspace_id,email,nome,cargo,papel,ativo').eq('id',user.id).eq('ativo',true).maybeSingle();
  if (error) throw new Error('Não foi possível verificar seu acesso.');
  return data;
}
