import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { configPublica } from '@/lib/supabase/config';

type Acao = 'ler' | 'criar';

/** Autoriza o usuário pelo vínculo ATIVO e pelo papel no Workspace. */
export async function autorizadoParaConversas(acao: Acao): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const { url, chavePublica } = configPublica();
    const db = createServerClient(url, chavePublica, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* middleware administra a atualização dos cookies */ },
      },
    });
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return false;
    const { data: perfil, error: erroPerfil } = await db.from('perfis')
      .select('papel,ativo')
      .eq('id', user.id)
      .maybeSingle();
    if (erroPerfil || !perfil?.ativo) return false;
    const papel = String(perfil.papel);
    if (acao === 'ler') return ['administrador', 'gestor', 'colaborador', 'visualizador'].includes(papel);
    return ['administrador', 'gestor', 'colaborador'].includes(papel);
  } catch {
    return false;
  }
}

export function configuracaoZapclaw(): { chave: string; numero: string } | null {
  const chave = process.env.ZAPCLAW_API_KEY?.trim() ?? '';
  const numero = process.env.ZAPCLAW_FROM?.replace(/\D/g, '') ?? '';
  if (!chave || !/^\d{10,15}$/.test(numero)) return null;
  return { chave, numero };
}

export type MensagemZapclaw = {
  id: string;
  direction: 'inbound' | 'outbound';
  to: string;
  type: string;
  text: string;
  status: string;
  sentAt: string;
  contactUserId: string | null;
};

type MensagemDaApi = {
  id?: unknown; direction?: unknown; to?: unknown; type?: unknown;
  content?: unknown; status?: unknown; sentAt?: unknown;
  createdAt?: unknown; contactUserId?: unknown;
};

export function normalizarMensagem(m: MensagemDaApi): MensagemZapclaw | null {
  if (typeof m.id !== 'string' || !m.id || typeof m.to !== 'string') return null;
  if (m.direction !== 'inbound' && m.direction !== 'outbound') return null;
  const tipo = typeof m.type === 'string' ? m.type : 'text';
  const texto = typeof m.content === 'string' && m.content.trim()
    ? m.content
    : tipo === 'text' ? '(Mensagem sem texto armazenado)' : '[Mídia: ' + tipo + ']';
  const data = typeof m.sentAt === 'string' ? m.sentAt : typeof m.createdAt === 'string' ? m.createdAt : '';
  return {
    id: m.id,
    direction: m.direction,
    to: m.to,
    type: tipo,
    text: texto.slice(0, 4500),
    status: typeof m.status === 'string' ? m.status : '',
    sentAt: data,
    contactUserId: typeof m.contactUserId === 'string' ? m.contactUserId : null,
  };
}

export async function requisicaoZapclaw(
  caminho: '/send/messages' | '/send/text',
  chave: string,
  opcoes: { params?: URLSearchParams; corpo?: object; idempotencyKey?: string } = {}
): Promise<{ ok: boolean; status: number; dados: Record<string, unknown> }> {
  const url = 'https://api.zapclaw.app/api/v1' + caminho + (opcoes.params ? '?' + opcoes.params.toString() : '');
  const resposta = await fetch(url, {
    method: opcoes.corpo ? 'POST' : 'GET',
    headers: {
      'X-API-Key': chave,
      ...(opcoes.corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(opcoes.idempotencyKey ? { 'Idempotency-Key': opcoes.idempotencyKey } : {}),
    },
    ...(opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(8500),
  });
  // Não retornamos cabeçalhos que possam revelar credenciais e limitamos o JSON retornado.
  const texto = await resposta.text();
  let dados: Record<string, unknown> = {};
  try {
    if (texto.length <= 250_000) {
      const json: unknown = JSON.parse(texto);
      if (json && typeof json === 'object' && !Array.isArray(json)) dados = json as Record<string, unknown>;
    }
  } catch { /* erros HTML não são expostos à interface */ }
  return { ok: resposta.ok, status: resposta.status, dados };
}
