'use client';
import { BrainCircuit, ShieldCheck } from 'lucide-react';
import NexaShell from '../NexaShell';
import NexaChat from './NexaChat';
import s from './intelligence.module.css';

export default function TelaIntelligence() {
  return (
    <NexaShell aba="intelligence" marcaTitulo="Nexa Intelligence" ocultarAcoesTopo>
      <div className={s.pagina}>
        <header className={s.cabecalho}>
          <div className={s.tituloLinha}><BrainCircuit size={30} aria-hidden/>
            <div><h1>Nexa Intelligence</h1><p>Conte seus gastos e projetos. A IA pergunta, calcula e atualiza os dados aqui mesmo.</p></div>
          </div>
          <span className={s.privado}><ShieldCheck size={15} aria-hidden/> Acesso administrativo</span>
        </header>
        <NexaChat/>
      </div>
    </NexaShell>
  );
}
