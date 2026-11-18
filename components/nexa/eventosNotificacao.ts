'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

export type EventoNotificacao={
 id:string;chave:string;tipo:'mensagem'|'lead'|'tarefa'|'movimentacao'|'financeiro'|'documento';
 titulo:string;detalhe:string;rota:string;criado_em:string;lida_em:string|null;
};
const CANAL='nexa-alertas:atualizar';

export function useEventosNotificacao(){
 const [lista,setLista]=useState<EventoNotificacao[]>([]);
 const [disponivel,setDisponivel]=useState(false);
 const carregar=useCallback(async()=>{
  const db=supabaseNavegador();
  try{
   const {data,error}=await db.from('eventos_notificacao').select(
    'id,chave,tipo,titulo,detalhe,rota,criado_em,lida_em'
   ).order('criado_em',{ascending:false}).limit(50);
   if(error)throw error;
   setLista((data??[]) as EventoNotificacao[]);
   setDisponivel(true);
  }catch{setDisponivel(false)}
 },[]);
 useEffect(()=>{
  let ativo=true;
  void carregar();
  const intervalo=window.setInterval(()=>{if(ativo&&!document.hidden)void carregar()},20000);
  const foco=()=>{if(ativo)void carregar()};
  window.addEventListener('focus',foco);
  window.addEventListener(CANAL,foco);
  const db=supabaseNavegador();
  let channel:ReturnType<typeof db.channel>|null=null;
  void db.auth.getUser().then(({data})=>{
   if(!ativo||!data.user)return;
   channel=db.channel('nexa-eventos-'+data.user.id)
    .on('postgres_changes',{
      event:'INSERT',schema:'public',table:'eventos_notificacao',
      filter:'perfil_id=eq.'+data.user.id
    },()=>{if(ativo)void carregar()}).subscribe();
  }).catch(()=>{});
  return()=>{
   ativo=false;
   window.clearInterval(intervalo);
   window.removeEventListener('focus',foco);
   window.removeEventListener(CANAL,foco);
   if(channel)void db.removeChannel(channel);
  };
 },[carregar]);
 const naoLidas=useMemo(()=>lista.filter(x=>!x.lida_em),[lista]);
 useEffect(()=>{
  const badge=navigator as Navigator & {setAppBadge?:(n:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};
  if(naoLidas.length)void badge.setAppBadge?.(naoLidas.length).catch(()=>{});
  else void badge.clearAppBadge?.().catch(()=>{});
 },[naoLidas.length]);
 const marcarLida=useCallback(async(ids:string[])=>{
  if(!ids.length)return;
  const instante=new Date().toISOString();
  setLista(atual=>atual.map(x=>ids.includes(x.id)?{...x,lida_em:instante}:x));
  const {error}=await supabaseNavegador().from('eventos_notificacao')
    .update({lida_em:instante}).in('id',ids);
  if(error)await carregar();
  window.dispatchEvent(new Event(CANAL));
 },[carregar]);
 return{lista,naoLidas,disponivel,marcarLida,recarregar:carregar};
}
