'use client';
import { supabaseNavegador } from '@/lib/supabase/navegador';
export type EstadoPush={tipo:'sem-suporte'|'bloqueado'|'desativado'|'ativado'};
const db=()=>supabaseNavegador();
function suporte(){return typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;}
async function usuario(){
 const {data,error}=await db().auth.getUser();
 if(error||!data.user)throw Error('Faça login para ativar notificações.');
}
function bytes(b64:string):Uint8Array<ArrayBuffer>{
 const pad='='.repeat((4-b64.length%4)%4);
 const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));
 const a=new Uint8Array(new ArrayBuffer(raw.length));
 for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
 return a;
}
export async function lerEstado():Promise<EstadoPush>{
 if(!suporte())return{tipo:'sem-suporte'};
 if(Notification.permission==='denied')return{tipo:'bloqueado'};
 try{
  await usuario();
  const sw=await navigator.serviceWorker.getRegistration('/');
  const insc=await sw?.pushManager.getSubscription();
  if(!insc)return{tipo:'desativado'};
  const {data,error}=await db().from('dispositivos_push').select('endpoint')
   .eq('endpoint',insc.endpoint).limit(1);
  if(error||!data?.length)return{tipo:'desativado'};
  return{tipo:Notification.permission==='granted'?'ativado':'desativado'};
 }catch{return{tipo:'desativado'}}
}
export async function ativarPush(){
 if(!suporte())throw Error('Este navegador não oferece notificações push.');
 // Pede permissão diretamente no gesto da pessoa, necessário no iPhone.
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Permissão negada nas configurações do aparelho.');
 await usuario();
 const res=await fetch('/api/push/chave',{cache:'no-store'});
 if(!res.ok)throw Error('O envio de notificações não está configurado neste servidor.');
 const {chave}=await res.json() as {chave:string};
 const sw=(await navigator.serviceWorker.getRegistration('/'))||
  (await navigator.serviceWorker.register('/sw.js',{scope:'/'}));
 let insc=await sw.pushManager.getSubscription();
 const key=bytes(chave),current=insc?.options.applicationServerKey;
 if(insc&&current){
  const old=new Uint8Array(current);
  if(old.length!==key.length||old.some((x,i)=>x!==key[i])){await insc.unsubscribe();insc=null;}
 }
 insc??=await sw.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 const sub=insc.toJSON();
 if(!sub.endpoint||!sub.keys?.auth||!sub.keys?.p256dh)
  throw Error('Inscrição do navegador incompleta.');
 const {error}=await db().from('dispositivos_push').upsert({
  endpoint:sub.endpoint,chaves:sub.keys,filtro:'todos'
 },{onConflict:'workspace_id,perfil_id,endpoint'});
 if(error)throw Error('Não foi possível registrar este aparelho: '+error.message);
}
export async function desativarPush(){
 await usuario();
 const sw=await navigator.serviceWorker.getRegistration('/');
 const insc=await sw?.pushManager.getSubscription();
 if(!insc)return;
 const {error}=await db().from('dispositivos_push').delete().eq('endpoint',insc.endpoint);
 if(error)throw Error(error.message);
 await insc.unsubscribe();
}
export async function testarPush(){
 const sw=await navigator.serviceWorker.getRegistration('/');
 const insc=await sw?.pushManager.getSubscription();
 if(!insc)throw Error('Ative notificações antes do teste.');
 const {data:{session}}=await db().auth.getSession();
 if(!session?.access_token)throw Error('Faça login para testar.');
 const res=await fetch('/api/push/teste',{method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
  body:JSON.stringify({endpoint:insc.endpoint})});
 if(!res.ok){const j=await res.json().catch(()=>null);throw Error(j?.erro||'Falha no envio do teste.');}
}
