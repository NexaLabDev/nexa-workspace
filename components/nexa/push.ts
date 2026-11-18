'use client';

import { supabaseNavegador } from '@/lib/supabase/navegador';

export type EstadoPush = 'sem-suporte' | 'bloqueado' | 'desativado' | 'ativado';

export function pushSuportado() {
  return typeof window !== 'undefined' &&
    window.isSecureContext && 'serviceWorker' in navigator &&
    'PushManager' in window && 'Notification' in window;
}

async function registro() {
  const atual = await navigator.serviceWorker.getRegistration('/');
  if (atual) return atual;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const buffer = new ArrayBuffer(bin.length);
  const result = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) result[i] = bin.charCodeAt(i);
  return result;
}

export async function lerEstadoPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return 'sem-suporte';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  if (!insc || Notification.permission !== 'granted') return 'desativado';
  const { data, error } = await supabaseNavegador().from('dispositivos_push')
    .select('endpoint').eq('endpoint', insc.endpoint).maybeSingle();
  if (error) throw Error('Não foi possível conferir a inscrição no Supabase.');
  return data ? 'ativado' : 'desativado';
}

export async function ativarPush(): Promise<void> {
  if (!pushSuportado()) throw Error('Este dispositivo não oferece notificações web push.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw Error('As notificações não foram autorizadas neste dispositivo.');
  const chaveReq = await fetch('/api/push/chave', { cache: 'no-store' });
  if (!chaveReq.ok) throw Error('O servidor ainda não disponibilizou a chave pública de notificações.');
  const { chave } = (await chaveReq.json()) as { chave: string };
  const reg = await registro();
  let subs = await reg.pushManager.getSubscription();
  const atual = subs?.options.applicationServerKey;
  const bytes = chaveParaBytes(chave);
  if (subs && atual) {
    const anterior = new Uint8Array(atual);
    if (anterior.length !== bytes.length || anterior.some((v, i) => v !== bytes[i])) {
      await subs.unsubscribe();
      subs = null;
    }
  }
  subs ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const dados = subs.toJSON();
  if (!dados.keys?.p256dh || !dados.keys?.auth) throw Error('Inscrição sem chaves do navegador.');
  const db = supabaseNavegador();
  const inscricao = {
    endpoint: subs.endpoint,
    chaves: { p256dh: dados.keys.p256dh, auth: dados.keys.auth },
    filtro: 'todos',
  };
  // RLS garante vínculo com usuário e workspace autenticados.
  const { error } = await db.from('dispositivos_push').insert(inscricao);
  if (error?.code === '23505') {
    const atualizado = await db.from('dispositivos_push').update({
      chaves: inscricao.chaves, filtro: 'todos',
    }).eq('endpoint', subs.endpoint);
    if (atualizado.error) throw Error('Não foi possível atualizar este dispositivo.');
  } else if (error) {
    throw Error('Não foi possível ativar as notificações: ' + error.message);
  }
}

export async function desativarPush() {
  if (!pushSuportado()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subs = await reg?.pushManager.getSubscription();
  if (!subs) return;
  const { error } = await supabaseNavegador().from('dispositivos_push')
    .delete().eq('endpoint', subs.endpoint);
  if (error) throw Error('Não foi possível desativar no servidor.');
  await subs.unsubscribe();
}

export async function testarPushLocal() {
  if (!pushSuportado() || Notification.permission !== 'granted') throw Error('Ative as notificações primeiro.');
  const reg = await registro();
  await reg.showNotification('Nexa Workspace — teste', {
    body: 'As notificações estão autorizadas neste dispositivo.',
    icon: '/pwa/icon/192',
    badge: '/pwa/icon/192',
    tag: 'nexa-teste-local',
  });
}
