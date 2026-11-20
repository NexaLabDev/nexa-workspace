'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BrainCircuit, Plus, SendHorizontal, MessageSquareText, Trash2, Menu, X, Copy, Check, ShieldCheck, Sparkles, LoaderCircle, Paperclip, Mic, Square } from 'lucide-react';
import s from './nexa-chat.module.css';

type Chat = { id:string; titulo:string; atualizado_em:string };
type Mensagem = { id:string; chat_id:string; papel:'usuario'|'assistente'; texto:string; criado_em:string };
type Resposta = { chat?:Chat; usuario?:Mensagem; assistente?:Mensagem; erro?:string; chatId?:string; configurado?:boolean };
const sugestoes = [
  { titulo:'Precificar um projeto', pergunta:'Quero precificar um projeto personalizado. Me ajude a levantar as horas, os gastos e a margem antes de calcular o valor.' },
  { titulo:'Automação simples', pergunta:'Vou criar uma automação simples. Quais custos e riscos preciso considerar para definir o valor da implementação e do suporte?' },
  { titulo:'Revisar meus preços', pergunta:'Analise meus custos cadastrados e os orçamentos recentes. Onde posso melhorar a lucratividade da Nexa?' },
  { titulo:'Analisar uma objeção', pergunta:'Quero analisar uma objeção de cliente. Vou colar um trecho da conversa, sem dados pessoais, e preciso de uma resposta comercial melhor.' },
];
const hora = (v:string) => {
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
};
const dataChat=(v:string) => {
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
};
export default function NexaChat() {
  const [conversas,setConversas]=useState<Chat[]>([]);
  const [selecionada,setSelecionada]=useState<string|null>(null);
  const [mensagens,setMensagens]=useState<Mensagem[]>([]);
  const [texto,setTexto]=useState('');
  const [carregando,setCarregando]=useState(true);
  const [carregandoMensagens,setCarregandoMensagens]=useState(false);
  const [enviando,setEnviando]=useState(false);
  const [erro,setErro]=useState('');
  const [menu,setMenu]=useState(false);
  const [copiado,setCopiado]=useState<string|null>(null);
  const [arquivo,setArquivo]=useState<File|null>(null);
  const [gravando,setGravando]=useState(false);
  const [consumoMes,setConsumoMes]=useState<number|null>(null);
  const [ultimoConsumo,setUltimoConsumo]=useState<number|null>(null);
  const seletorArquivo=useRef<HTMLInputElement>(null);
  const gravador=useRef<MediaRecorder|null>(null);
  const streamAudio=useRef<MediaStream|null>(null);
  const inicioGravacao=useRef(0);
  const duracaoAudio=useRef(0);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const fim=useRef<HTMLDivElement>(null);
  const ativo=useRef(true);
  useEffect(()=>()=>{streamAudio.current?.getTracks().forEach(t=>t.stop());},[]);
  async function alternarGravacao() {
    if(gravando){gravador.current?.stop();setGravando(false);return;}
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined'){
      setErro('Este navegador não suporta gravação de áudio. Você pode anexar um arquivo de áudio.');return;
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      streamAudio.current=stream;
      const mime=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':
        MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'';
      const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      const partes:Blob[]=[];
      rec.ondataavailable=e=>{if(e.data.size)partes.push(e.data);};
      rec.onstop=()=>{
        stream.getTracks().forEach(t=>t.stop());streamAudio.current=null;
        const tipo=rec.mimeType.includes('mp4')?'audio/mp4':'audio/webm';
        const ext=tipo==='audio/mp4'?'m4a':'webm';
        const blob=new Blob(partes,{type:tipo});
        if(blob.size>3*1024*1024){setErro('Áudio acima de 3 MB. Grave uma mensagem mais curta.');return;}
        if(blob.size)setArquivo(new File([blob],'audio-nexa.'+ext,{type:tipo}));
        duracaoAudio.current=Math.max(1,Math.round((Date.now()-inicioGravacao.current)/1000));
      };
      gravador.current=rec;inicioGravacao.current=Date.now();duracaoAudio.current=0;
      setArquivo(null);setErro('');rec.start();setGravando(true);
    }catch{setErro('Não foi possível acessar o microfone. Verifique a permissão do navegador.');}
  }
  function selecionarArquivo(f:File|null) {
    if(!f)return;
    if(f.size>3*1024*1024){setErro('O arquivo precisa ter no máximo 3 MB nesta versão.');return;}
    setArquivo(f);duracaoAudio.current=0;setErro('');
  }


  useEffect(()=>{
    ativo.current=true;
    const iniciar=async()=>{
      try {
        const resposta=await fetch('/api/intelligence/chat',{cache:'no-store'});
        const dados=await resposta.json() as {conversas?:Chat[];erro?:string;usoMesUSD?:number};
        if(!ativo.current)return;
        if(!resposta.ok)throw new Error(dados.erro||'Não foi possível consultar o histórico.');
        const lista=Array.isArray(dados.conversas)?dados.conversas:[];
        if(typeof dados.usoMesUSD==='number')setConsumoMes(dados.usoMesUSD);
        setConversas(lista);
        if(lista.length)setSelecionada(lista[0].id);
      }catch(e){
        if(ativo.current)setErro(e instanceof Error?e.message:'Falha ao carregar o histórico.');
      }finally{
        if(ativo.current)setCarregando(false);
      }
    };
    void iniciar();
    return()=>{ativo.current=false;};
  },[]);
  useEffect(()=>{
    if(!selecionada){setMensagens([]);setCarregandoMensagens(false);return;}
    let valid=true;
    setCarregandoMensagens(true);
    setMensagens([]);
    const carregar=async()=>{
      try {
        const resposta=await fetch('/api/intelligence/chat?chatId='+encodeURIComponent(selecionada),{cache:'no-store'});
        const dados=await resposta.json() as {mensagens?:Mensagem[];erro?:string};
        if(!valid)return;
        if(!resposta.ok)throw new Error(dados.erro||'Não foi possível carregar as mensagens.');
        setMensagens(Array.isArray(dados.mensagens)?dados.mensagens:[]);
      }catch(e){
        if(valid)setErro(e instanceof Error?e.message:'Falha ao consultar as mensagens.');
      }finally{
        if(valid)setCarregandoMensagens(false);
      }
    };
    void carregar();
    return()=>{valid=false;};
  },[selecionada]);
  useEffect(()=>{
    const el=fim.current;
    if(el && typeof el.scrollIntoView==='function') el.scrollIntoView({behavior:'instant',block:'end'});
  },[mensagens,enviando]);

  function novaConversa() {
    if(enviando)return;
    setSelecionada(null);setMensagens([]);setTexto('');setArquivo(null);setErro('');setMenu(false);
    textarea.current?.focus();
  }
  function abrirConversa(id:string) {
    if(enviando)return;
    setSelecionada(id);setErro('');setMenu(false);
  }
  async function excluirConversa(id:string) {
    if(enviando)return;
    if(!window.confirm('Excluir esta conversa e todo o histórico de mensagens?'))return;

    try {
      const resposta=await fetch('/api/intelligence/chat',{
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({chatId:id}),cache:'no-store',
      });
      const dados=await resposta.json() as {erro?:string};
      if(!resposta.ok)throw new Error(dados.erro||'Não foi possível excluir essa conversa.');
    }catch(e){
      setErro(e instanceof Error?e.message:'Não foi possível excluir essa conversa.');
      return;
    }
    setConversas(x=>x.filter(c=>c.id!==id));
    if(selecionada===id){setSelecionada(null);setMensagens([]);}
  }

  async function enviar() {
    const entrada=texto.trim();
    const anexo=arquivo;
    const conteudo=entrada || (anexo?'Analise este anexo. Pergunte antes de registrar qualquer custo ou informação financeira.':'');
    if(enviando||gravando||carregandoMensagens||conteudo.length<2||conteudo.length>12000)return;
    const temp='temp-'+Date.now();
    const origemChat=selecionada;
    setTexto('');setArquivo(null);setErro('');setEnviando(true);
    setMensagens(m=>[...m,{id:temp,chat_id:origemChat||'',papel:'usuario',
      texto:conteudo+(anexo?'\n[Anexo: '+anexo.name+']':''),criado_em:new Date().toISOString()}]);
    try {
      let options:RequestInit;
      if(anexo){
        const form=new FormData();
        form.set('texto',conteudo);
        if(origemChat)form.set('chatId',origemChat);
        form.set('arquivo',anexo);
        if(duracaoAudio.current)form.set('duracaoAudio',String(duracaoAudio.current));
        options={method:'POST',body:form,cache:'no-store'};
      }else{
        options={method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
          body:JSON.stringify({chatId:origemChat,texto:conteudo})};
      }
      const res=await fetch('/api/intelligence/chat',options);
      const retorno=await res.json() as Resposta & {
        consumo?:{custo_estimado_usd?:number;custo_mes_estimado_usd?:number}
      };
      if(!res.ok||!retorno.chat||!retorno.usuario||!retorno.assistente)
        throw Error(retorno.erro||'Não foi possível receber a resposta.');
      const chat=retorno.chat;
      setMensagens(m=>[...m.filter(x=>x.id!==temp),retorno.usuario as Mensagem,retorno.assistente as Mensagem]);
      setConversas(c=>[chat,...c.filter(x=>x.id!==chat.id)]);
      if(typeof retorno.consumo?.custo_estimado_usd==='number')setUltimoConsumo(retorno.consumo.custo_estimado_usd);
      if(typeof retorno.consumo?.custo_mes_estimado_usd==='number')setConsumoMes(retorno.consumo.custo_mes_estimado_usd);
      duracaoAudio.current=0;
      if(!origemChat)setSelecionada(chat.id);
    }catch(e){
      setMensagens(m=>m.filter(x=>x.id!==temp));
      setTexto(entrada);
      setArquivo(anexo);
      setErro(e instanceof Error?e.message:'Não foi possível enviar a mensagem.');
    }finally{setEnviando(false);}
  }

  function teclado(e:KeyboardEvent<HTMLTextAreaElement>) {
    if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){
      e.preventDefault();void enviar();
    }
  }
  async function copiar(id:string,content:string) {
    try {await navigator.clipboard.writeText(content);setCopiado(id);}
    catch{setErro('Não foi possível copiar a mensagem.');}
  }
  const titulo=conversas.find(x=>x.id===selecionada)?.titulo||'Nova conversa';
  const vazio=mensagens.length===0&&!carregandoMensagens;
  return <section className={s.raiz} aria-label="Chat da Nexa Intelligence">
    <aside className={s.barra + (menu?' '+s.barraAberta:'')} aria-label="Histórico de conversas">
      <div className={s.topoBarra}>
        <span className={s.nomeBarra}><MessageSquareText size={17}/> Conversas</span>
        <button className={s.fechar} onClick={()=>setMenu(false)} aria-label="Fechar histórico"><X size={20}/></button>
      </div>
      <button className={s.novo} onClick={novaConversa} disabled={enviando}><Plus size={17}/> Nova conversa</button>
      <div className={s.lista}>
        {carregando?<p className={s.listaVazia}>Carregando histórico…</p>:
         conversas.length===0?<p className={s.listaVazia}>Suas conversas ficarão aqui.</p>:
         conversas.map(c=><div className={s.item+(selecionada===c.id?' '+s.itemAtivo:'')} key={c.id}>
           <button className={s.itemAbrir} onClick={()=>abrirConversa(c.id)} disabled={enviando}>
             <MessageSquareText size={15}/><span>{c.titulo}</span>
           </button>
           <span className={s.itemData}>{dataChat(c.atualizado_em)}</span>
           <button className={s.itemExcluir} title="Excluir conversa" aria-label={'Excluir '+c.titulo} onClick={()=>void excluirConversa(c.id)} disabled={enviando}><Trash2 size={15}/></button>
         </div>)}
      </div>
      <div className={s.rodapeBarra}><ShieldCheck size={15}/><span>Histórico privado da sua conta</span></div>
    </aside>
    {menu&&<button className={s.fundoMenu} onClick={()=>setMenu(false)} aria-label="Fechar lista de conversas"/>}
    <div className={s.principal}>
      <header className={s.cabecalho}>
        <button className={s.menuMobile} onClick={()=>setMenu(true)} aria-label="Abrir histórico"><Menu size={21}/></button>
        <div className={s.titulos}><strong>{titulo}</strong><span>Consultora da Nexa · custos e projetos por conversa</span></div>
        <button className={s.novaMobile} onClick={novaConversa} aria-label="Nova conversa" disabled={enviando}><Plus size={21}/></button>
      </header>
      <div className={s.mensagens} role="log" aria-live="polite" aria-label="Mensagens da conversa">
        {carregandoMensagens?<div className={s.carregamento}><LoaderCircle size={20} className={s.girando}/> Carregando mensagens…</div>:
        vazio?<div className={s.abertura}>
          <div className={s.marca}><BrainCircuit size={29}/></div>
          <h2>O que vamos resolver hoje?</h2>
          <p>Sou a consultora da Nexa. Podemos conversar sobre seus preços, projetos, custos, automações e atendimentos, com perguntas de acompanhamento.</p>
          <div className={s.sugestoes}>{sugestoes.map(x=><button onClick={()=>{setTexto(x.pergunta);textarea.current?.focus();}} key={x.titulo}><Sparkles size={15}/><span>{x.titulo}</span></button>)}</div>
        </div>:
        <div className={s.troca}>
          {mensagens.map(m=><article key={m.id} className={s.mensagem+' '+(m.papel==='usuario'?s.usuario:s.assistente)}>
            {m.papel==='assistente'&&<div className={s.avatar}><BrainCircuit size={17}/></div>}
            <div className={s.balao}>
              <div className={s.texto}>{m.texto}</div>
              <div className={s.meta}><span>{hora(m.criado_em)}</span>
                {m.papel==='assistente'&&<button onClick={()=>void copiar(m.id,m.texto)} aria-label="Copiar resposta">{copiado===m.id?<Check size={14}/>:<Copy size={14}/>}</button>}
              </div>
            </div>
          </article>)}
          {enviando&&<div className={s.escrevendo}><div className={s.avatar}><BrainCircuit size={17}/></div><div className={s.pontos}><i/><i/><i/></div><span>Preparando resposta…</span></div>}
        </div>}
        <div ref={fim}/>
      </div>

      <div className={s.base}>
        {erro&&<div className={s.erro} role="alert"><span>{erro}</span><button aria-label="Dispensar erro" onClick={()=>setErro('')}><X size={15}/></button></div>}
        {arquivo&&<div className={s.anexoSelecionado}><Paperclip size={15}/><span title={arquivo.name}>{arquivo.name}</span><small>{(arquivo.size/1024/1024).toFixed(2)} MB</small><button type="button" onClick={()=>{setArquivo(null);duracaoAudio.current=0;}} aria-label="Remover anexo"><X size={16}/></button></div>}
        <form className={s.composer} onSubmit={e=>{e.preventDefault();void enviar();}}>
          <textarea ref={textarea} rows={2} maxLength={12000} value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={teclado}
            placeholder="Converse comigo sobre seus gastos, projetos e clientes…" aria-label="Mensagem para a Nexa Intelligence" disabled={enviando||carregandoMensagens||gravando}/>
          <input ref={seletorArquivo} className={s.inputArquivo} type="file"
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.rtf,.mp3,.mp4,.m4a,.ogg,.wav,.flac,.webm"
            onChange={e=>{selecionarArquivo(e.target.files?.[0]||null);e.target.value='';}} />
          <div className={s.composerRodape}>
            <div className={s.acoesAnexo}>
              <button className={s.botaoAnexo} type="button" aria-label="Anexar foto ou documento" title="Anexar foto, áudio ou documento (até 3 MB)" onClick={()=>seletorArquivo.current?.click()} disabled={enviando||gravando}><Paperclip size={18}/></button>
              <button className={s.botaoAnexo+(gravando?' '+s.gravando:'')} type="button"
                aria-label={gravando?'Parar gravação':'Gravar áudio'} title={gravando?'Finalizar áudio':'Gravar áudio'}
                onClick={()=>void alternarGravacao()} disabled={enviando}>{gravando?<Square size={17}/>:<Mic size={18}/>}</button>
              <span>{gravando?'Gravando áudio…':'Enter envia · Shift + Enter quebra linha'}</span>
            </div>
            <button className={s.botaoEnviar} type="submit" aria-label="Enviar mensagem"
              disabled={enviando||gravando||carregandoMensagens||(!texto.trim()&&!arquivo)}>{enviando?<LoaderCircle className={s.girando} size={18}/>:<SendHorizontal size={19}/>}</button>
          </div>
        </form>
        <div className={s.avisoPrivacidade}>
          <span>Fotos, áudios e documentos até 3 MB. O arquivo é processado na hora, não arquivado.</span>
          {consumoMes!==null&&<span title="Estimativa, não cobrança oficial. Não inclui áudio sem duração disponível.">
            OpenAI neste mês: ~US$ {consumoMes.toFixed(3)}
            {ultimoConsumo!==null?' · Última resposta: ~US$ '+ultimoConsumo.toFixed(4):''}
          </span>}
        </div>
      </div>
    </div>
  </section>;
}
