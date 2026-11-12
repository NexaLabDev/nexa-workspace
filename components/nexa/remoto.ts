'use client';
// ============================================
// DADOS DO WORKSPACE NO SUPABASE (um registro por linha, com versão)
// ============================================
// As telas continuam usando os mesmos hooks (store.ts). Aqui fica o "fundo":
// - lê tudo do banco (ler_registros) e relê periodicamente e ao voltar para a aba;
// - cada alteração vira um lote pequeno (só as linhas que mudaram), enviado junto
//   numa única transação (gravar_registros). Edições em cascata da mesma ação
//   (ex.: venda ganha → cliente → projeto) vão no mesmo lote;
// - conflito = outra sessão mudou o mesmo registro: nada é sobrescrito; a pessoa
//   exporta a edição ou descarta e recarrega;
// - falha de rede: a edição fica na fila e é reenviada (botão e automaticamente).
// As permissões valem no banco (RLS); aqui só evitamos tentativas inúteis.
// Performance: poll sem mudança de versão não rematerializa nem acorda o React.
// ============================================
import {supabaseNavegador} from '@/lib/supabase/navegador';
export type Identidade={id:string;workspace_id:string;papel:string;nome:string|null;email:string};
export type Registro={colecao:string;id:string;ordem:number;versao:number;conteudo:unknown};
type Item={id:string};
const listas=new Set(['leads','clientes','vendas','projetos','documentos','conversas','servicos','categorias-arquivos']);
/** Listas que começam com o padrão do sistema enquanto o workspace nunca gravou nada nelas */
const comPadrao=new Set(['servicos','categorias-arquivos']);
let comLinhas=new Set<string>();
let timerEnvio:ReturnType<typeof setTimeout>|null=null;
const mapa=(r:Pick<Registro,'colecao'|'id'>)=>JSON.stringify([r.colecao,r.id]);
const vazio:never[]=[];
const objVazio={};
let pessoa:Identidade|null=null,base=new Map<string,Registro>(),dados:Record<string,unknown>={},pendentes=new Map<string,Registro>();
let ocupado=false,geracao=0,mudanca=0,estado='Carregando…',pronto=false,bloqueado=false;
let assinaturaBase='';
const ouvintes=new Set<()=>void>();
function avisar(){for(const f of ouvintes)f();}
export function assinar(f:()=>void){ouvintes.add(f);return ()=>{ouvintes.delete(f);};}
export const status=()=>estado;
export const disponivel=()=>pronto;
export const identidade=()=>pessoa;
export const temPendentes=()=>pendentes.size>0;
export const emConflito=()=>bloqueado;
export const papel=()=>pessoa?.papel??null;
export const copiaPendente=()=>JSON.stringify([...pendentes.values()],null,2);

/** Assinatura barata: muda só quando o servidor altera versão/ordem/presença. */
function assinarMapa(m:Map<string,Registro>):string{
 let out=String(m.size)+'|';
 for(const r of m.values()) out+=r.colecao+'\0'+r.id+'\0'+r.versao+'\0'+r.ordem+'|';
 return out;
}
/** Igualdade estrutural: referência, depois listas por id, senão JSON normalizado. */
function mesmoValor(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(a==null||b==null)return a===b;
 if(typeof a!==typeof b)return false;
 if(Array.isArray(a)&&Array.isArray(b)){
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++){
   const x=a[i] as Item|unknown,y=b[i] as Item|unknown;
   if(x&&y&&typeof x==='object'&&typeof y==='object'&&'id' in (x as object)&&'id' in (y as object)){
    if((x as Item).id!==(y as Item).id)return false;
    if(x!==y&&normalizar(x)!==normalizar(y))return false;
   }else if(x!==y&&normalizar(x)!==normalizar(y))return false;
  }
  return true;
 }
 if(typeof a==='object'&&typeof b==='object')return normalizar(a)===normalizar(b);
 return false;
}

export function normalizar(valor:unknown):string {
 return JSON.stringify(valor,(_,v)=>v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
}
export function iniciar(p:Identidade){
 if(pessoa?.id===p.id && pessoa.workspace_id===p.workspace_id){pessoa=p;return;}
 geracao++;pessoa=p;pronto=false;ocupado=false;bloqueado=false;base=new Map();pendentes=new Map();dados={};assinaturaBase='';estado='Carregando…';mudanca++;avisar();
}
export function ler<T>(c:string,inicial:T):T{
 if(c==='perfil')return (pessoa?perfil:objVazio) as T;
 if(c in dados)return dados[c] as T;
 if(listas.has(c))return (comPadrao.has(c)&&!comLinhas.has(c)?inicial:vazio) as T;
 return (c==='dias-trabalho'?inicial:objVazio) as T;
}
let perfil:{nome?:string;usuarioId?:string}={};
function materializar(){
 const anterior=dados,novo:Record<string,unknown>={};
 const rows=new Map([...base,...pendentes]);
 for(const r of [...rows.values()].sort((a,b)=>a.ordem-b.ordem||a.id.localeCompare(b.id))){
   if(r.conteudo==null)continue;
   if(listas.has(r.colecao))((novo[r.colecao]??=[]) as unknown[]).push(r.conteudo);
   else novo[r.colecao]=r.conteudo;
 }
 comLinhas=new Set([...rows.values()].map(r=>r.colecao));
 for(const c of Object.keys(novo))if(mesmoValor(novo[c],anterior[c]))novo[c]=anterior[c];
 dados=novo;
}
export async function atualizar(){
 if(!pessoa||ocupado||pendentes.size)return;
 const g=geracao,m=mudanca;
 try{
 const {data,error}=await supabaseNavegador().rpc('ler_registros');
 if(g!==geracao||m!==mudanca||pendentes.size)return;
 if(error||!Array.isArray(data))throw Error();
 const proximo=new Map((data as Registro[]).map(r=>[mapa(r),r]));
 const proxAssinatura=assinarMapa(proximo);
 // Sem mudança no servidor: não rematerializa nem acorda assinantes (exceto status)
 if(pronto && proxAssinatura===assinaturaBase){
  if(estado!=='Salvo'){estado='Salvo';avisar();}
  return;
 }
 base=proximo;assinaturaBase=proxAssinatura;materializar();
 perfil={nome:pessoa.nome??pessoa.email,usuarioId:pessoa.id};pronto=true;estado='Salvo';avisar();
 }catch{if(g===geracao){estado='Falha ao atualizar. Tente novamente.';avisar();}}
}
function linhas(c:string,valor:unknown):Registro[]{
 const items=listas.has(c)?valor:[valor];if(!Array.isArray(items))throw Error('Lista inválida: '+c);
 const ids=new Set<string>();
 return items.map((item,i)=>{const id=listas.has(c)?(item as Item)?.id:'@';
 if(typeof id!=='string'||!id.length||id.length>160||ids.has(id))throw Error('Identificador ausente ou repetido em '+c);
 ids.add(id);return {colecao:c,id,ordem:i,versao:0,conteudo:item};
 });
}
export function podeEscrever(c:string){
 if(!pessoa||pessoa.papel==='visualizador')return false;
 if(['preferencias','avisos'].includes(c))return pessoa.papel==='administrador';
 if(['prestadora','metas','dias-trabalho','servicos'].includes(c))return ['administrador','gestor'].includes(pessoa.papel);
 return true;
}
function avisoTemporario(texto:string){
 if(bloqueado||/^Falha/.test(estado))return;
 estado=texto;avisar();
 setTimeout(()=>{if(estado===texto){estado=pendentes.size?'Salvando…':'Salvo';avisar();}},4000);
}
function agendarEnvio(){
 // Junta as edições da mesma ação num único lote (uma transação no banco).
 if(timerEnvio)return;
 timerEnvio=setTimeout(()=>{timerEnvio=null;void enviar();},300);
}
export function alterar(c:string,valor:unknown){
 if(c==='perfil')return false; // nome e cargo são editados em Configurações → Conta
 if(!pronto||!podeEscrever(c)||bloqueado){
  if(bloqueado){estado='Resolva o conflito antes de editar.';avisar();}
  else avisoTemporario('Seu perfil de acesso não permite salvar esta alteração.');
  return false;
 }
 try{
 const anteriores=linhas(c,dados[c]??(listas.has(c)?[]:null));
 const novas=linhas(c,valor),vistos=new Set(novas.map(mapa));
 const antes=new Map(anteriores.map(r=>[mapa(r),r]));
 for(const r of [...novas,...anteriores.filter(r=>!vistos.has(mapa(r))).map(r=>({...r,conteudo:null}))]){
   const k=mapa(r),a=antes.get(k);
   if(a && a.ordem===r.ordem && (a.conteudo===r.conteudo || mesmoValor(a.conteudo,r.conteudo)))continue;
   pendentes.set(k,{...r,versao:base.get(k)?.versao??0});
 }
 if(!pendentes.size)return true;
 dados={...dados,[c]:valor};mudanca++;estado='Salvando…';avisar();
 agendarEnvio();return true;
 }catch(e){estado=(e as Error).message;avisar();return false;}
}
export async function enviar(){
 if(!pessoa||ocupado||bloqueado||!pendentes.size)return;
 ocupado=true;const g=geracao,lote=new Map(pendentes);
 try{
 const {error}=await supabaseNavegador().rpc('gravar_registros',{p_workspace:pessoa.workspace_id,p_usuario:pessoa.id,p_mudancas:[...lote.values()]});
 if(g!==geracao)return;
 if(error&&error.code==='40001'){
  // Outra sessão gravou antes. Se gravou exatamente o mesmo conteúdo, não há o que resolver.
  const {data}=await supabaseNavegador().rpc('ler_registros');
  if(g!==geracao)return;
  if(Array.isArray(data)){
   base=new Map((data as Registro[]).map(r=>[mapa(r),r]));
   assinaturaBase=assinarMapa(base);
   for(const [k,r] of [...pendentes]){const a=base.get(k);if(a&&mesmoValor(a.conteudo,r.conteudo))pendentes.delete(k);}
   if(!pendentes.size){materializar();estado='Salvo';return;}
  }
  bloqueado=true;
  throw Error('Conflito: outra sessão alterou o mesmo registro. Nada foi sobrescrito. Exporte sua edição ou descarte-a para recarregar.');
 }
 if(error)throw Error(error.code==='42501'?'Seu perfil de acesso não permite salvar esta alteração.':'Falha ao salvar. Confira a conexão e tente novamente.');
 for(const [k,r] of lote){
   const a=base.get(k),igual=a&&a.ordem===r.ordem&&mesmoValor(a.conteudo,r.conteudo);
   const versao=r.versao+(igual?0:1);base.set(k,{...r,versao});
   const proximo=pendentes.get(k);
   if(proximo===r)pendentes.delete(k);else if(proximo)pendentes.set(k,{...proximo,versao});
 }
 assinaturaBase=assinarMapa(base);
 estado=pendentes.size?'Salvando…':'Salvo';ocupado=false;if(pendentes.size)agendarEnvio();
 }catch(e){if(g===geracao)estado=(e as Error).message;}finally{if(g===geracao){ocupado=false;avisar();}}
}
/** Abandona as edições não salvas deste navegador e recarrega o que está no banco. */
export async function descartarPendentes(){
 if(ocupado)return;
 pendentes=new Map();bloqueado=false;mudanca++;estado='Carregando…';avisar();
 await atualizar();
}
export async function importar(d:Record<string,unknown>){
 if(!pessoa||pessoa.papel!=='administrador'||!pronto||ocupado||pendentes.size)throw Error('Aguarde a sincronização e use uma conta administradora.');
 const lote:Registro[]=[];
 for(const [c,v] of Object.entries(d)){
 if(c==='perfil')continue;
 for(const r of linhas(c,v)){
 const a=base.get(mapa(r));
 if(a){if(!mesmoValor(a.conteudo,r.conteudo))throw Error('ID já existente com conteúdo diferente: '+c+'/'+r.id);continue;}
 lote.push(r);
 }}
 const {error}=await supabaseNavegador().rpc('gravar_registros',{p_workspace:pessoa.workspace_id,p_usuario:pessoa.id,p_mudancas:lote});
 if(error)throw Error(error.message);
 await atualizar();
 for(const r of lote)if(!mesmoValor(base.get(mapa(r))?.conteudo,r.conteudo))throw Error('Não foi possível conferir '+r.id+'. Preserve o backup e tente novamente.');
 return lote.length;
}
