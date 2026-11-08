// Envio de notificações push (Web Push com chaves VAPID do .env.local).

import webpush from 'web-push';
import type { InscricaoPush } from './armazem';

export type AvisoPush = { titulo: string; corpo: string; url: string; tag: string };

export function chavePublica(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return false;
  // O "subject" precisa ser mailto: ou https:. Enquanto o e-mail real não for definido, usa um contato local.
  const sujeito = process.env.VAPID_SUBJECT?.trim() ?? '';
  const valido = /^(mailto:[^\s[\]]+@[^\s[\]]+|https:\/\/\S+)$/.test(sujeito);
  webpush.setVapidDetails(valido ? sujeito : 'mailto:nexa-workspace@localhost', pub, priv);
  configurado = true;
  return true;
}

export function pushConfigurado(): boolean {
  return configurar();
}

/** 'expirada' = o navegador cancelou a inscrição (deve ser apagada). */
export async function enviarPush(insc: InscricaoPush, aviso: AvisoPush): Promise<'ok' | 'expirada' | 'erro'> {
  if (!configurar()) return 'erro';
  try {
    await webpush.sendNotification({ endpoint: insc.endpoint, keys: insc.keys }, JSON.stringify(aviso), { TTL: 60 * 60 * 24, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'expirada';
    console.error('[push] falha ao enviar:', status ?? (e as Error).message);
    return 'erro';
  }
}
