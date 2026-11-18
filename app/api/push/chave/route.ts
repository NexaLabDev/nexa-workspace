import { NextResponse } from 'next/server';
import { chavePublica } from '@/lib/servidor/push';
export const dynamic='force-dynamic';
export function GET(){
 const chave=chavePublica();
 if(!chave)return NextResponse.json({erro:'Notificações push ainda não configuradas.'},{status:503});
 return NextResponse.json({chave},{headers:{'Cache-Control':'no-store'}});
}
