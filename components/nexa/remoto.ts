'use client';
import {supabaseNavegador} from '@/lib/supabase/navegador';
export type Identidade={id:string;workspace_id:string;papel:string;nome:string|null;email:string};
export type Registro={colecao:string;id:string;ordem:number;versao:number;conteudo:unknown};
type Item={id:string};
const listas=new Set(['leads','clientes','vendas','projetos','documentos','conversas','servicos','categorias-arquivos']);
const mapa=(r:Pick<Registro,'colecao'|'id'>)=>JSON.stringify([r.colecao,r.id]);
const vazio:never[]=[];
const objVazio={};
let pessoa:Identidade|null=null,base=new Map<string,Registro>(),dados:Record<string,unknown>={},pendentes=new Map<string,Registro>();
let ocupado=false,geracao=0,mudanca=0,estado='Carregando…',pronto=false,bloqueado=false;
const ouvintes=new Set<()=>void>();
function avisar(){for(const f of ouvintes)f();}
export function assinar(f:()=>void){ouvintes.add(f);return ()=>{ouvintes.delete(f);};}
export const status=()=>estado;
export const disponivel=()=>pronto;
export const identidade=()=>pessoa;
export const temPendentes=()=>pendentes.size>0;
export const copiaPendente=()=>JSON.stringify([...pendentes.values()],null,2);
export function normalizar(valor:unknown):string {
 return JSON.stringify(valor,(_,v)=>v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
}
export function iniciar(p:Identidade){
 if(pessoa?.id===p.id && pessoa.workspace_id===p.workspace_id){pessoa=p;return;}
 geracao++;pessoa=p;pronto=false;ocupado=false;bloqueado=false;base=new Map();pendentes=new Map();dados={};estado='Carregando…';mudanca++;avisar();
}
export function ler<T>(c:string,inicial:T):T{
 if(c==='perfil')return (pessoa?perfil:objVazio) as T;
 return (dados[c]??(listas.has(c)?vazio:c==='dias-trabalho'?inicial:objVazio)) as T;
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
 for(const c of Object.keys(novo))if(normalizar(novo[c])===normalizar(anterior[c]))novo[c]=anterior[c];
 dados=novo;
}
export async function atualizar(){
 if(!pessoa||ocupado||pendentes.size)return;
 const g=geracao,m=mudanca;
 try{
 const {data,error}=await supabaseNavegador().rpc('ler_registros');
 if(g!==geracao||m!==mudanca||pendentes.size)return;
 if(error||!Array.isArray(data))throw Error();
 base=new Map((data as Registro[]).map(r=>[mapa(r),r]));materializar();perfil={nome:pessoa.nome??pessoa.email,usuarioId:pessoa.id};pronto=true;estado='Salvo';avisar();
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
export function alterar(c:string,valor:unknown){
 if(!pronto||!podeEscrever(c)||bloqueado){estado=bloqueado?'Resolva o conflito antes de editar.':'Sem permissão para salvar.';avisar();return false;}
 try{
 const anteriores=linhas(c,dados[c]??(listas.has(c)?[]:null));
 const novas=linhas(c,valor),vistos=new Set(novas.map(mapa));
 const antes=new Map(anteriores.map(r=>[mapa(r),r]));
 for(const r of [...novas,...anteriores.filter(r=>!vistos.has(mapa(r))).map(r=>({...r,conteudo:null}))]){
   const k=mapa(r),a=antes.get(k);
   if(a && a.ordem===r.ordem && normalizar(a.conteudo)===normalizar(r.conteudo))continue;
   pendentes.set(k,{...r,versao:base.get(k)?.versao??0});
 }
 if(!pendentes.size)return true;
 dados={...dados,[c]:valor};mudanca++;estado='Salvando…';avisar();
 queueMicrotask(()=>void enviar());return true;
 }catch(e){estado=(e as Error).message;avisar();return false;}
}
export async function enviar(){
 if(!pessoa||ocupado||bloqueado||!pendentes.size)return;
 ocupado=true;const g=geracao,lote=new Map(pendentes);
 try{
 const {error}=await supabaseNavegador().rpc('gravar_registros',{p_workspace:pessoa.workspace_id,p_usuario:pessoa.id,p_mudancas:[...lote.values()]});
 if(g!==geracao)return;
 if(error){bloqueado=error.code==='40001';throw Error(bloqueado?'Conflito: outro usuário editou este registro. Exporte sua edição antes de recarregar.':'Falha ao salvar: '+error.message);}
 for(const [k,r] of lote){
   const a=base.get(k),igual=a&&a.ordem===r.ordem&&normalizar(a.conteudo)===normalizar(r.conteudo);
   const versao=r.versao+(igual?0:1);base.set(k,{...r,versao});
   const proximo=pendentes.get(k);
   if(proximo===r)pendentes.delete(k);else if(proximo)pendentes.set(k,{...proximo,versao});
 }
 estado=pendentes.size?'Salvando…':'Salvo';ocupado=false;if(pendentes.size)queueMicrotask(()=>void enviar());
 }catch(e){if(g===geracao)estado=(e as Error).message;}finally{if(g===geracao){ocupado=false;avisar();}}
}
export async function importar(d:Record<string,unknown>){
 if(!pessoa||pessoa.papel!=='administrador'||!pronto||ocupado||pendentes.size)throw Error('Aguarde a sincronização e use uma conta administradora.');
 const lote:Registro[]=[];
 for(const [c,v] of Object.entries(d)){
 if(c==='perfil')continue;
 for(const r of linhas(c,v)){
 const a=base.get(mapa(r));
 if(a){if(normalizar(a.conteudo)!==normalizar(r.conteudo))throw Error('ID já existente com conteúdo diferente: '+c+'/'+r.id);continue;}
 lote.push(r);
 }}
 const {error}=await supabaseNavegador().rpc('gravar_registros',{p_workspace:pessoa.workspace_id,p_usuario:pessoa.id,p_mudancas:lote});
 if(error)throw Error(error.message);
 await atualizar();
 for(const r of lote)if(normalizar(base.get(mapa(r))?.conteudo)!==normalizar(r.conteudo))throw Error('Não foi possível conferir '+r.id+'. Preserve o backup e tente novamente.');
 return lote.length;
}
