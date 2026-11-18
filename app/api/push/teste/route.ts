import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configPublica } from '@/lib/supabase/config';
import { enviarPush } from '@/lib/servidor/push';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(req:Request) {
 const auth=req.headers.get('authorization')??'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return NextResponse.json({erro:'Faça login.'},{status:401});
 const token=auth.slice(7);
 const cfg=configPublica();
 const db=createClient(cfg.url,cfg.chavePublica,{
  global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}
 });
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return NextResponse.json({erro:'Sessão inválida.'},{status:401});
 const body=await req.json().catch(()=>null) as {endpoint?:unknown}|null;
 if(typeof body?.endpoint!=='string')return NextResponse.json({erro:'Endpoint inválido.'},{status:400});
 const {data,error:erro}=await db.from('dispositivos_push').select('endpoint,chaves')
  .eq('endpoint',body.endpoint).limit(1);
 if(erro)return NextResponse.json({erro:'Não foi possível consultar o aparelho.'},{status:503});
 const d=data?.[0];
 if(!d||!d.chaves?.p256dh||!d.chaves?.auth)
  return NextResponse.json({erro:'Dispositivo não inscrito.'},{status:404});
 const status=await enviarPush({endpoint:d.endpoint,keys:d.chaves},
  {titulo:'Nexa Workspace',corpo:'As notificações estão ativas neste aparelho.',url:'/configuracoes',tag:'teste-push'});
 if(status!=='ok')return NextResponse.json({erro:'Falha no envio de teste.'},{status:502});
 return NextResponse.json({ok:true});
}
