'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import './conta.css';

type Modo='entrar'|'recuperar'|'convite'|'senha';
export default function Conta({retorno=false}:{retorno?:boolean}) {
  const [modo,setModo]=useState<Modo>(retorno?'senha':'entrar');
  const [email,setEmail]=useState(''),[senha,setSenha]=useState(''),[aviso,setAviso]=useState('');
  const [ocupado,setOcupado]=useState(false),[pronto,setPronto]=useState(!retorno);
  useEffect(()=>{
    const param=new URLSearchParams(location.search);
    const convite=param.get('convite');
    if(convite && /^[0-9a-f-]{36}$/i.test(convite)){sessionStorage.setItem('nexa:convite',convite);if(!retorno)setModo('convite');}
    if(param.has('vinculo'))setAviso('Sua conta ainda não tem acesso ativo. Fale com a administração.');
    if(!retorno)return;
    const db=supabaseNavegador();
    const iniciar=async()=>{
      const token=param.get('token_hash'),tipo=param.get('type');
      if(token && (tipo==='recovery'||tipo==='invite'||tipo==='signup')){
        const {error}=await db.auth.verifyOtp({token_hash:token,type:tipo}); if(error)throw error;
      }
      // O cliente SSR troca o código PKCE do retorno ao inicializar.
      const {data,error}=await db.auth.getUser(); if(error||!data.user)throw new Error();
      // A confirmação do cadastro deve concluir o convite, sem exigir um segundo login.
      // A recuperação de senha, por outro lado, precisa manter a tela de nova senha.
      // O identificador do convite é só uma referência de fluxo; a autorização
      // é validada pelo banco contra o e-mail confirmado (nunca pelo metadata).
      const referenciaConvite=data.user.user_metadata?.nexa_convite;
      const convitePendente=sessionStorage.getItem('nexa:convite') ||
        (typeof referenciaConvite==='string'?referenciaConvite:null);
      if(tipo!=='recovery' && convitePendente && /^[0-9a-f-]{36}$/i.test(convitePendente)){
        const {data:workspace,error:erroConvite}=await db.rpc('aceitar_convite_workspace',{p_convite:convitePendente});
        if(erroConvite)throw erroConvite;
        sessionStorage.removeItem('nexa:convite');
        if(!workspace){
          await db.auth.signOut({scope:'local'});
          location.replace('/login?vinculo=pendente');
          return;
        }
        location.replace('/');
        return;
      }
      history.replaceState(null,'','/conta');setPronto(true);
    };
    iniciar().catch(()=>setAviso('Este link expirou ou foi aberto em outro navegador. Solicite um novo link.'));
  },[retorno]);

  async function enviar(e:FormEvent){
    e.preventDefault();setOcupado(true);setAviso('');
    try {
      const db=supabaseNavegador(),ret=location.origin+'/conta';
      if(modo==='recuperar'){
        const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:ret});if(error)throw error;
        setAviso('Confira sua caixa de entrada e abra o link neste navegador.');return;
      }
      if(modo==='convite'){
        const convitePendente = sessionStorage.getItem('nexa:convite');
        if (!convitePendente || !/^[0-9a-f-]{36}$/i.test(convitePendente)) {
          setAviso('Para ativar sua conta, abra o link de convite enviado pela administração.');
          return;
        }
        const {error}=await db.auth.signUp({email,password:senha,options:{emailRedirectTo:ret,data:{nexa_convite:convitePendente}}});if(error)throw error;
        setAviso('Confirme seu endereço pelo e-mail recebido. Se já tem conta, use Entrar.');return;
      }
      const resposta=modo==='senha'?await db.auth.updateUser({password:senha}):await db.auth.signInWithPassword({email,password:senha});
      if(resposta.error)throw resposta.error;
      const {data,error}=await db.rpc('aceitar_convite_workspace',{p_convite:sessionStorage.getItem('nexa:convite')});
      if(error)throw error;
      if(!data){await db.auth.signOut({scope:'local'});setAviso('Conta sem vínculo ativo. Peça acesso à administração.');return;}
      sessionStorage.removeItem('nexa:convite');location.replace('/');
    } catch (erro: unknown) {
      const falha = erro as { status?: number; code?: string } | null;
      if (falha?.code === 'over_email_send_rate_limit' || ((modo === 'recuperar' || modo === 'convite') && falha?.status === 429)) {
        setAviso('O Supabase atingiu o limite temporário de envio de e-mails. Nenhum novo link foi enviado. Tente novamente mais tarde.');
      } else {
        setAviso(modo==='entrar'?'Verifique o e-mail e a senha e tente novamente.':'Não foi possível concluir. Verifique o link ou tente novamente.');
      }
    }
    finally{setOcupado(false);}
  }
  return <main className="conta"><form onSubmit={enviar}><img src="/dashboard/simbolo-nexa.png" alt="Nexa Lab" width="42"/><h1>{{entrar:'Entrar no workspace',recuperar:'Recuperar senha',convite:'Ativar convite',senha:'Definir senha'}[modo]}</h1>
    {modo!=='senha'&&<label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>}
    {modo!=='recuperar'&&<label>{modo==='senha'?'Nova senha':'Senha'}<input type="password" autoComplete={modo==='entrar'?'current-password':'new-password'} minLength={modo==='entrar'?1:8} value={senha} onChange={e=>setSenha(e.target.value)} required/></label>}
    <button disabled={!pronto||ocupado}>{ocupado?'Aguarde…':{entrar:'Entrar',recuperar:'Enviar link',convite:'Confirmar cadastro',senha:'Salvar senha'}[modo]}</button>
    {aviso&&<p role="status">{aviso}</p>}
    {modo==='entrar'?<div><button type="button" onClick={()=>{setModo('recuperar');setAviso('')}}>Esqueci minha senha</button><button type="button" onClick={()=>{setModo('convite');setAviso('')}}>Recebi um convite</button></div>:<a href="/login">Voltar ao login</a>}
  </form></main>;
}
