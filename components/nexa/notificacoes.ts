'use client';

// ============================================
// CENTRAL DE NOTIFICAÇÕES (sininho)
// ============================================
// Os avisos de cobrança são calculados aqui, a partir dos leads já sincronizados
// com o Supabase, então aparecem iguais no computador e no celular, sem depender
// de um servidor ligado. Regras (as mesmas de antes):
// - id = cobrança + vencimento + marco (antes-N | hoje | vencida): não se repete;
// - cobrança paga ou com data alterada sai sozinha da central;
// - "lida" é por usuário e fica no banco (tabela avisos_usuario).
// A configuração (dias antes, no dia, vencidas) vale para o workspace todo.
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLeads } from './dados';
import { CHAVES, usePersistido } from './store';
import { cobrancasDoLead, diasAte, hojeIso } from './financeiro';
import { CONFIG_PADRAO, OPCOES_DIAS_ANTES, configValida, marcoPara, type ConfigAvisos } from '@/lib/servidor/notificacoes';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { papel } from './remoto';

export { OPCOES_DIAS_ANTES };
export type { ConfigAvisos };

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

export type EventoNotificacao = {
  id: string;
  tipo: string;
  titulo: string;
  detalhe: string;
  rota: string;
  criado_em: string;
  lida_em: string | null;
};

const EVENTO = 'nexa-workspace:notificacoes';
const CONFIG_VAZIA: Partial<ConfigAvisos> = {};

/** Configuração dos avisos do workspace. Só o administrador altera (o banco confere). */
export function useConfigAvisos(): { config: ConfigAvisos; salvar: (c: ConfigAvisos) => boolean; podeEditar: boolean } {
  const [bruto, definir] = usePersistido<Partial<ConfigAvisos>>(CHAVES.avisos, CONFIG_VAZIA);
  const config = useMemo(() => configValida(bruto) ?? CONFIG_PADRAO, [bruto]);
  return { config, salvar: (c) => definir(c), podeEditar: papel() === 'administrador' };
}

export function useNotificacoes() {
  const [leads] = useLeads();
  const { config } = useConfigAvisos();
  const [lidas, setLidas] = useState<Set<string>>(() => new Set());
  const [servidorOk, setServidorOk] = useState(false);
  const [eventos, setEventos] = useState<EventoNotificacao[]>([]);

  const carregar = useCallback(async () => {
    const banco = supabaseNavegador();
    const [cobrancas, novos] = await Promise.all([
      banco.from('avisos_usuario').select('chave'),
      banco.from('eventos_notificacao')
        .select('id,tipo,titulo,detalhe,rota,criado_em,lida_em')
        .order('criado_em', { ascending: false }).limit(80),
    ]);
    if (!cobrancas.error) {
      setLidas(new Set((cobrancas.data ?? []).map((x: { chave: string }) => x.chave)));
      setServidorOk(true);
    } else setServidorOk(false);
    if (!novos.error) setEventos((novos.data ?? []) as EventoNotificacao[]);
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(() => { if (!document.hidden) void carregar(); }, 30_000);
    const foco = () => carregar();
    window.addEventListener('focus', foco);
    window.addEventListener(EVENTO, foco);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('focus', foco);
      window.removeEventListener(EVENTO, foco);
    };
  }, [carregar]);

  const lista = useMemo<NotificacaoCentral[]>(() => {
    const hoje = hojeIso();
    const saida: NotificacaoCentral[] = [];
    for (const lead of leads) {
      for (const c of cobrancasDoLead(lead, hoje)) {
        if (c.pago || !c.vencimento) continue;
        const marco = marcoPara(diasAte(c.vencimento, hoje), config);
        if (!marco) continue;
        const id = `${c.chave}|${c.vencimento}|${marco}`.slice(0, 600);
        saida.push({
          id,
          chave: c.chave,
          leadId: c.leadId,
          cliente: c.cliente,
          responsavel: c.responsavel,
          rotulo: c.rotulo,
          valor: c.valor,
          vencimento: c.vencimento,
          marco,
          criadaEm: '',
          lida: lidas.has(id),
        });
      }
    }
    return saida.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [leads, config, lidas]);

  const marcarLidas = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setLidas((l) => new Set([...l, ...ids]));
    // "já estava lida" não é erro: ignora duplicadas
    const { error } = await supabaseNavegador()
      .from('avisos_usuario')
      .upsert(ids.map((chave) => ({ chave })), { onConflict: 'workspace_id,perfil_id,chave', ignoreDuplicates: true });
    if (error) setServidorOk(false);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  const marcarEventosLidos = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const agora = new Date().toISOString();
    setEventos((atual) => atual.map((e) => ids.includes(e.id) ? { ...e, lida_em: agora } : e));
    const { error } = await supabaseNavegador().from('eventos_notificacao')
      .update({ lida_em: agora }).in('id', ids).is('lida_em', null);
    if (error) {
      void carregar();
      return;
    }
  }, [carregar]);

  return { lista, eventos, servidorOk, marcarLidas, marcarEventosLidos, recarregar: carregar };
}
