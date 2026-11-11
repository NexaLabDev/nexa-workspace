'use client';
import {useState} from 'react';
import {montarBackup,baixarBackup,lerBackup,type Backup} from '@/components/nexa/backup';
import {subirPrivado} from '@/components/nexa/storage';
import {idsDeArquivoEmUso} from '@/components/nexa/arquivos';
import {identidade,importar} from '@/components/nexa/remoto';
import {clientes,leads,projetos,documentos,conversasExemplo,vendasExemplo} from '@/components/nexa/dados-exemplo';
import u from '@/components/nexa/ui.module.css';
const exemplos:Record<string,Set<string>>=Object.fromEntries(Object.entries({clientes,leads,projetos,documentos,conversas:conversasExemplo,vendas:vendasExemplo}).map(([k,v])=>[k,new Set(v.map(x=>x.id))]));
export default function Importar(){
 const [b,setB]=useState<Backup|null>(null),[aviso,msg]=useState(''),[ocupado,busy]=useState(false),[incluir,incl]=useState(false);
 if(identidade()?.papel!=='administrador')return null;
 const dados:Record<string,unknown>={};let sugestoes=0;
 for(const [c,v] of Object.entries(b?.dados??{})){
 if(c==='perfil')continue;
 dados[c]=Array.isArray(v)?v.filter(r=>{if(exemplos[c]?.has(r.id)){sugestoes++;return incluir;}return true;}):v;
 }
 const executar=async(f:()=>Promise<void>)=>{busy(true);msg('');try{await f()}catch(e){msg((e as Error).message)}finally{busy(false)}};
 return <section className={u.painel}><h2>Importar dados deste dispositivo</h2><button className={u.btnSecundario} disabled={ocupado} onClick={()=>void executar(async()=>{setB(await montarBackup());})}>Examinar navegador</button> <label>Ou abrir backup <input disabled={ocupado} type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];if(f)void executar(async()=>setB(await lerBackup(f)));}}/></label>
 {b&&<><ul>{Object.entries(dados).map(([c,v])=><li key={c}>{c} · {Array.isArray(v)?v.length:1}</li>)}<li>{b.arquivos.length} anexos no backup</li></ul>{sugestoes>0&&<label><input type="checkbox" checked={incluir} onChange={e=>incl(e.target.checked)}/>Incluir {sugestoes} registros com IDs da demonstração (podem conter edições suas)</label>}
 <button disabled={ocupado} onClick={()=>void executar(async()=>{await baixarBackup();msg('Backup do navegador baixado.');})}>Baixar backup local</button> <button disabled={ocupado} onClick={()=>void executar(async()=>{
 if(!confirm('Importar os registros da prévia para este workspace? Dados locais serão preservados.'))return;
 const faltam=idsDeArquivoEmUso(dados);for(const a of b.arquivos)faltam.delete(a.id);if(faltam.size)throw Error('Backup incompleto. Anexo ausente: '+[...faltam][0]);
 for(const a of b.arquivos){const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));await subirPrivado(a.id,new Blob([bytes]),true);}
 const n=await importar(dados);msg(n+' registros novos. Conferência concluída.');setB(null);
 })}>Confirmar importação</button></>}<p role="status">{ocupado?'Processando…':aviso}</p></section>;
}
