import { ImageResponse } from 'next/og';

const TAMANHOS=[180,192,512] as const;
export async function GET(req:Request,{params}:{params:{size:string}}){
 const size=Number(params.size);
 if(!TAMANHOS.some(v=>v===size))return new Response('Ícone não encontrado',{status:404});
 const image=await fetch(new URL('/nexa-app.webp',req.url),{cache:'force-cache'});
 if(!image.ok)return new Response('Ícone indisponível',{status:503});
 const content='data:image/webp;base64,'+
   Buffer.from(await image.arrayBuffer()).toString('base64');
 return new ImageResponse(
  <div style={{display:'flex',width:'100%',height:'100%',background:'#070808'}}>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={content} alt="Nexa Lab" width={size} height={size}
     style={{width:'100%',height:'100%',objectFit:'cover'}} />
  </div>,
  {width:size,height:size}
 );
}
