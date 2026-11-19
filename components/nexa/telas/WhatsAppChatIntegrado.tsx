'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, LoaderCircle, RefreshCw, SendHorizontal, UserRound, Paperclip, Mic, Square, X, Image as ImageIcon, Video as VideoIcon, Music2 } from 'lucide-react';
import type { Conversa } from '../dados-exemplo';
import { subirMediaWhatsApp } from '../storage';
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
type TipoAnexo = 'image' | 'video' | 'audio';
type Anexo = { arquivo: File; tipo: TipoAnexo; url: string };
const TIPOS: Record<TipoAnexo, string[]> = {
  image:['image/jpeg','image/png'],
  video:['video/mp4'],
  audio:['audio/mpeg','audio/mp4','audio/ogg','audio/aac','audio/amr'],
};
const EXTENSAO: Record<string,string> = {
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',
  mp4:'video/mp4',mp3:'audio/mpeg',m4a:'audio/mp4',
  ogg:'audio/ogg',oga:'audio/ogg',aac:'audio/aac',amr:'audio/amr',
};
function validarAnexo(original: File): { arquivo: File; tipo: TipoAnexo } {
  const extensao = original.name.split('.').pop()?.toLowerCase() || '';
  const mimeDeclarado = original.type.split(';')[0].toLowerCase();
  const compativel = (m: string) => (Object.keys(TIPOS) as TipoAnexo[]).some(t=>TIPOS[t].includes(m));
  const mime = compativel(mimeDeclarado) ? mimeDeclarado : EXTENSAO[extensao] || '';
  const tipo = (Object.keys(TIPOS) as TipoAnexo[]).find((t) => TIPOS[t].includes(mime));
  if(!tipo)throw Error('Formato não suportado. Use JPG, PNG, MP4, MP3, M4A ou OGG.');
  const maximo = (tipo==='image'?5:16)*1024*1024;
  if(original.size===0 || original.size>maximo)throw Error(tipo==='image'?'Imagem acima de 5 MB.':'Arquivo acima de 16 MB.');
  const arquivo = original.type.split(';')[0].toLowerCase()===mime ? original : new File([original],original.name,{type:mime});
  return { arquivo, tipo };
}

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
  const [anexo, setAnexo] = useState<Anexo|null>(null);
  const [gravando, setGravando] = useState(false);
  const [duracao, setDuracao] = useState(0);
  const seletorArquivo = useRef<HTMLInputElement>(null);
  const gravador = useRef<MediaRecorder|null>(null);
  const microfone = useRef<MediaStream|null>(null);
  const pedacos = useRef<Blob[]>([]);
  const descartarGravacao = useRef(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const historico = useRef<HTMLDivElement>(null);
  const contato = conversa.id.replace(/^zapclaw:/, '');

  function anexar(arquivo: File) {
    try {
      const validado = validarAnexo(arquivo);
      setAnexo({ ...validado, url: URL.createObjectURL(validado.arquivo) });
      setAviso(null);
    } catch (e) {
      setAviso({ tipo:'erro', texto: e instanceof Error ? e.message : 'Arquivo inválido.' });
    }
  }
  useEffect(() => {
    return () => { if(anexo) URL.revokeObjectURL(anexo.url); };
  }, [anexo]);
  useEffect(() => {
    if(!gravando)return;
    const intervalo=window.setInterval(()=>setDuracao(v=>v+1),1000);
    return()=>window.clearInterval(intervalo);
  },[gravando]);
  useEffect(() => () => {
    descartarGravacao.current=true;
    if(gravador.current?.state === 'recording')gravador.current.stop();
    microfone.current?.getTracks().forEach(t=>t.stop());
  }, []);

  async function iniciarAudio() {
    if(!podeResponder || enviando || gravando)return;
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAviso({ tipo:'erro', texto:'Seu navegador não permite gravação. Você ainda pode anexar um arquivo de áudio.' });
      return;
    }
    const formatos=['audio/mp4','audio/mp4;codecs=mp4a.40.2','audio/ogg;codecs=opus'];
    const formato=formatos.find(x=>MediaRecorder.isTypeSupported(x));
    if(!formato){
      setAviso({ tipo:'erro', texto:'Este navegador grava em formato incompatível com o WhatsApp. Anexe um áudio MP3, M4A ou OGG.' });
      return;
    }
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      microfone.current=stream;
      pedacos.current=[];
      descartarGravacao.current=false;
      const rec=new MediaRecorder(stream,{mimeType:formato});
      gravador.current=rec;
      const extensao=formato.startsWith('audio/ogg')?'ogg':'m4a';
      rec.ondataavailable=(ev)=>{if(ev.data.size>0)pedacos.current.push(ev.data);};
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());
        microfone.current=null;
        setGravando(false);
        if(descartarGravacao.current)return;
        const blob=new Blob(pedacos.current,{type:formato});
        if(blob.size>0)anexar(new File([blob],'audio-gravado.'+extensao,{type:formato}));
      };
      rec.start();
      setGravando(true);setDuracao(0);setAviso(null);
    }catch{
      microfone.current?.getTracks().forEach(t=>t.stop());
      microfone.current=null;
      setAviso({ tipo:'erro', texto:'Não foi possível acessar o microfone. Verifique a permissão do navegador.' });
    }
  }
  function finalizarAudio(descartar=false) {
    descartarGravacao.current=descartar;
    const rec=gravador.current;
    if(rec?.state==='recording')rec.stop();
    else setGravando(false);
  }


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
    if (enviando || (!texto.trim() && !anexo) || !podeResponder || gravando) return;
    const mensagem = texto.trim();
    const arquivoSelecionado = anexo;
    if (arquivoSelecionado && arquivoSelecionado.tipo !== 'audio' && mensagem.length > 1024) {
      setAviso({ tipo:'erro', texto:'A legenda pode ter até 1.024 caracteres. Reduza o texto antes de enviar o arquivo.' });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      let resposta: Response;
      if(arquivoSelecionado){
        const id='wa-'+crypto.randomUUID();
        await subirMediaWhatsApp(id,arquivoSelecionado.arquivo);
        resposta=await fetch('/api/zapclaw/media',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            to:contato,arquivoId:id,tipo:arquivoSelecionado.tipo,
            legenda:arquivoSelecionado.tipo==='audio'?'':mensagem,
            idempotencyKey:crypto.randomUUID(),
          }),
        });
      } else {
        resposta=await fetch('/api/zapclaw/send',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({to:contato,text:mensagem,idempotencyKey:crypto.randomUUID()}),
        });
      }
      const dados = await resposta.json() as {
        enviado?: boolean; indeterminado?: boolean; erro?: string; aviso?: string;
      };
      if (!resposta.ok) {
        setAviso({ tipo: 'erro', texto: dados.erro ?? 'Não foi possível enviar a mensagem.' });
      } else if (dados.indeterminado) {
        setAviso({ tipo: 'alerta', texto: dados.aviso ?? 'Entrega não confirmada; confira o histórico antes de reenviar.' });
        if (arquivoSelecionado) setAnexo(null);
        if (!arquivoSelecionado || arquivoSelecionado.tipo !== 'audio') setTexto('');
        onAtualizar();
      } else if (dados.enviado) {
        if(arquivoSelecionado)setAnexo(null);
        if (!arquivoSelecionado || arquivoSelecionado.tipo !== 'audio') setTexto('');
        setAviso({ tipo: 'ok', texto: arquivoSelecionado ? 'Arquivo enviado.' : 'Mensagem enviada.' });
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
        <div className={s.foto} aria-hidden="true"><UserRound size={21} strokeWidth={1.8}/></div>
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
        {anexo && (
          <div className={s.anexoPrevia} aria-label="Arquivo preparado para envio">
            {anexo.tipo==='image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anexo.url} alt="Prévia da foto selecionada" className={s.miniatura}/>
            ) : anexo.tipo==='video' ? (
              <VideoIcon size={21} aria-hidden/>
            ) : <Music2 size={21} aria-hidden/>}
            <span><strong>{anexo.arquivo.name}</strong><small>{(anexo.arquivo.size/1024/1024).toFixed(2)} MB · {anexo.tipo==='image'?'Foto':anexo.tipo==='video'?'Vídeo':'Áudio'}</small></span>
            <button type="button" onClick={()=>setAnexo(null)} disabled={enviando} aria-label="Remover anexo"><X size={18}/></button>
          </div>
        )}
        {gravando && (
          <div className={s.gravacao}>
            <span className={s.pulsoVermelho}/> Gravando áudio · {Math.floor(duracao/60)}:{String(duracao%60).padStart(2,'0')}
            <button type="button" onClick={()=>finalizarAudio(true)} aria-label="Descartar gravação"><X size={18}/></button>
            <button type="button" onClick={()=>finalizarAudio()} aria-label="Parar gravação"><Square size={15}/> Parar</button>
          </div>
        )}
        {limitado && <p className={s.info}>Mostrando as 100 mensagens mais recentes.</p>}
        {!podeResponder && <p className={s.avisoJanela}>Aguarde uma nova mensagem do contato para responder pela API.</p>}
        {aviso && <p className={`${s.avisoEnvio} ${aviso.tipo === 'erro' ? s.erro : aviso.tipo === 'ok' ? s.sucesso : s.alerta}`} role="status">{aviso.texto}</p>}
        <form className={s.formulario} onSubmit={enviar}>
          <div className={s.areaEscrita}>
            <button type="button" className={s.acaoAnexo} onClick={()=>seletorArquivo.current?.click()}
              disabled={!podeResponder||enviando||gravando} aria-label="Anexar foto, vídeo ou áudio" title="Anexar arquivo">
              <Paperclip size={20}/>
            </button>
            <input type="file" ref={seletorArquivo} hidden
              accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/mp4,audio/ogg,audio/aac,audio/amr,.jpg,.jpeg,.png,.mp4,.mp3,.m4a,.ogg,.aac"
              onChange={ev=>{const f=ev.currentTarget.files?.[0];ev.currentTarget.value='';if(f)anexar(f);}}/>
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
              disabled={enviando || !podeResponder || gravando}
            />
            <button type="button" className={s.acaoAnexo} onClick={()=>void iniciarAudio()}
              disabled={!podeResponder||enviando||gravando||!!anexo} aria-label="Gravar áudio" title="Gravar áudio">
              <Mic size={20}/>
            </button>
            <button type="submit" className={s.enviar} aria-label="Enviar mensagem" title="Enviar mensagem" disabled={(!texto.trim() && !anexo) || enviando || !podeResponder || gravando}>
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
