'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, LoaderCircle, RefreshCw, SendHorizontal, MessageCircle } from 'lucide-react';
import type { Conversa } from '../dados-exemplo';
import c from './conversas.module.css';
import s from './WhatsAppChatIntegrado.module.css';

type Props = {
  conversa: Conversa;
  onVoltar: () => void;
  onVerLead: () => void;
  onAtualizar: () => void;
  limitado: boolean;
};
type AvisoEnvio = { texto: string; tipo: 'erro' | 'ok' | 'alerta' } | null;

function horario(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function rotuloDia(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sem data';
  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (d.toDateString() === agora.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function numeroLegivel(contato: string) {
  const n = contato.replace(/\D/g, '');
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) {
    const final = n.slice(4);
    return '+55 (' + n.slice(2, 4) + ') ' + (final.length === 9 ? final.slice(0, 5) + '-' + final.slice(5) : final.slice(0, 4) + '-' + final.slice(4));
  }
  return contato;
}

export default function WhatsAppChatIntegrado({ conversa, onVoltar, onVerLead, onAtualizar, limitado }: Props) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoEnvio>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const historico = useRef<HTMLDivElement>(null);
  const contato = conversa.id.replace(/^zapclaw:/, '');

  const recebida = [...conversa.mensagens].reverse().find((m) =>
    m.de === 'cliente' && Number.isFinite(Date.parse(m.em)));
  const delta = recebida ? Date.now() - Date.parse(recebida.em) : Infinity;
  const podeResponder = delta >= 0 && delta < 24 * 60 * 60 * 1000;

  const grupos = useMemo(() => {
    const lista: Array<{ dia: string; mensagens: Conversa['mensagens'] }> = [];
    for (const msg of conversa.mensagens) {
      const rotulo = rotuloDia(msg.em);
      const ultimo = lista[lista.length - 1];
      if (ultimo?.dia === rotulo) ultimo.mensagens.push(msg);
      else lista.push({ dia: rotulo, mensagens: [msg] });
    }
    return lista;
  }, [conversa.mensagens]);

  // Ajusta a altura ao escrever, sem criar barra de rolagem na página inteira.
  useEffect(() => {
    const textarea = campo.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  }, [texto]);

  // Rolagem confinada ao histórico: não desloca os menus nem a barra de escrita.
  useEffect(() => {
    const painel = historico.current;
    if (!painel) return;
    painel.scrollTop = painel.scrollHeight;
  }, [conversa.id, conversa.mensagens.length]);

  useEffect(() => {
    setAviso(null);
    setTexto('');
  }, [conversa.id]);

  async function enviar(ev?: FormEvent<HTMLFormElement>) {
    ev?.preventDefault();
    if (enviando || !texto.trim() || !podeResponder) return;
    const mensagem = texto.trim();
    setEnviando(true);
    setAviso(null);
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
        setAviso({ tipo: 'erro', texto: dados.erro ?? 'Não foi possível enviar a mensagem.' });
      } else if (dados.indeterminado) {
        setAviso({ tipo: 'alerta', texto: dados.aviso ?? 'Entrega não confirmada; confira o histórico antes de reenviar.' });
        setTexto('');
        onAtualizar();
      } else if (dados.enviado) {
        setTexto('');
        setAviso({ tipo: 'ok', texto: 'Mensagem enviada.' });
        onAtualizar();
        campo.current?.focus();
      } else {
        setAviso({ tipo: 'alerta', texto: 'Envio não confirmado. Confira no celular antes de tentar novamente.' });
      }
    } catch {
      setAviso({ tipo: 'alerta', texto: 'Não foi possível confirmar o envio. Confira no celular antes de reenviar.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={`${c.coluna} ${c.chat} ${s.chat}`} aria-label={`Conversa com ${numeroLegivel(contato)}`}>
      <header className={s.cabecalho}>
        <button type="button" className={`${s.acao} ${c.soCelular}`} onClick={onVoltar} aria-label="Voltar às conversas">
          <ArrowLeft size={20} strokeWidth={1.8}/>
        </button>
        <div className={s.foto} aria-hidden="true"><MessageCircle size={21} strokeWidth={1.8}/></div>
        <button type="button" className={s.numero} onClick={onVerLead} title="Ver informações do contato">
          {numeroLegivel(contato)}
        </button>
        <button type="button" className={s.acao} onClick={onAtualizar} aria-label="Atualizar conversa" title="Atualizar mensagens">
          <RefreshCw size={19} strokeWidth={1.8}/>
        </button>
      </header>

      <div className={s.historico} ref={historico} aria-label="Histórico de mensagens" aria-live="polite">
        {grupos.map((grupo) => (
          <div key={grupo.dia} className={s.grupo}>
            <div className={s.dia}><span>{grupo.dia}</span></div>
            {grupo.mensagens.map((m) => (
              <div key={m.id} className={`${s.balao} ${m.de === 'equipe' ? s.enviada : s.recebida}`}>
                <p>{m.texto}</p>
                <span className={s.meta}>
                  <time dateTime={m.em}>{horario(m.em)}</time>
                  {m.de === 'equipe' && <Check size={13} strokeWidth={2} aria-label="Mensagem enviada pela API; confirmação de entrega não disponível"/>}
                </span>
              </div>
            ))}
          </div>
        ))}
        {conversa.mensagens.length === 0 && <p className={s.vazio}>Ainda não há mensagens com esse contato.</p>}
      </div>

      <div className={s.rodape}>
        {limitado && <p className={s.info}>Mostrando as 100 mensagens mais recentes.</p>}
        {!podeResponder && <p className={s.avisoJanela}>Aguarde uma nova mensagem do contato para responder pela API.</p>}
        {aviso && <p className={`${s.avisoEnvio} ${aviso.tipo === 'erro' ? s.erro : aviso.tipo === 'ok' ? s.sucesso : s.alerta}`} role="status">{aviso.texto}</p>}
        <form className={s.formulario} onSubmit={enviar}>
          <div className={s.areaEscrita}>
            <textarea
              ref={campo}
              rows={1}
              value={texto}
              maxLength={4096}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              placeholder={podeResponder ? 'Escreva uma mensagem...' : 'Aguardando mensagem do contato'}
              aria-label="Escreva sua mensagem de WhatsApp"
              disabled={enviando || !podeResponder}
            />
            <button type="submit" className={s.enviar} aria-label="Enviar mensagem" title="Enviar mensagem" disabled={!texto.trim() || enviando || !podeResponder}>
              {enviando ? <LoaderCircle size={19} className={s.carregando}/> : <SendHorizontal size={20} strokeWidth={2}/>}
            </button>
          </div>
          {podeResponder && (
            <div className={s.dicas}>
              <span>Enter envia · Shift + Enter quebra linha</span>
              <span>{texto.length}/4096</span>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
