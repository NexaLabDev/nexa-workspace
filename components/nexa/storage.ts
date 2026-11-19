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
/** Mídia de WhatsApp com MIME preservado para a Meta validar o formato.
 * O upload ocorre diretamente do navegador ao Storage privado (não passa pelo limite
 * de tamanho de requisição da Vercel). O servidor só lê o objeto após autenticar.
 */
export async function subirMediaWhatsApp(id: string, arquivo: File): Promise<void> {
 if(!/^wa-[a-f0-9-]{36}$/i.test(id))throw Error('Identificador de mídia inválido.');
 if(arquivo.size<=0||arquivo.size>16*1024*1024)throw Error('Arquivo muito grande (máximo 16 MB).');
 const tipos=['image/jpeg','image/png','video/mp4','audio/mpeg','audio/mp4','audio/ogg','audio/aac','audio/amr'];
 const mime=arquivo.type.split(';')[0].trim().toLowerCase();
 if(!tipos.includes(mime))throw Error('Formato não aceito pelo WhatsApp. Use JPG, PNG, MP4, MP3, M4A ou OGG.');
 const {bucket,path}=objeto(id);
 const {error}=await bucket.upload(path,arquivo,{contentType:arquivo.type||mime,upsert:false});
 if(error)throw Error(error.message||'Não foi possível enviar o arquivo para o Storage.');
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
