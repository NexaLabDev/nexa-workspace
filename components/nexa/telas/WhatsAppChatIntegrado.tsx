'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCheck, RefreshCw, SendHorizontal } from 'lucide-react';
import type { Conversa, Lead } from '../dados-exemplo';
import { iniciais } from '../util';
import c from './conversas.module.css';

type Props = {
  conversa: Conversa;
  lead: Lead;
  onVoltar: () => void;
  onVerLead: () => void;
  onAtualizar: () => void;
  limitado: boolean;
};

function hora(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function dia(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Sem data' : d.toLocaleDateString('pt-BR');
}

export default function WhatsAppChatIntegrado({ conversa, lead, onVoltar, onVerLead, onAtualizar, limitado }: Props) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const contato = conversa.id.replace(/^zapclaw:/, '');
  const ultimoRecebimento = [...conversa.mensagens].reverse().find((m) => m.de === 'cliente' && Number.isFinite(Date.parse(m.em)));
  const delta = ultimoRecebimento ? Date.now() - Date.parse(ultimoRecebimento.em) : Infinity;
  const podeResponder = delta >= 0 && delta < 24 * 60 * 60 * 1000;

  const grupos = useMemo(() => {
    const lista: Array<{ dia: string; mensagens: Conversa['mensagens'] }> = [];
    for (const m of conversa.mensagens) {
      const d = dia(m.em);
      const atual = lista[lista.length - 1];
      if (atual?.dia === d) atual.mensagens.push(m);
      else lista.push({ dia: d, mensagens: [m] });
    }
    return lista;
  }, [conversa.mensagens]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [conversa.id, conversa.mensagens.length]);

  useEffect(() => {
    setAviso('');
    setTexto('');
  }, [conversa.id]);

  async function enviar(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (enviando || !texto.trim() || !podeResponder) return;
    const mensagem = texto.trim();
    setEnviando(true);
    setAviso('');
    try {
      const resposta = await fetch('/api/zapclaw/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: contato, text: mensagem, idempotencyKey: crypto.randomUUID() }),
      });
      const dados = await resposta.json() as {
        enviado?: boolean; indeterminado?: boolean; erro?: string; aviso?: string;
      };
      if (!resposta.ok) {
        setAviso(dados.erro ?? 'A ZapClaw não confirmou o envio.');
      } else if (dados.indeterminado) {
        setAviso(dados.aviso ?? 'Entrega não confirmada. Confira antes de reenviar.');
        setTexto('');
        onAtualizar();
      } else if (dados.enviado) {
        setTexto('');
        setAviso('Mensagem enviada pelo WhatsApp oficial.');
        onAtualizar();
        campo.current?.focus();
      } else {
        setAviso('Resposta não confirmada. Confira no WhatsApp antes de reenviar.');
      }
    } catch {
      setAviso('Não foi possível confirmar o envio. Confira no celular antes de tentar novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={`${c.coluna} ${c.chat}`} aria-label={`WhatsApp real com ${lead.empresa}`}>
      <header className={c.chatTopo}>
        <button type="button" className={`${c.iconeBtn} ${c.soCelular}`} onClick={onVoltar} aria-label="Voltar à lista">
          <ArrowLeft size={20}/>
        </button>
        <button type="button" className={c.chatQuem} onClick={onVerLead} aria-label="Ver informações do contato">
          <span className={c.avatarGrande} style={{ background: lead.cor }}>{lead.sigla ?? iniciais(lead.empresa)}</span>
          <span><strong>{lead.empresa}</strong><small>WhatsApp oficial · Conectado pela ZapClaw</small></span>
        </button>
        <button type="button" className={c.iconeBtn} onClick={onAtualizar} aria-label="Atualizar mensagens" title="Atualizar">
          <RefreshCw size={20}/>
        </button>
      </header>
      <div className={c.mensagens} aria-live="polite">
        {grupos.map((g) => (
          <div key={g.dia} className={c.grupo}>
            <span className={c.dia}>{g.dia}</span>
            {g.mensagens.map((m) => (
              <div key={m.id} className={`${c.msg} ${m.de === 'equipe' ? c.msgEquipe : c.msgCliente}`}>
                <p>{m.texto}</p>
                <span className={c.hora}>{hora(m.em)}
                  {m.de === 'equipe' && <CheckCheck size={17} strokeWidth={2} aria-label="Mensagem enviada pela API" />}
                </span>
              </div>
            ))}
          </div>
        ))}
        <div ref={fim}/>
      </div>
      <p className={c.aviso}>Conversa real. {limitado ? 'A ZapClaw disponibilizou apenas as 100 mensagens mais recentes.' : 'As respostas são enviadas pela API oficial.'}</p>
      {!podeResponder && <p className={c.erroIntegracao} role="status">Para responder pela API, o contato precisa escrever nas últimas 24 horas.</p>}
      {aviso && <p className={c.avisoEnvio} role="status">{aviso}</p>}
      <form className={c.compositor} onSubmit={enviar}>
        <div className={c.campoMsg} style={{ paddingLeft: 12 }}>
          <textarea ref={campo} rows={1} value={texto} maxLength={4096}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
            placeholder={podeResponder ? 'Digite uma mensagem...' : 'Janela de atendimento encerrada'}
            aria-label="Mensagem real pelo WhatsApp" disabled={enviando || !podeResponder}/>
        </div>
        <button type="submit" className={c.enviar} aria-label="Enviar pelo WhatsApp" disabled={!texto.trim() || enviando || !podeResponder}>
          <SendHorizontal size={22} strokeWidth={2}/>
        </button>
      </form>
    </section>
  );
}
