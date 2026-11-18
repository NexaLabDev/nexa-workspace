import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { enviarPush } from '@/lib/servidor/push';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function enderecoSeguro(valor:string){
 try{
  const u=new URL(valor);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  const host=u.hostname.toLowerCase();
  return host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||
   host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
 }catch{return false;}
}
type Entrada={id?:unknown;endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown};
 titulo?:unknown;corpo?:unknown;url?:unknown;tag?:unknown};
export async function POST(req:Request){
 const segredo=process.env.NEXA_PUSH_WEBHOOK_SECRET;
 if(!segredo||segredo.length<48)return NextResponse.json({erro:'Push indisponível.'},{status:503});
 const ts=Number(req.headers.get('x-nexa-ts'));
 const assinatura=req.headers.get('x-nexa-sig')??'';
 if(!Number.isSafeInteger(ts)||Math.abs(Date.now()/1000-ts)>120)
  return NextResponse.json({erro:'Assinatura expirada.'},{status:401});
 const raw=await req.text();
 if(raw.length>10000)return NextResponse.json({erro:'Corpo excedido.'},{status:413});
 let x:Entrada;
 try{x=JSON.parse(raw)}catch{return NextResponse.json({erro:'JSON inválido.'},{status:400})}
 if(!x||typeof x.id!=='string'||!/^[0-9a-f-]{36}$/i.test(x.id)||
   typeof x.endpoint!=='string'||!enderecoSeguro(x.endpoint)||
   typeof x.keys?.p256dh!=='string'||typeof x.keys?.auth!=='string'||
   !/^[A-Za-z0-9_-]{40,150}=*$/.test(x.keys.p256dh)||
   !/^[A-Za-z0-9_-]{16,100}=*$/.test(x.keys.auth)||
   typeof x.titulo!=='string'||x.titulo.length>160||
   typeof x.corpo!=='string'||x.corpo.length>300||
   typeof x.url!=='string'||!x.url.startsWith('/')||x.url.startsWith('//')||x.url.length>320||
   typeof x.tag!=='string'||x.tag.length>240)
  return NextResponse.json({erro:'Dados inválidos.'},{status:400});
 const esperado=createHmac('sha256',segredo)
  .update(x.id+'.'+x.endpoint+'.'+ts).digest('hex');
 if(!/^[a-f0-9]{64}$/i.test(assinatura)||
   !timingSafeEqual(Buffer.from(esperado,'hex'),Buffer.from(assinatura,'hex')))
  return NextResponse.json({erro:'Assinatura inválida.'},{status:401});
 const status=await enviarPush({endpoint:x.endpoint,keys:{p256dh:x.keys.p256dh,auth:x.keys.auth}},
  {titulo:x.titulo,corpo:x.corpo,url:x.url,tag:x.tag});
 return NextResponse.json({status},{status:status==='erro'?502:200,headers:{'Cache-Control':'no-store'}});
}
