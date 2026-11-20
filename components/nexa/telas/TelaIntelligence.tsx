'use client';
import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Calculator, ClipboardCheck, MessageSquareText, Plus, Save, Trash2, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import NexaShell from '../NexaShell';
import { useConversas, useLeads } from '../dados';
import { identidade } from '../remoto';
import { supabaseNavegador } from '@/lib/supabase/navegador';
import { calcularProjeto, categorias, configInicial, projetoInicial, dinheiro, type ConfigFinanceira, type ProjetoPrecificado, type CalculoFinanceiro } from '@/lib/nexa/intelligence';
import s from './intelligence.module.css';
import NexaChat from './NexaChat';

type Aba = 'chat' | 'precificar' | 'custos' | 'atendimento' | 'consultoria';
type Registro = {
  id: string; nome: string; categoria: string; entradas: ProjetoPrecificado;
  calculo: CalculoFinanceiro; criado_em: string;
};
type MensagemZap = {id:string;to:string;direction:string;text:string;sentAt:string};
type OpcaoConversa = {id:string;titulo:string;texto:string};
const moeda = (v:number|null) => dinheiro(v);
const numero = (v:string) => Number.isFinite(Number(v)) ? Math.max(0,Number(v)) : 0;
function anonimizar(t:string) {
  return t.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[e-mail]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF]')
    .replace(/(?:\+?55[\s()-]*)?(?:\(?\d{2}\)?[\s-]*)?9?\d{4}[\s-]?\d{4}\b/g,'[telefone]');
}
const camposProjeto: Array<{chave:keyof ProjetoPrecificado;rotulo:string;info:string}> = [
  {chave:'horasImplantacao',rotulo:'Horas de desenvolvimento/implantação',info:'Planejamento, execução, testes e treinamento'},
  {chave:'despesasImplantacao',rotulo:'Gastos únicos (R$)',info:'APIs, licenças, freelancers, domínio de implantação'},
  {chave:'horasSuporte',rotulo:'Horas de manutenção por mês',info:'Informe 0 quando não houver suporte individual'},
  {chave:'despesasMensais',rotulo:'Gastos específicos mensais (R$)',info:'Hospedagem adicional, API por cliente, mensagens'},
];
export default function TelaIntelligence() {
  const [aba,setAba] = useState<Aba>('chat');
  const [config,setConfig] = useState<ConfigFinanceira>(configInicial);
  const [projeto,setProjeto] = useState<ProjetoPrecificado>(projetoInicial);
  const [historico,setHistorico] = useState<Registro[]>([]);
  const [autorizado,setAutorizado] = useState(false);
  const [carregando,setCarregando] = useState(true);
  const [salvando,setSalvando] = useState(false);
  const [aviso,setAviso] = useState('');
  const [resposta,setResposta] = useState('');
  const [pensando,setPensando] = useState(false);
  const [transcricao,setTranscricao] = useState('');
  const [confirmou,setConfirmou] = useState(false);
  const [pergunta,setPergunta] = useState('');
  const [zapMensagens,setZapMensagens] = useState<MensagemZap[]>([]);
  const [buscandoZap,setBuscandoZap] = useState(false);
  const [conversas] = useConversas();
  const [leads] = useLeads();
  const calculo = useMemo(()=>calcularProjeto(projeto,config),[projeto,config]);
  const porcentagemDescontos = (config.aliquota+config.taxaPagamento)/100;
  const lucroVenda = projeto.precoVendido && projeto.precoVendido>0
    ? projeto.precoVendido*(1-porcentagemDescontos)-calculo.custoImplantacao : null;
  const lucroMensalVenda = projeto.mensalidadeVendida && projeto.mensalidadeVendida>0
    ? projeto.mensalidadeVendida*(1-porcentagemDescontos)-calculo.custoMensal : null;
  const opcoes = useMemo<OpcaoConversa[]>(()=>{
    const lista = conversas.slice(0,60).map(cv=>{
      const lead=leads.find(l=>l.id===cv.leadId);
      return {
        id:'crm:'+cv.id,
        titulo:(lead?.empresa || 'Conversa '+cv.id.slice(0,8))+' · '+cv.canal,
        texto:cv.mensagens.map(m=>(m.de==='cliente'?'Cliente: ':'Equipe: ')+(m.texto||'[arquivo]')).join('\n'),
      };
    });
    const grupos=new Map<string,MensagemZap[]>();
    for(const m of zapMensagens) {
      const telefone=(m.to||'').replace(/\D/g,'');
      if (!telefone) continue;
      const anteriores=grupos.get(telefone)||[];
      anteriores.push(m); grupos.set(telefone,anteriores);
    }
    for(const [telefone,mensagens] of grupos) {
      lista.push({
        id:'zap:'+telefone,
        titulo:'WhatsApp · final '+telefone.slice(-4),
        texto:mensagens.sort((a,b)=>a.sentAt.localeCompare(b.sentAt))
          .map(m=>(m.direction==='inbound'?'Cliente: ':'Equipe: ')+(m.text||'[mídia]')).join('\n'),
      });
    }
    return lista;
  },[conversas,leads,zapMensagens]);

  useEffect(()=>{
    let ativo=true;
    const carregar=async()=>{
      const p=identidade();
      if(!p || p.papel!=='administrador'){if(ativo){setAutorizado(false);setCarregando(false);}return;}
      try {
        const db=supabaseNavegador();
        const [c,r]=await Promise.all([
          db.from('nexa_intelligence_config').select('dados').eq('workspace_id',p.workspace_id).maybeSingle(),
          db.from('nexa_intelligence_projetos').select('id,nome,categoria,entradas,calculo,criado_em')
            .eq('workspace_id',p.workspace_id).order('criado_em',{ascending:false}).limit(50),
        ]);
        if(c.error || r.error)throw Error('Não foi possível ler os dados da Nexa Intelligence. Verifique a migração do banco.');
        if(!ativo)return;
        if(c.data?.dados && typeof c.data.dados==='object') {
          const dados=c.data.dados as ConfigFinanceira;
          setConfig({...configInicial,...dados,custos:Array.isArray(dados.custos)?dados.custos:configInicial.custos});
        }
        setHistorico((r.data||[]) as Registro[]);
        setAutorizado(true);
      }catch(err){if(ativo){setAviso(err instanceof Error?err.message:'Erro ao carregar.');setAutorizado(true);}}
      finally{if(ativo)setCarregando(false);}
    };
    void carregar();
    return()=>{ativo=false;};
  },[]);

  async function salvarCustos() {
    const p=identidade();
    if(!p || p.papel!=='administrador')return;
    setSalvando(true);setAviso('');
    try {
      const {error}=await supabaseNavegador().from('nexa_intelligence_config')
        .upsert({workspace_id:p.workspace_id,dados:config,atualizado_em:new Date().toISOString()});
      if(error)throw error;
      setAviso('Custos e parâmetros salvos no Supabase.');
    }catch{setAviso('Não foi possível salvar os custos. Verifique o banco e a conexão.');}
    finally{setSalvando(false);}
  }
  async function salvarProjeto() {
    const p=identidade();
    if(!p || p.papel!=='administrador')return;
    if(!projeto.nome.trim()){setAviso('Dê um nome ao projeto antes de salvar.');return;}
    if(calculo.precoImplantacao===null){setAviso('Complete o valor-hora e as margens para obter um orçamento válido.');return;}
    setSalvando(true);setAviso('');
    try {
      const {data,error}=await supabaseNavegador().from('nexa_intelligence_projetos')
        .insert({workspace_id:p.workspace_id,nome:projeto.nome.trim(),categoria:projeto.categoria,entradas:projeto,calculo})
        .select('id,nome,categoria,entradas,calculo,criado_em').single();
      if(error)throw error;
      setHistorico(h=>[data as Registro,...h].slice(0,50));
      setAviso('Orçamento salvo no histórico.');
    }catch{setAviso('Erro ao salvar o orçamento. Confira os dados e tente novamente.');}
    finally{setSalvando(false);}
  }
  async function excluirProjeto(id:string) {
    const p=identidade();
    if(!p || p.papel!=='administrador')return;
    if(!window.confirm('Excluir este orçamento do histórico?'))return;
    const {error}=await supabaseNavegador().from('nexa_intelligence_projetos')
      .delete().eq('id',id).eq('workspace_id',p.workspace_id);
    if(error){setAviso('Não foi possível excluir o orçamento.');return;}
    setHistorico(h=>h.filter(x=>x.id!==id));
    setAviso('Orçamento excluído.');
  }
  async function buscarWhatsApp() {
    setBuscandoZap(true);setAviso('');
    try {
      const res=await fetch('/api/zapclaw/messages',{cache:'no-store'});
      const json=await res.json() as {mensagens?:MensagemZap[];erro?:string};
      if(!res.ok)throw Error(json.erro||'Não foi possível consultar o WhatsApp.');
      setZapMensagens((json.mensagens||[]).filter(x=>!!x.text).slice(0,100));
      setAviso('Conversas carregadas apenas para seleção. Nenhuma foi enviada à IA.');
    }catch(err){setAviso(err instanceof Error?err.message:'Erro ao consultar WhatsApp.');}
    finally{setBuscandoZap(false);}
  }
  async function analisar(tipo:'precificacao'|'atendimento'|'consultoria',texto:string) {
    if(tipo==='atendimento' && !confirmou){setAviso('Confirme a autorização e revise os dados antes de analisar.');return;}
    setPensando(true);setResposta('');setAviso('');
    try {
      const contexto=tipo==='atendimento' ? '' : JSON.stringify({parametros:config,projeto,calculo});
      const res=await fetch('/api/intelligence/analisar',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({tipo,texto,contexto}),
      });
      const json=await res.json() as {resposta?:string;erro?:string};
      if(!res.ok)throw Error(json.erro||'Não foi possível concluir a análise.');
      setResposta(json.resposta||'Sem resposta.');
      if(tipo==='atendimento')setConfirmou(false);
    }catch(err){setAviso(err instanceof Error?err.message:'Falha na IA.');}
    finally{setPensando(false);}
  }
  const atualizarParametro=(chave:keyof Omit<ConfigFinanceira,'custos'>,v:string)=>
    setConfig(a=>({...a,[chave]:numero(v)}));
  const atualizarProjeto=(chave:keyof ProjetoPrecificado,v:string)=>
    setProjeto(a=>({...a,[chave]:numero(v)}));
  return <NexaShell aba="intelligence" marcaTitulo="Nexa Intelligence" ocultarAcoesTopo>
    <div className={s.pagina}>
      <div className={s.cabecalho}>
        <div className={s.tituloLinha}><BrainCircuit size={30}/><div>
          <h1>Nexa Intelligence</h1>
          <p>Custos, precificação e melhoria do atendimento em um só lugar.</p>
        </div></div>
        <span className={s.privado}><ShieldCheck size={15}/> Uso interno · administradores</span>
      </div>
      {carregando ? <div className={s.painel}>Carregando os dados financeiros…</div> :
      !autorizado ? <div className={s.painel}>Esta área é exclusiva para administradores da Nexa.</div> :
      <>
      <nav className={s.abas} aria-label="Áreas da Nexa Intelligence">
        <button className={aba==='chat'?s.ativa:''} onClick={()=>{setAba('chat');setResposta('');}}><MessageSquareText size={17}/> Conversar com a IA</button>
        <button className={aba==='precificar'?s.ativa:''} onClick={()=>{setAba('precificar');setResposta('');}}> <Calculator size={17}/> Precificar</button>
        <button className={aba==='custos'?s.ativa:''} onClick={()=>{setAba('custos');setResposta('');}}> <Save size={17}/> Meus custos</button>
        <button className={aba==='atendimento'?s.ativa:''} onClick={()=>{setAba('atendimento');setResposta('');}}> <MessageSquareText size={17}/> Atendimento</button>
        <button className={aba==='consultoria'?s.ativa:''} onClick={()=>{setAba('consultoria');setResposta('');}}> <BrainCircuit size={17}/> Consultar IA</button>
      </nav>
      {aviso && <div role="status" className={s.aviso}>{aviso}<button aria-label="Dispensar aviso" onClick={()=>setAviso('')}>×</button></div>}
      {aba==='chat' && <NexaChat/>}
      {aba==='precificar' && <div className={s.colunas}>
        <section className={s.painel}>
          <header className={s.painelTopo}><h2>Orçamento do projeto</h2><p>Inclua também automações simples, entregas únicas e projetos já existentes.</p></header>
          <label className={s.campo}><span>Nome do projeto</span><input value={projeto.nome} maxLength={150} onChange={e=>setProjeto(p=>({...p,nome:e.target.value}))} placeholder="Ex.: Automação de contratos"/></label>
          <label className={s.campo}><span>Tipo de serviço</span><select value={projeto.categoria} onChange={e=>setProjeto(p=>({...p,categoria:e.target.value}))}>{categorias.map(x=><option key={x}>{x}</option>)}</select></label>
          <div className={s.formGrade}>
            {camposProjeto.map(f=><label key={f.chave} className={s.campo}>
              <span>{f.rotulo}</span>
              <input type="number" step="0.5" min="0" value={projeto[f.chave] as number} onChange={e=>atualizarProjeto(f.chave,e.target.value)}/>
              <small>{f.info}</small>
            </label>)}
          </div>
          <div className={s.formGrade}>
            <label className={s.campo}><span>Preço que pretende cobrar (R$)</span><input type="number" min="0" step="0.01" value={projeto.precoVendido||0} onChange={e=>atualizarProjeto('precoVendido',e.target.value)} /></label>
            <label className={s.campo}><span>Mensalidade que pretende cobrar (R$)</span><input type="number" min="0" step="0.01" value={projeto.mensalidadeVendida||0} onChange={e=>atualizarProjeto('mensalidadeVendida',e.target.value)}/></label>
          </div>
          <div className={s.acoes}>
            <button className={s.primario} onClick={()=>void salvarProjeto()} disabled={salvando}><Save size={17}/>{salvando?'Salvando…':'Salvar orçamento'}</button>
            <button className={s.secundario} onClick={()=>{setAba('custos');setResposta('');}}>Editar custos e margem</button>
          </div>
        </section>
        <div className={s.lado}>
          <section className={s.painel}>
            <h2>Resultado calculado</h2>
            <p className={s.muted}>Os valores são calculados por fórmula, não estimados pela IA.</p>
            <div className={s.grandeNumero}><span>Implantação sugerida</span><strong>{moeda(calculo.precoImplantacao)}</strong></div>
            <div className={s.grandeNumero}><span>Mensalidade sugerida</span><strong>{moeda(calculo.mensalidade)}</strong></div>
            <div className={s.linhas}>
              <div><span>Custo de implantação</span><b>{moeda(calculo.custoImplantacao)}</b></div>
              <div><span>Custo mensal</span><b>{moeda(calculo.custoMensal)}</b></div>
              <div><span>Lucro estimado na implantação</span><b>{moeda(calculo.lucroImplantacao)}</b></div>
              <div><span>Lucro estimado por mês</span><b>{moeda(calculo.lucroMensal)}</b></div>
              {lucroVenda!==null && <div><span>Lucro no preço informado</span><b>{moeda(lucroVenda)}</b></div>}
              {lucroMensalVenda!==null && <div><span>Lucro na mensalidade informada</span><b>{moeda(lucroMensalVenda)}</b></div>}
            </div>
            {calculo.alertas.length>0 && <div className={s.alertas}>{calculo.alertas.map(x=><p key={x}>• {x}</p>)}</div>}
            <button className={s.secundario} disabled={pensando} onClick={()=>void analisar('precificacao','Analise criticamente este orçamento, os custos, o rateio, o suporte e os riscos de margem. Sugira perguntas que ainda preciso responder.')}>
              <Sparkles size={16}/> {pensando?'Analisando…':'Pedir revisão à IA'}
            </button>
          </section>
          <section className={s.painel}>
            <h2>Últimos orçamentos</h2>
            {historico.length===0?<p className={s.muted}>Nenhum orçamento salvo ainda.</p>:
              <div className={s.historico}>{historico.slice(0,8).map(item=><div key={item.id} className={s.historicoLinha}>
                <button onClick={()=>{setProjeto(item.entradas);setAviso('Orçamento carregado. Os valores serão recalculados com os custos atuais.');}}><b>{item.nome}</b><span>{item.categoria} · {moeda(item.calculo.precoImplantacao)}</span></button>
                <button className={s.excluir} aria-label={'Excluir '+item.nome} onClick={()=>void excluirProjeto(item.id)}><Trash2 size={15}/></button>
              </div>)}</div>}
          </section>
        </div>
      </div>}
      {aba==='custos' && <div className={s.colunas}>
        <section className={s.painel}>
          <header className={s.painelTopo}><h2>Custos fixos da Nexa</h2><p>Preencha seus gastos reais mensais. Valores zerados não entram no cálculo.</p></header>
          <div className={s.custoLista}>{config.custos.map(item=><div className={s.custoLinha} key={item.id}>
            <input aria-label="Nome da despesa" value={item.nome} onChange={e=>setConfig(c=>({...c,custos:c.custos.map(x=>x.id===item.id?{...x,nome:e.target.value}:x)}))}/>
            <input aria-label={'Valor mensal de '+item.nome} type="number" min="0" step="0.01" value={item.valor} onChange={e=>setConfig(c=>({...c,custos:c.custos.map(x=>x.id===item.id?{...x,valor:numero(e.target.value)}:x)}))}/>
            <button aria-label={'Remover '+item.nome} onClick={()=>setConfig(c=>({...c,custos:c.custos.filter(x=>x.id!==item.id)}))}><Trash2 size={16}/></button>
          </div>)}</div>
          <button className={s.secundario} onClick={()=>setConfig(c=>({...c,custos:[...c.custos,{id:crypto.randomUUID(),nome:'Novo custo',valor:0}]}))}><Plus size={16}/> Adicionar despesa</button>
          <div className={s.total}><span>Total mensal informado</span><strong>{moeda(calculo.custoFixoTotal)}</strong></div>
          <div className={s.acoes}><button className={s.primario} disabled={salvando} onClick={()=>void salvarCustos()}><Save size={16}/>{salvando?'Salvando…':'Salvar custos'}</button></div>
        </section>
        <section className={s.painel}>
          <header className={s.painelTopo}><h2>Regras de precificação</h2><p>São hipóteses editáveis, não alíquotas confirmadas.</p></header>
          <div className={s.formGrade}>
            {([
              ['valorHora','Sua hora de trabalho (R$)'],
              ['aliquota','Reserva de impostos (%)'],
              ['taxaPagamento','Taxas de pagamento (%)'],
              ['margem','Margem de lucro desejada (%)'],
              ['projetosPorMes','Projetos de implantação por mês'],
              ['clientesAtivos','Clientes recorrentes previstos'],
              ['percentualImplantacao','% dos custos fixos para implantação'],
            ] as const).map(([chave,rotulo])=><label className={s.campo} key={chave}><span>{rotulo}</span><input min="0" type="number" step="0.5" value={config[chave]} onChange={e=>atualizarParametro(chave,e.target.value)}/></label>)}
          </div>
          <p className={s.muted}>O restante dos custos fixos é rateado entre os clientes mensais. Separar os dois grupos evita contar a mesma despesa duas vezes. Para projetos com despesas extraordinárias, informe-as no orçamento.</p>
          <div className={s.acoes}><button className={s.primario} disabled={salvando} onClick={()=>void salvarCustos()}><Save size={16}/>Salvar parâmetros</button></div>
        </section>
      </div>}
      {aba==='atendimento' && <div className={s.colunas}>
        <section className={s.painel}>
          <header className={s.painelTopo}><h2>Revisar atendimento</h2><p>Selecione uma conversa ou cole um trecho. A análise só acontece quando você pedir.</p></header>
          <div className={s.acoes}><button className={s.secundario} disabled={buscandoZap} onClick={()=>void buscarWhatsApp()}><RefreshCw size={16}/>{buscandoZap?'Carregando…':'Carregar conversas do WhatsApp'}</button></div>
          <label className={s.campo}><span>Conversa para revisar</span><select defaultValue="" onChange={e=>{
            const item=opcoes.find(x=>x.id===e.target.value);
            setTranscricao(item?anonimizar(item.texto):'');
            setConfirmou(false);setResposta('');
          }}>
            <option value="">Colar manualmente ou escolher da lista…</option>
            {opcoes.filter(x=>x.texto.trim()).map(item=><option value={item.id} key={item.id}>{item.titulo}</option>)}
          </select></label>
          <label className={s.campo}><span>Trecho que será enviado à IA</span><textarea rows={13} maxLength={18000} value={transcricao} onChange={e=>{setTranscricao(e.target.value);setConfirmou(false);}} placeholder="Cliente: Achei caro…&#10;Atendente: Posso te explicar o que está incluído…" /></label>
          <button className={s.secundario} onClick={()=>setTranscricao(t=>anonimizar(t))}><ShieldCheck size={16}/> Ocultar telefone, CPF e e-mail</button>
          <label className={s.consentimento}><input type="checkbox" checked={confirmou} onChange={e=>setConfirmou(e.target.checked)}/><span>Tenho autorização para analisar este atendimento; revisei e removi os dados pessoais desnecessários.</span></label>
          <div className={s.acoes}><button className={s.primario} disabled={pensando||!confirmou||transcricao.trim().length<5} onClick={()=>void analisar('atendimento',transcricao)}><Sparkles size={17}/>{pensando?'Analisando…':'Analisar atendimento'}</button></div>
        </section>
        <section className={s.painel}>
          <h2>O que a IA avalia</h2>
          <div className={s.itens}><p>1. Objeções de preço, confiança, prazo e concorrência</p><p>2. Clareza e postura da equipe</p><p>3. Dúvidas não respondidas e oportunidades de melhoria</p><p>4. Exemplo de resposta mais adequada ao contexto</p></div>
          <p className={s.muted}>As mensagens da ZapClaw só são carregadas ao clicar. A API da OpenAI recebe exclusivamente o trecho confirmado; não salvamos essa análise no histórico financeiro.</p>
        </section>
      </div>}
      {aba==='consultoria' && <div className={s.colunas}>
        <section className={s.painel}>
          <h2>Converse com sua consultora</h2>
          <p className={s.muted}>A IA recebe os custos e o orçamento que você está editando. Você pode pedir críticas, comparações e melhorias.</p>
          <label className={s.campo}><span>Sua pergunta</span><textarea value={pergunta} rows={8} maxLength={18000} onChange={e=>setPergunta(e.target.value)} placeholder="Compensa cobrar uma implantação menor e ganhar na recorrência? Quais custos esqueci?"/></label>
          <button className={s.primario} disabled={pensando||pergunta.trim().length<5} onClick={()=>void analisar('consultoria',pergunta)}><Sparkles size={17}/>{pensando?'Consultando…':'Consultar IA'}</button>
        </section>
        <section className={s.painel}>
          <h2>Contexto utilizado</h2>
          <div className={s.linhas}><div><span>Despesas fixas mensais</span><b>{moeda(calculo.custoFixoTotal)}</b></div><div><span>Hora de trabalho</span><b>{moeda(config.valorHora)}</b></div><div><span>Margem de lucro</span><b>{config.margem}%</b></div><div><span>Projeto em análise</span><b>{projeto.nome||'Não nomeado'}</b></div></div>
        </section>
      </div>}
      {resposta && <section className={s.resposta} aria-live="polite"><h2><ClipboardCheck size={21}/> Análise da Nexa AI</h2><div>{resposta}</div><button className={s.secundario} onClick={()=>void navigator.clipboard.writeText(resposta)}>Copiar análise</button></section>}
      <p className={s.rodape}>Uso interno nesta versão. Os cálculos não substituem avaliação contábil; a IA não acessa conversas sem seleção e não envia mensagens automaticamente.</p>
      </>}
    </div>
  </NexaShell>;
}
