'use client';
import { useEffect, useState } from 'react';
import { BellRing, BellOff, Send } from 'lucide-react';
import u from './ui.module.css';
import { ativarPush, desativarPush, lerEstado, testarPush, type EstadoPush } from './push';

export default function AlertasDispositivo() {
 const [estado,setEstado]=useState<EstadoPush>({tipo:'desativado'});
 const [ocupado,setOcupado]=useState(false);
 const [aviso,setAviso]=useState('');
 const recarregar=async()=>setEstado(await lerEstado());
 useEffect(()=>{void recarregar()},[]);
 const executar=async(fn:()=>Promise<void>,sucesso:string)=>{
  setOcupado(true);setAviso('');
  try{await fn();await recarregar();setAviso(sucesso)}
  catch(e){setAviso(e instanceof Error?e.message:'Não foi possível alterar as notificações.')}
  finally{setOcupado(false)}
 };
 return (
  <section className={u.painel} id="push-aparelho" aria-labelledby="titulo-push">
   <header className={u.painelTopo}>
    <BellRing size={28} strokeWidth={1.7}/>
    <div>
     <h2 id="titulo-push">Notificações neste aparelho</h2>
     <small>Mensagens, novos leads, tarefas, mudanças de etapa e alertas importantes.</small>
    </div>
   </header>
   <p className={u.nota} style={{marginBottom:14}}>
    Os avisos aparecem no sininho. Para receber alertas com o app fechado,
    ative as notificações deste aparelho.
   </p>
   {estado.tipo==='sem-suporte'?<p role="status">Push não disponível neste modo de abertura.</p>:
    estado.tipo==='bloqueado'?<p role="status">Notificações bloqueadas nas configurações do aparelho.</p>:
     <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      {estado.tipo==='ativado'?<>
       <button type="button" className={u.btnSecundario} disabled={ocupado}
        onClick={()=>void executar(desativarPush,'Notificações desativadas neste aparelho.')}>
        <BellOff size={16}/> Desativar
       </button>
       <button type="button" className={u.btnPrimario} disabled={ocupado}
        onClick={()=>void executar(testarPush,'Notificação de teste enviada.')}>
        <Send size={16}/> Testar envio
       </button>
      </>:
       <button type="button" className={u.btnPrimario} disabled={ocupado}
        onClick={()=>void executar(ativarPush,'Notificações ativadas neste aparelho.')}>
        <BellRing size={16}/> Ativar notificações
       </button>}
     </div>}
   {aviso&&<p className={u.nota} role="status" style={{marginTop:12}}>{aviso}</p>}
  </section>
 );
}
