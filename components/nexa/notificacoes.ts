'use client';

// Central de notificações no navegador: lê as notificações geradas pelo servidor
// (/api/notificacoes), atualiza a cada minuto, ao voltar para a aba e logo depois
// que os leads mudam. Se o servidor não responder, quem usa decide o plano B.

import { useCallback, useEffect, useState } from 'react';
import { useLeads } from './dados';

export type NotificacaoCentral = {
  id: string;
  chave: string;
  leadId: string;
  cliente: string;
  responsavel?: string;
  rotulo: string;
  valor: number;
  vencimento: string;
  marco: string;
  criadaEm: string;
  lida?: boolean;
};

export type ConfigAvisos = { diasAntes: number[]; noDia: boolean; vencidas: boolean };
export const OPCOES_DIAS_ANTES = [1, 2, 3, 5, 7, 10, 15];

const EVENTO = 'nexa-workspace:notificacoes';

export function useNotificacoes() {
  const [leads] = useLeads();
  const [lista, setLista] = useState<NotificacaoCentral[]>([]);
  const [servidorOk, setServidorOk] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificacoes', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { notificacoes: NotificacaoCentral[] };
      setLista(j.notificacoes ?? []);
      setServidorOk(true);
    } catch {
      setServidorOk(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 60_000);
    const foco = () => carregar();
    window.addEventListener('focus', foco);
    window.addEventListener(EVENTO, foco);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', foco);
      window.removeEventListener(EVENTO, foco);
    };
  }, [carregar]);

  // Leads mudaram (ex.: parcela paga): o sincronizador envia em ~1,5 s; recarrega depois disso
  useEffect(() => {
    const t = window.setTimeout(carregar, 2500);
    return () => window.clearTimeout(t);
  }, [leads, carregar]);

  const marcarLidas = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      setLista((l) => l.map((n) => (ids.includes(n.id) ? { ...n, lida: true } : n)));
      await fetch('/api/notificacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'lidas', ids }) }).catch(() => undefined);
      window.dispatchEvent(new Event(EVENTO));
    },
    []
  );

  return { lista, servidorOk, marcarLidas, recarregar: carregar };
}

export async function lerConfigAvisos(): Promise<ConfigAvisos> {
  const r = await fetch('/api/avisos/config', { cache: 'no-store' });
  if (!r.ok) throw new Error('Não foi possível ler a configuração dos avisos.');
  return ((await r.json()) as { config: ConfigAvisos }).config;
}

export async function salvarConfigAvisos(cfg: ConfigAvisos): Promise<ConfigAvisos> {
  const r = await fetch('/api/avisos/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
  if (!r.ok) throw new Error('Não foi possível salvar a configuração dos avisos.');
  window.dispatchEvent(new Event(EVENTO));
  return ((await r.json()) as { config: ConfigAvisos }).config;
}
