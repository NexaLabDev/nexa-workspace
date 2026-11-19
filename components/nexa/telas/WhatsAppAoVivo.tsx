'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import s from './WhatsAppAoVivo.module.css';

type Mensagem = {
  id: string;
  direction: 'inbound' | 'outbound';
  to: string;
  type: string;
  text: string;
  status: string;
  sentAt: string;
  contactUserId: string | null;
};
type RespostaLista = {
  configurado?: boolean;
  numero?: string;
  mensagens?: Mensagem[];
  limitado?: boolean;
  erro?: string;
};
type Contato = { telefone: string; mensagens: Mensagem[]; ultima: Mensagem; podeResponder: boolean };

function horario(iso: string) {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function telefoneBonito(numero: string) {
  const n = numero.replace(/\D/g, '');
  if (!n.startsWith('55') || n.length < 12 || n.length > 13) return numero;
  return '+55 (' + n.slice(2, 4) + ') ' + n.slice(4);
}

export default function WhatsAppAoVivo({ onVoltar }: { onVoltar: () => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [numero, setNumero] = useState('');
  const [configurado, setConfigurado] = useState(false);
  const [limitado, setLimitado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [recarregando, setRecarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState('');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setRecarregando(true);
    try {
      const resposta = await fetch('/api/zapclaw/messages', { cache: 'no-store' });
      const dados = await resposta.json() as RespostaLista;
      if (!resposta.ok || !Array.isArray(dados.mensagens)) {
        setErro(dados.erro ?? 'Não foi possível consultar as mensagens.');
        setConfigurado(Boolean(dados.configurado));
        return;
      }
      setMensagens(dados.mensagens);
      setNumero(dados.numero ?? '');
      setLimitado(Boolean(dados.limitado));
      setConfigurado(true);
      setErro('');
    } catch {
      setErro('Sem conexão. Tente atualizar.');
    } finally {
      setCarregando(false);
      setRecarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(true);
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') void carregar(true);
    }, 25000);
    const focou = () => { if (document.visibilityState === 'visible') void carregar(true); };
    window.addEventListener('focus', focou);
    return () => { window.clearInterval(intervalo); window.removeEventListener('focus', focou); };
  }, [carregar]);

  const contatos = useMemo(() => {
    const mapa = new Map<string, Mensagem[]>();
    for (const mensagem of mensagens) {
      if (!mensagem.to) continue;
      const anterior = mapa.get(mensagem.to) ?? [];
      anterior.push(mensagem);
      mapa.set(mensagem.to, anterior);
    }
    return Array.from(mapa.entries()).map(([telefone, itens]): Contato => {
      const ordenadas = [...itens].sort((a, b) =>
        (a.sentAt || '').localeCompare(b.sentAt || '') || a.id.localeCompare(b.id));
      const ultima = ordenadas[ordenadas.length - 1];
      const ultimasRecebidas = ordenadas.filter((m) => m.direction === 'inbound');
      const ultimaRecebida = ultimasRecebidas[ultimasRecebidas.length - 1];
      const idade = ultimaRecebida ? Date.now() - Date.parse(ultimaRecebida.sentAt) : Infinity;
      return {
        telefone, mensagens: ordenadas, ultima,
        podeResponder: Number.isFinite(idade) && idade >= 0 && idade < 24 * 60 * 60 * 1000,
      };
    }).sort((a, b) => (b.ultima.sentAt || '').localeCompare(a.ultima.sentAt || ''));
  }, [mensagens]);

  useEffect(() => {
    if (contatos.length && (!selecionado || !contatos.some((c) => c.telefone === selecionado))) {
      setSelecionado(contatos[0].telefone);
    }
  }, [contatos, selecionado]);

  const conversa = contatos.find((c) => c.telefone === selecionado);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!conversa?.podeResponder || !rascunho.trim() || enviando) return;
    const texto = rascunho.trim();
    setEnviando(true);
    setResultadoEnvio('');
    try {
      const resposta = await fetch('/api/zapclaw/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: conversa.telefone, text: texto,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const dados = await resposta.json() as { enviado?: boolean; indeterminado?: boolean; erro?: string; aviso?: string };
      if (!resposta.ok) {
        setResultadoEnvio(dados.erro ?? 'Envio não realizado. Confira a conexão.');
      } else if (dados.indeterminado) {
        setResultadoEnvio(dados.aviso ?? 'Entrega não confirmada. Não reenvie agora.');
        setRascunho('');
      } else if (dados.enviado) {
        setRascunho('');
        setResultadoEnvio('Mensagem enviada pela API.');
        void carregar(true);
      } else {
        setResultadoEnvio('Confira o histórico antes de tentar novamente.');
      }
    } catch {
      setResultadoEnvio('Não foi possível confirmar o envio. Confira o histórico antes de tentar novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={s.pagina} aria-label="Mensagens reais do WhatsApp">
      <div className={s.topo}>
        <div className={s.topoInfo}>
          <button type="button" className={s.voltar} onClick={onVoltar} aria-label="Voltar às conversas internas">
            <ArrowLeft size={19} />
          </button>
          <span className={s.icone}><MessageCircle size={20} /></span>
          <div><strong>WhatsApp ao vivo</strong><small>ZapClaw · Coexistência oficial</small></div>
        </div>
        <button type="button" className={s.atualizar} onClick={() => void carregar()} disabled={recarregando}>
          <RefreshCw size={16} className={recarregando ? s.girando : ''} /> Atualizar
        </button>
      </div>
      {erro && <div className={s.aviso} role="alert">{erro}</div>}
      {!configurado && !carregando ? (
        <div className={s.estado}>
          <ShieldCheck size={35} />
          <h2>Conexão preparada</h2>
          <p>Para carregar mensagens reais, cadastre <code>ZAPCLAW_API_KEY</code> nas variáveis de ambiente do projeto Nexa Workspace na Vercel.</p>
          <p>A chave nunca deve ser colocada no código ou enviada pelo chat.</p>
        </div>
      ) : (
        <div className={s.corpo}>
          <aside className={s.lista} aria-label="Contatos do WhatsApp">
            <div className={s.listaCabecalho}><strong>Conversas reais</strong><small>{contatos.length} contatos</small></div>
            <div className={s.listaItens}>
              {contatos.map((c) => (
                <button type="button" key={c.telefone}
                  className={s.contato + (selecionado === c.telefone ? ' ' + s.ativo : '')}
                  onClick={() => { setSelecionado(c.telefone); setResultadoEnvio(''); }}>
                  <span className={s.avatar}><MessageCircle size={18}/></span>
                  <span className={s.contatoTexto}>
                    <strong>{telefoneBonito(c.telefone)}</strong>
                    <small>{c.ultima.direction === 'outbound' ? 'Você: ' : ''}{c.ultima.text}</small>
                  </span>
                  <time>{horario(c.ultima.sentAt)}</time>
                </button>
              ))}
              {!carregando && contatos.length === 0 && <p className={s.semContatos}>Ainda não há mensagens na API. Envie uma mensagem de outro WhatsApp para seu número comercial e atualize.</p>}
              {carregando && <p className={s.semContatos}>Carregando mensagens...</p>}
            </div>
          </aside>
          <div className={s.conversa}>
            {conversa ? (
              <>
                <header className={s.chatTopo}>
                  <div><strong>{telefoneBonito(conversa.telefone)}</strong><small>{numero ? 'Recebidas no número ' + telefoneBonito(numero) : 'WhatsApp Business'}</small></div>
                  <span className={s.selo}>{conversa.podeResponder ? 'Janela de atendimento aberta' : 'Somente leitura'}</span>
                </header>
                <div className={s.baloes} aria-live="polite">
                  {conversa.mensagens.map((msg) => (
                    <div className={s.balao + (msg.direction === 'outbound' ? ' ' + s.saida : '')} key={msg.id}>
                      <p>{msg.text}</p>
                      <small>{horario(msg.sentAt)} {msg.direction === 'outbound' && msg.status ? '· ' + msg.status : ''}</small>
                    </div>
                  ))}
                </div>
                <form className={s.compositor} onSubmit={enviar}>
                  {!conversa.podeResponder && <p className={s.restricao}>Para responder pela API, o cliente precisa ter escrito nas últimas 24 horas. Não enviamos templates pagos neste teste.</p>}
                  {resultadoEnvio && <p className={s.retorno} role="status">{resultadoEnvio}</p>}
                  <div className={s.compositorLinha}>
                    <input type="text" value={rascunho} onChange={(e) => setRascunho(e.target.value)}
                      maxLength={4096} placeholder={conversa.podeResponder ? 'Escreva uma resposta...' : 'Aguarde uma mensagem do cliente'}
                      disabled={!conversa.podeResponder || enviando} aria-label="Resposta pelo WhatsApp"/>
                    <button type="submit" disabled={!conversa.podeResponder || enviando || !rascunho.trim()} aria-label="Enviar mensagem pela API">
                      <Send size={18}/>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className={s.estado}><MessageCircle size={32}/><h2>Selecione uma conversa</h2><p>Suas mensagens reais aparecerão aqui após a conexão.</p></div>
            )}
          </div>
        </div>
      )}
      <footer className={s.rodape}>
        <span><span className={s.ponto} /> {configurado ? 'Conectado à API' : 'Aguardando configuração'}</span>
        <span>{limitado ? 'Mostrando somente as 100 mensagens mais recentes' : 'Atualização a cada 25 segundos'}</span>
      </footer>
    </section>
  );
}
