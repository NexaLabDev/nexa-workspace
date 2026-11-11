'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import * as remoto from '@/components/nexa/remoto';
export default function DadosWorkspace({perfil,children}:{perfil:remoto.Identidade;children:React.ReactNode}){
 const [montado,setMontado]=useState(false);
 const estado=useSyncExternalStore(remoto.assinar,remoto.status,()=>'Carregando…');
 useEffect(()=>{remoto.iniciar(perfil);setMontado(true);void remoto.atualizar();
 const foco=()=>void remoto.atualizar(), online=()=>{void remoto.enviar();foco()};
 const timer=setInterval(()=>{if(!document.hidden)foco()},15000);
 const proteger=(e:BeforeUnloadEvent)=>{if(remoto.temPendentes()){e.preventDefault();e.returnValue='';}};
 window.addEventListener('focus',foco);window.addEventListener('online',online);window.addEventListener('beforeunload',proteger);
 return ()=>{clearInterval(timer);window.removeEventListener('focus',foco);window.removeEventListener('online',online);window.removeEventListener('beforeunload',proteger);};
 },[perfil]);
 const pronto=montado&&remoto.disponivel()&&remoto.identidade()?.id===perfil.id&&remoto.identidade()?.workspace_id===perfil.workspace_id;
 return <>{pronto&&children}{(!pronto||estado!=='Salvo')&&<aside role="status" style={{position:'fixed',bottom:12,right:12,padding:12,zIndex:11000,background:'#25282a',borderRadius:8,maxWidth:420}}>{estado} {(/Falha|Conflito|Resolva/.test(estado))&&<><button onClick={()=>{void remoto.enviar();void remoto.atualizar()}}>Tentar novamente</button> {remoto.temPendentes()&&<button onClick={()=>{const u=URL.createObjectURL(new Blob([remoto.copiaPendente()],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='edicao-pendente.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}}>Exportar edição</button>}</>}</aside>}</>;
}
