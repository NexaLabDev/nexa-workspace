/** Banco de teste 100% local: envia eventos por trigger e verifica RLS/deduplicação. */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
const URL=process.env.SUPABASE_URL??'http://127.0.0.1:54321';
if(!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL))throw Error('Somente Supabase Docker local.');
const ANON=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!ANON)throw Error('Chave pública local ausente');
const assert=(x,m)=>{if(!x)throw Error(m)};
async function entrar(email,password){
 const db=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.signInWithPassword({email,password});
 if(error||!data.user)throw Error('Login fictício falhou: '+email);
 return{db,uid:data.user.id};
}
const admin=await entrar('admin@teste.local','TesteAdmin!123');
const colab=await entrar('colab@teste.local','TesteColab!123');
const viewer=await entrar('viewer@teste.local','TesteViewer!123');
const {data:ws,error:ew}=await colab.db.rpc('workspace_id_atual');
assert(!ew&&ws,'Workspace local não encontrado');
const lid='lead-notif-'+randomUUID().slice(0,9);
async function gravar(colecao,id,conteudo,versao){
 const {error}=await colab.db.rpc('gravar_registros',{
  p_workspace:ws,p_usuario:colab.uid,p_mudancas:[{colecao,id,conteudo,versao,ordem:0}]
 });
 assert(!error,'Falha RPC '+colecao+': '+error?.message);
}
await gravar('leads',lid,{id:lid,empresa:'Somente dados fictícios',etapa:'novo'},0);
const prefix='lead:'+lid+':1';
const {data:avisos,error:ea}=await admin.db.from('eventos_notificacao')
 .select('id,tipo,titulo,chave,perfil_id').eq('chave',prefix);
assert(!ea&&avisos?.length===1,'O admin não recebeu o novo lead');
assert(avisos[0].tipo==='lead','Tipo de evento incorreto');
const {data:proprio}=await colab.db.from('eventos_notificacao')
 .select('id').eq('chave',prefix);
assert(proprio?.length===0,'Ator recebeu push duplicado do próprio lead');
const {data:viewerAviso}=await viewer.db.from('eventos_notificacao')
 .select('id').eq('chave',prefix);
assert(viewerAviso?.length===1,'Visualizador não recebeu aviso permitido');
const {data:tentou,error:negado}=await colab.db.from('eventos_notificacao')
 .update({lida_em:new Date().toISOString()}).eq('id',avisos[0].id).select('id');
assert(negado||tentou?.length===0,'Outra conta conseguiu marcar aviso de colega');
const {data:marcado,error:em}=await admin.db.from('eventos_notificacao')
 .update({lida_em:new Date().toISOString()}).eq('id',avisos[0].id).select('id');
assert(!em&&marcado?.length===1,'Dono não conseguiu marcar aviso lido');
const cid='conversa-notif-'+randomUUID().slice(0,8);
const mid='msg-'+randomUUID().slice(0,8);
const chat={id:cid,leadId:lid,canal:'whatsapp',naoLidas:1,
 mensagens:[{id:mid,de:'cliente',texto:'Mensagem fictícia',em:new Date().toISOString()}]};
await gravar('conversas',cid,chat,0);
const {data:msgs,error:msgErr}=await colab.db.from('eventos_notificacao')
 .select('id').eq('chave','mensagem:'+cid+':'+mid);
assert(!msgErr&&msgs?.length===1,'Mensagem do cliente não gerou notificação');
await gravar('conversas',cid,{...chat,naoLidas:2},1);
const {data:duplicados}=await colab.db.from('eventos_notificacao')
 .select('id').eq('chave','mensagem:'+cid+':'+mid);
assert(duplicados?.length===1,'Mensagem gerou notificação duplicada');
console.log('OK notificacoes_eventos_local: mensagens, lead, RLS, lidas e deduplicação');
