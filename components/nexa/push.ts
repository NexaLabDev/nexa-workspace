'use client';

import { supabaseNavegador } from '@/lib/supabase/navegador';

export const TIPOS_PUSH = [
  { id: 'mensagem', nome: 'Mensagens e conversas' },
  { id: 'lead', nome: 'Novos leads e responsáveis' },
  { id: 'tarefa', nome: 'Tarefas e atribuições' },
  { id: 'movimentacao', nome: 'Mudanças de etapa' },
  { id: 'financeiro', nome: 'Financeiro e vendas' },
  { id: 'documento', nome: 'Documentos' },
] as const;
export type TipoPush = (typeof TIPOS_PUSH)[number]['id'];
export const TIPOS_PADRAO: TipoPush[] = ['mensagem', 'lead', 'tarefa', 'movimentacao', 'financeiro', 'documento'];

export type EstadoPush =
  | { tipo: 'sem-suporte' }
  | { tipo: 'bloqueado' }
  | { tipo: 'desativado' }
  | { tipo: 'ativado'; tipos: TipoPush[] };

const TIPOS = new Set<string>(TIPOS_PADRAO);

export function pushSuportado() {
  return typeof window !== 'undefined' && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
export function normalizarTipos(filtro: string | null): TipoPush[] {
  if (!filtro || filtro === 'todos') return [...TIPOS_PADRAO];
  return filtro.split(',').filter((s): s is TipoPush => TIPOS.has(s));
}
function codificarTipos(tipos: TipoPush[]): string {
  return [...new Set(tipos)].filter((t) => TIPOS.has(t)).join(',');
}
function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function erro(r: Response) {
  const dados = (await r.json().catch(() => null)) as { erro?: string } | null;
  return new Error(dados?.erro ?? 'Não foi possível configurar as notificações.');
}
async function registro() {
  const atual = await navigator.serviceWorker.getRegistration('/');
  return atual ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
export async function lerEstado(): Promise<EstadoPush> {
  if (!pushSuportado()) return { tipo: 'sem-suporte' };
  if (Notification.permission === 'denied') return { tipo: 'bloqueado' };
  const reg = await navigator.serviceWorker.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (!inscricao || Notification.permission !== 'granted') return { tipo: 'desativado' };
  const { data, error } = await supabaseNavegador().from('dispositivos_push')
    .select('filtro').eq('endpoint', inscricao.endpoint).maybeSingle();
  if (error) throw new Error('Não foi possível consultar o dispositivo no Supabase.');
  return data ? { tipo: 'ativado', tipos: normalizarTipos(data.filtro) } : { tipo: 'desativado' };
}
export async function ativarPush(tipos: TipoPush[]): Promise<void> {
  if (!pushSuportado()) throw new Error('Notificações push não são aceitas neste navegador.');
  // Solicitação diretamente dentro do clique (necessário no iPhone).
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão não concedida para este aplicativo.');
  const resposta = await fetch('/api/push/chave', { cache: 'no-store' });
  if (!resposta.ok) throw await erro(resposta);
  const { chave } = await resposta.json() as { chave: string };
  const reg = await registro();
  let insc = await reg.pushManager.getSubscription();
  const antiga = insc?.options.applicationServerKey;
  if (insc && antiga) {
    const a = new Uint8Array(antiga), b = chaveParaBytes(chave);
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      await insc.unsubscribe();
      insc = null;
    }
  }
  insc ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
  const keys = insc.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw new Error('O navegador não informou as chaves de inscrição.');
  const { error } = await supabaseNavegador().from('dispositivos_push').upsert({
    endpoint: insc.endpoint, chaves: { p256dh: keys.p256dh, auth: keys.auth }, filtro: codificarTipos(tipos),
  }, { onConflict: 'workspace_id,perfil_id,endpoint' });
  if (error) throw new Error('Não foi possível salvar este dispositivo: ' + error.message);
}
export async function desativarPush(): Promise<void> {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  if (!insc) return;
  const { error } = await supabaseNavegador().from('dispositivos_push').delete().eq('endpoint', insc.endpoint);
  if (error) throw new Error('Não foi possível desativar os avisos: ' + error.message);
  await insc.unsubscribe();
}
export async function testarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  if (!insc) throw new Error('Ative as notificações neste dispositivo primeiro.');
  const r = await fetch('/api/push/teste', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: insc.endpoint }),
  });
  if (!r.ok) throw await erro(r);
}
