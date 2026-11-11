'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabaseNavegador} from '@/lib/supabase/navegador';
import u from '@/components/nexa/ui.module.css';

type Perfil={id:string;email:string;nome:string|null;cargo:string|null;papel:string;ativo:boolean};
type Equipe={id:string;nome:string};
export default function Equipe(){
 const [lista,setLista]=useState<Perfil[]>([]),[eu,setEu]=useState(''),[times,setTimes]=useState<Equipe[]>([]),[membros,setMembros]=useState<{equipe_id:string;perfil_id:string}[]>([]);
 const [convites,setConvites]=useState<{id:string;email:string;aceito_em:string|null}[]>([]),[aviso,setAviso]=useState(''),[email,setEmail]=useState(''),[nome,setNome]=useState('');
 const carregar=useCallback(async()=>{
  const db=supabaseNavegador();const {data:{user}}=await db.auth.getUser();if(!user)return;
  const res=await Promise.all([db.from('perfis').select('*').order('email'),db.from('equipes').select('id,nome').order('nome'),db.from('equipe_membros').select('equipe_id,perfil_id'),db.from('convites_workspace').select('id,email,aceito_em').is('aceito_em',null)]);
  if(res.some(r=>r.error)){setAviso('Falha ao consultar equipe.');return;}
  setEu(user.id);setLista(res[0].data??[]);setTimes(res[1].data??[]);setMembros(res[2].data??[]);setConvites(res[3].data??[]);
 },[]);
 useEffect(()=>{void carregar()},[carregar]);
 const papel=lista.find(p=>p.id===eu)?.papel,admin=papel==='administrador',gerencia=admin||papel==='gestor';
 async function salvar(operacao:PromiseLike<{error:unknown}>){try{const {error}=await operacao;if(error)throw error;setAviso('Alteração salva.');await carregar();}catch{setAviso('Não foi possível salvar. Verifique sua permissão e os dados.');}}
 return <section className={u.painel}><h2>Conta e equipe</h2><button className={u.btnSecundario} onClick={async()=>{const {error}=await supabaseNavegador().auth.signOut({scope:'local'});if(!error)location.replace('/login');else setAviso('Falha ao encerrar sessão.')}}>Sair da conta</button>
 {lista.map(p=>{const pode=admin||(papel==='gestor'&&!['gestor','administrador'].includes(p.papel));return <div key={p.id} style={{marginTop:16,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>{p.email}</b>{['nome','cargo'].map(c=><input aria-label={c} key={c+String(p[c as 'nome'|'cargo'])} placeholder={c} disabled={!pode&&eu!==p.id} defaultValue={p[c as 'nome'|'cargo']??''} onBlur={e=>{if(e.target.value!==(p[c as 'nome'|'cargo']??''))void salvar(supabaseNavegador().from('perfis').update({[c]:e.target.value}).eq('id',p.id));}}/>)}
 <select aria-label="Papel" value={p.papel} disabled={!pode} onChange={e=>void salvar(supabaseNavegador().from('perfis').update({papel:e.target.value}).eq('id',p.id))}>{['administrador','gestor','colaborador','visualizador'].map(x=><option disabled={!admin&&['administrador','gestor'].includes(x)} key={x}>{x}</option>)}</select>
 <button disabled={!pode} onClick={()=>void salvar(supabaseNavegador().from('perfis').update({ativo:!p.ativo}).eq('id',p.id))}>{p.ativo?'Desativar':'Ativar'}</button>
 {times.map(t=><label key={t.id}><input type="checkbox" disabled={!gerencia} checked={membros.some(m=>m.equipe_id===t.id&&m.perfil_id===p.id)} onChange={e=>void salvar(e.target.checked?supabaseNavegador().from('equipe_membros').insert({equipe_id:t.id,perfil_id:p.id}):supabaseNavegador().from('equipe_membros').delete().eq('equipe_id',t.id).eq('perfil_id',p.id))}/>{t.nome}</label>)}</div>})}
 {gerencia&&<form onSubmit={e=>{e.preventDefault();void salvar(supabaseNavegador().from('equipes').insert({nome}));}}><input required placeholder="Nome da equipe" value={nome} onChange={e=>setNome(e.target.value)}/><button>Criar equipe</button></form>}
 {admin&&<><form onSubmit={e=>{e.preventDefault();void salvar(supabaseNavegador().from('convites_workspace').insert({email:email.toLowerCase().trim()}));}}><input required type="email" placeholder="E-mail do colaborador" value={email} onChange={e=>setEmail(e.target.value)}/><button>Gerar convite</button></form>
 {convites.map(c=><div key={c.id}>{c.email} <button onClick={()=>navigator.clipboard.writeText(location.origin+'/login?convite='+c.id).then(()=>setAviso('Link copiado. Envie ao colaborador.')).catch(()=>setAviso(location.origin+'/login?convite='+c.id))}>Copiar link</button> <button onClick={()=>void salvar(supabaseNavegador().from('convites_workspace').delete().eq('id',c.id))}>Revogar</button></div>)}</>}
 <p role="status">{aviso}</p></section>
}
