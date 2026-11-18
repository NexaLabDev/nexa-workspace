'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

export type EventoNexa = {
  id: string;
  tipo: string;
  titulo: string;
  detalhe: string;
  rota: string;
  criado_em: string;
  lida_em: string | null;
};

export function useEventosNexa() {
  const [lista, definir] = useState<EventoNexa[]>([]);
  const [erro, definirErro] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      const { data, error } = await supabaseNavegador()
        .from('eventos_notificacao')
        .select('id,tipo,titulo,detalhe,rota,criado_em,lida_em')
        .order('criado_em', { ascending: false })
        .limit(80);
      if (error) throw error;
      definir((data ?? []) as EventoNexa[]);
      definirErro(false);
    } catch { definirErro(true); }
  }, []);

  useEffect(() => {
    void atualizar();
    const timer = window.setInterval(() => {
      if (!document.hidden) void atualizar();
    }, 20_000);
    const voltar = () => { if (!document.hidden) void atualizar(); };
    window.addEventListener('focus', voltar);
    document.addEventListener('visibilitychange', voltar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', voltar);
      document.removeEventListener('visibilitychange', voltar);
    };
  }, [atualizar]);

  const naoLidas = useMemo(() => lista.filter((evento) => !evento.lida_em), [lista]);

  const marcarLidas = useCallback(async (ids: string[]) => {
    const filtrados = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
    if (!filtrados.length) return;
    const agora = new Date().toISOString();
    definir((prev) => prev.map((e) => filtrados.includes(e.id) ? { ...e, lida_em: agora } : e));
    const { error } = await supabaseNavegador().from('eventos_notificacao')
      .update({ lida_em: agora }).in('id', filtrados);
    if (error) { definirErro(true); await atualizar(); }
  }, [atualizar]);

  return { lista, naoLidas, erro, atualizar, marcarLidas };
}
