'use client';

// Envia ao servidor, sempre que mudam (com uma pequena espera para juntar edições):
//  - a lista de leads → o agendador de avisos confere os vencimentos;
//  - a versão PÚBLICA dos projetos com link → a página permanente de acompanhamento.
// Não mostra nada na tela; se o servidor não responder, tenta de novo na próxima mudança.

import { useEffect, useMemo, useRef } from 'react';
import { useLeads, useProjetos } from './dados';
import { retratoPublico } from './acompanhamento';

const ESPERA_MS = 1500;

function useEnviar(url: string, dados: unknown) {
  const ultimoEnviado = useRef<string | null>(null);
  const texto = useMemo(() => JSON.stringify(dados), [dados]);
  useEffect(() => {
    if (texto === ultimoEnviado.current) return;
    const t = window.setTimeout(() => {
      fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: texto, keepalive: texto.length < 60_000 })
        .then((r) => {
          if (r.ok) ultimoEnviado.current = texto;
        })
        .catch(() => {
          /* servidor fora do ar: tenta na próxima mudança */
        });
    }, ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [url, texto]);
}

export default function SincronizarServidor() {
  const [leads] = useLeads();
  const [projetos] = useProjetos();
  const publicos = useMemo(() => projetos.map(retratoPublico).filter(Boolean), [projetos]);
  useEnviar('/api/dados/leads', leads);
  useEnviar('/api/dados/acompanhamento', publicos);
  return null;
}
