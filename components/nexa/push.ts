'use client';

// Avisos push no navegador: permissão, inscrição no servidor local, teste e verificação.

export type EstadoPush =
  | { tipo: 'sem-suporte' }
  | { tipo: 'bloqueado' }
  | { tipo: 'desativado' }
  | { tipo: 'ativado'; filtro: string | null };

export type InfoServidor = { ultimaVerificacao: string | null; leadsSincronizadosEm: string | null };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function pushSuportado(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const atual = await navigator.serviceWorker.getRegistration('/');
  if (atual) return atual;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function erroDe(r: Response): Promise<Error> {
  const j = (await r.json().catch(() => null)) as { erro?: string } | null;
  return new Error(j?.erro ?? `Falha (${r.status})`);
}

export async function lerEstado(): Promise<{ estado: EstadoPush; servidor: InfoServidor | null }> {
  if (!pushSuportado()) return { estado: { tipo: 'sem-suporte' }, servidor: null };
  if (Notification.permission === 'denied') return { estado: { tipo: 'bloqueado' }, servidor: null };
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  const url = `/api/push/inscricao${insc ? `?endpoint=${encodeURIComponent(insc.endpoint)}` : ''}`;
  const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
  const info = r?.ok ? ((await r.json()) as { inscrita: boolean; filtro: string | null } & InfoServidor) : null;
  const servidor = info ? { ultimaVerificacao: info.ultimaVerificacao, leadsSincronizadosEm: info.leadsSincronizadosEm } : null;
  if (insc && info?.inscrita && Notification.permission === 'granted') return { estado: { tipo: 'ativado', filtro: info.filtro }, servidor };
  return { estado: { tipo: 'desativado' }, servidor };
}

/** Pede permissão, inscreve no serviço de push do navegador e registra no servidor. */
export async function ativarPush(filtro: string | null): Promise<void> {
  if (!pushSuportado()) throw new Error('Este navegador não aceita notificações push.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão negada. Libere as notificações deste site nas configurações do navegador.');
  const rChave = await fetch('/api/push/chave', { cache: 'no-store' });
  if (!rChave.ok) throw await erroDe(rChave);
  const { chave } = (await rChave.json()) as { chave: string };
  const reg = await registro();
  let insc = await reg.pushManager.getSubscription();
  // Inscrição feita com outra chave (servidor trocou as chaves): refaz
  const chaveAtual = insc?.options.applicationServerKey;
  if (insc && chaveAtual) {
    const atual = new Uint8Array(chaveAtual);
    const nova = chaveParaBytes(chave);
    if (atual.length !== nova.length || atual.some((b, i) => b !== nova[i])) {
      await insc.unsubscribe();
      insc = null;
    }
  }
  insc ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
  const r = await fetch('/api/push/inscricao', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ inscricao: insc.toJSON(), filtro }),
  });
  if (!r.ok) throw await erroDe(r);
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  if (!insc) return;
  await fetch('/api/push/inscricao', { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ endpoint: insc.endpoint }) });
  await insc.unsubscribe();
}

export async function testarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const insc = await reg?.pushManager.getSubscription();
  if (!insc) throw new Error('Ative os avisos primeiro.');
  const r = await fetch('/api/push/teste', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ endpoint: insc.endpoint }) });
  if (!r.ok) throw await erroDe(r);
}

export type ResultadoVerificacao = { verificado: boolean; motivo?: string; enviados: number; falhas: number; removidas: number; ativas: number };

export async function verificarAgora(): Promise<ResultadoVerificacao> {
  const r = await fetch('/api/push/verificar', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
  if (!r.ok) throw await erroDe(r);
  return (await r.json()) as ResultadoVerificacao;
}
