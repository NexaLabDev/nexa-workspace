'use client';
import Link from 'next/link';
import { BrainCircuit, Calculator, ShieldCheck, Wallet } from 'lucide-react';
import NexaShell from '../NexaShell';
import NexaChat from './NexaChat';
import s from './intelligence.module.css';

export default function TelaIntelligence() {
  return (
    <NexaShell aba="intelligence" marcaTitulo="Nexa Intelligence" ocultarAcoesTopo>
      <div className={s.pagina}>
        <header className={s.cabecalho}>
          <div className={s.tituloLinha}>
            <BrainCircuit size={30} aria-hidden />
            <div>
              <h1>Nexa Intelligence</h1>
              <p>Converse sobre seus projetos, preços, custos e atendimento.</p>
            </div>
          </div>
          <span className={s.privado}><ShieldCheck size={15} aria-hidden/> Acesso administrativo</span>
        </header>
        <nav className={s.abas} aria-label="Ferramentas financeiras">
          <Link className={s.linkAtivo} href="/intelligence" scroll={false}>
            <BrainCircuit size={17} aria-hidden/> Chat da IA
          </Link>
          <Link className={s.linkFerramenta} href="/intelligence/gestao" scroll={false}>
            <Calculator size={17} aria-hidden/> Precificação, custos e atendimento
          </Link>
        </nav>
        <NexaChat/>
        <p className={s.rodape}>A Nexa Intelligence usa os gastos e orçamentos cadastrados para contextualizar as respostas. Nenhuma conversa de cliente é analisada automaticamente.</p>
      </div>
    </NexaShell>
  );
}
