'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import Link from 'next/link';

type Props={rota:string;children:ReactNode};
type State={erro:Error|null};

export default class ModuloComProtecao extends Component<Props,State> {
  state:State={erro:null};
  static getDerivedStateFromError(erro:Error):State {return {erro};}
  componentDidCatch(erro:Error, info:ErrorInfo) {
    // Só reporta o erro técnico no console do próprio navegador;
    // não envia nomes, mensagens de clientes nem outros dados para serviços externos.
    console.error('Nexa Workspace: falha no módulo '+this.props.rota,erro,info.componentStack);
  }
  render() {
    if(!this.state.erro)return this.props.children;
    const detalhe=this.state.erro.message?.slice(0,350)||'Falha inesperada no navegador.';
    return <div style={{
      minHeight:'min(600px,80dvh)',display:'flex',flexDirection:'column',
      justifyContent:'center',alignItems:'center',gap:15,
      padding:'28px',background:'#111715',color:'#eff5e9',textAlign:'center',
    }}>
      <h2 style={{fontSize:23,margin:0}}>Não foi possível abrir esta área da Nexa</h2>
      <p style={{maxWidth:500,margin:0,color:'#b8c8b5',lineHeight:1.6}}>
        Ocorreu um erro nesta tela, mas seus dados continuam no Supabase. Você pode recarregar ou voltar ao Workspace.
      </p>
      <details style={{maxWidth:550,overflowWrap:'anywhere',textAlign:'left',fontSize:12,color:'#aac2a7'}}>
        <summary style={{cursor:'pointer'}}>Detalhes técnicos</summary>
        <pre style={{whiteSpace:'pre-wrap'}}>{detalhe}</pre>
      </details>
      <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:10}}>
        <button type="button" onClick={()=>window.location.reload()} style={{background:'#d5f66d',color:'#1a2016',border:0,borderRadius:10,padding:'11px 19px',cursor:'pointer',fontWeight:700}}>Recarregar página</button>
        <Link href="/" style={{border:'1px solid #4c5a4a',color:'#e4f0dd',borderRadius:10,padding:'10px 19px',textDecoration:'none'}}>Voltar ao início</Link>
      </div>
    </div>;
  }
}
