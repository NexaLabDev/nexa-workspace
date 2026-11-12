'use client';
import {supabaseNavegador} from '@/lib/supabase/navegador';
import {identidade} from './remoto';
function objeto(id:string){
 const ws=identidade()?.workspace_id;
 if(!ws||!/^[-\w]{1,160}$/.test(id))throw Error('Identificador de arquivo inválido.');
 return { bucket:supabaseNavegador().storage.from('nexa-arquivos'),path:ws+'/'+id };
}
export async function baixarPrivado(id:string){
 const {bucket,path}=objeto(id),{data,error}=await bucket.download(path);
 if(error||!data)throw Error('Não foi possível ler o anexo privado.');
 return data;
}
export async function subirPrivado(id:string,blob:Blob,conferir=false){
 if(blob.size>25*1024*1024)throw Error('Arquivo maior que 25 MB.');
 const {bucket,path}=objeto(id);
 const {error}=await bucket.upload(path,blob.slice(0,blob.size,'application/octet-stream'),{contentType:'application/octet-stream',upsert:false});
 if(error&&!conferir)throw Error(error.message);
 if(conferir){
 const outro=await baixarPrivado(id);
 const hash=async(b:Blob)=>new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer())).join(',');
 if(blob.size!==outro.size||await hash(blob)!==await hash(outro))throw Error('Conteúdo divergente no anexo '+id);
 }
}
/** Remove o objeto privado no Storage. Exige policy DELETE no bucket (ver migração pendente). */
export async function removerPrivado(id:string){
 const {bucket,path}=objeto(id);
 const {error}=await bucket.remove([path]);
 if(error)throw Error(error.message||'Não foi possível apagar o anexo privado.');
}
