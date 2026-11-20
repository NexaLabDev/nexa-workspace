import { NextResponse } from 'next/server';
import { perfilAtivo, clienteSessao } from '@/lib/supabase/sessao';
import { responderNexa } from '@/lib/nexa/intelligence-chat';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type ChatMensagem = { papel:'usuario'|'assistente'; texto:string };
const chamadas = new Map<string,number[]>();
const headers = { 'Cache-Control':'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST = responderNexa;

export async function GET(req: Request) {
  const perfil = await perfilAtivo();
  if (!perfil || perfil.papel !== 'administrador') {
    return NextResponse.json({erro:'Acesso restrito aos administradores.'},{status:403,headers});
  }
  const db=clienteSessao();
  const chatId=new URL(req.url).searchParams.get('chatId');
  if(chatId) {
    if(!uuid.test(chatId))return NextResponse.json({erro:'Identificador inválido.'},{status:400,headers});
    const {data:chat,error:erroChat}=await db.from('nexa_intelligence_chats')
      .select('id').eq('id',chatId).eq('workspace_id',perfil.workspace_id)
      .eq('usuario_id',perfil.id).maybeSingle();
    if(erroChat||!chat)return NextResponse.json({erro:'Conversa não encontrada.'},{status:404,headers});
    const {data,error}=await db.from('nexa_intelligence_chat_mensagens')
      .select('id,chat_id,papel,texto,criado_em')
      .eq('chat_id',chatId).order('criado_em',{ascending:true}).limit(250);
    if(error)return NextResponse.json({erro:'Falha ao consultar as mensagens.'},{status:503,headers});
    return NextResponse.json({mensagens:data||[]},{headers});
  }
  const {data,error}=await db.from('nexa_intelligence_chats')
    .select('id,titulo,atualizado_em')
    .eq('workspace_id',perfil.workspace_id).eq('usuario_id',perfil.id)
    .order('atualizado_em',{ascending:false}).limit(80);
  if(error)return NextResponse.json({erro:'Falha ao consultar as conversas.'},{status:503,headers});
  const primeiroDia=new Date();
  primeiroDia.setUTCDate(1);
  primeiroDia.setUTCHours(0,0,0,0);
  const {data:uso}=await db.from('nexa_intelligence_consumo')
    .select('custo_estimado_usd')
    .eq('workspace_id',perfil.workspace_id).eq('usuario_id',perfil.id)
    .gte('criado_em',primeiroDia.toISOString()).limit(3000);
  const usoMesUSD=(uso||[]).reduce((s,v)=>s+Number(v.custo_estimado_usd||0),0);
  return NextResponse.json({conversas:data||[],usoMesUSD},{headers});
}

export async function DELETE(req: Request) {
  const perfil=await perfilAtivo();
  if(!perfil||perfil.papel!=='administrador')return NextResponse.json({erro:'Acesso não autorizado.'},{status:403,headers});
  const origem=req.headers.get('origin');
  if(origem) {
    try {if(new URL(origem).host!==new URL(req.url).host)throw Error('origem');}
    catch{return NextResponse.json({erro:'Origem inválida.'},{status:403,headers});}
  }
  if(!(req.headers.get('content-type')||'').includes('application/json'))return NextResponse.json({erro:'Envie JSON.'},{status:415,headers});
  let body:unknown;
  try {body=await req.json();}catch{return NextResponse.json({erro:'JSON inválido.'},{status:400,headers});}
  const chatId=body&&typeof body==='object'&&'chatId' in body?(body as {chatId:unknown}).chatId:null;
  if(typeof chatId!=='string'||!uuid.test(chatId))return NextResponse.json({erro:'Conversa inválida.'},{status:400,headers});
  const db=clienteSessao();
  const {error}=await db.from('nexa_intelligence_chats').delete()
    .eq('id',chatId).eq('workspace_id',perfil.workspace_id).eq('usuario_id',perfil.id);
  if(error)return NextResponse.json({erro:'Falha ao excluir conversa.'},{status:503,headers});
  return NextResponse.json({ok:true},{headers});
}
