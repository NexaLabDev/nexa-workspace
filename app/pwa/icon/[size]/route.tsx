import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime='nodejs';
const TAMANHOS=[180,192,512] as const;
export async function GET(_req:Request,{params}:{params:{size:string}}){
 const size=Number(params.size);
 if(!TAMANHOS.some(v=>v===size))return new Response('Ícone não encontrado',{status:404});
 // Usa os pixels oficiais da Nexa diretamente; sem chamar o próprio servidor
 // durante o render (evita reset de conexão nas rotas Next em desenvolvimento).
 const bytes=await readFile(join(process.cwd(),'public','nexa-app.webp'));
 const content='data:image/webp;base64,'+bytes.toString('base64');
 return new ImageResponse(
  <div style={{display:'flex',width:'100%',height:'100%',background:'#070808'}}>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={content} alt="Nexa Lab" width={size} height={size}
     style={{width:'100%',height:'100%',objectFit:'cover'}} />
  </div>,
  {width:size,height:size}
 );
}
