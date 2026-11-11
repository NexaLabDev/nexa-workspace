'use client';

// ABA CONFIGURAÇÕES — perfil e notificações.
// Nada é salvo ainda (sem banco). Dados que faltam aparecem como [A DEFINIR].

import { useState } from 'react';
import { BadgeCheck, BellRing, CalendarClock, Database, Download, Info, RotateCcw, Upload, UserRound } from 'lucide-react';
import NexaShell from '../NexaShell';
import u from '../ui.module.css';
import { restaurarExemplos } from '../store';
import { apagarTodosArquivos } from '../arquivos';
import { OPCOES_DIAS_PRAZO_PROXIMO, diasPrazoProximo, usePerfil, usePreferencias, usePrestadora } from '../dados';
import Importar from '@/components/acesso/Importar';
import Equipe from '@/components/acesso/Equipe';
import AvisosPush from './AvisosPush';
import { baixarBackup, lerBackup, restaurarBackup } from '../backup';

const ICONE = { strokeWidth: 1.7 } as const;

const AVISOS = [
  { id: 'propostas', nome: 'Novas propostas' },
  { id: 'contratos', nome: 'Contratos assinados' },
  { id: 'agenda', nome: 'Lembretes da agenda' },
];

export default function TelaConfiguracoes() {
  const [perfil, setPerfil] = usePerfil();
  const [prefs, setPrefs] = usePreferencias();
  const [prestadora, setPrestadora] = usePrestadora();
  const [backupOcupado, setBackupOcupado] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [avisos, setAvisos] = useState<Record<string, boolean>>({ propostas: true, contratos: true, agenda: false });

  return (
    <NexaShell aba="configuracoes">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Configurações</h1>
            <p>Preferências do Nexa Workspace.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
        </div>

        <div className={u.grade2}>
          <Equipe />

          <section className={u.painel}>
            <header className={u.painelTopo}>
              <BellRing size={28} {...ICONE} />
              <h2>Notificações</h2>
            </header>
            <ul className={u.resumoLista}>
              {AVISOS.map((a) => (
                <li key={a.id} className={u.resumoItem}>
                  <span id={`aviso-${a.id}`}>{a.nome}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={avisos[a.id]}
                    aria-labelledby={`aviso-${a.id}`}
                    className={`${u.interruptor} ${avisos[a.id] ? u.interruptorLigado : ''}`}
                    onClick={() => setAvisos((v) => ({ ...v, [a.id]: !v[a.id] }))}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <Importar/>
        {/* ----- Dados da prestadora: usados nos documentos (nunca ficam no código) ----- */}
        <section className={u.painel} id="prestadora">
          <header className={u.painelTopo}>
            <BadgeCheck size={28} strokeWidth={1.7} />
            <div>
              <h2>Dados da prestadora</h2>
              <small>Aparecem no contrato, na ordem de serviço e no recibo. Ficam só salvos aqui, preenchidos por você.</small>
            </div>
          </header>
          <div className={u.formGrade}>
            {(
              [
                ['nome', 'Nome completo'],
                ['cpf', 'CPF'],
                ['email', 'E-mail'],
                ['cidade', 'Cidade/UF (foro e local de assinatura)'],
                ['endereco', 'Endereço completo'],
              ] as const
            ).map(([chave, rotulo]) => (
              <label key={chave} className={`${u.campo} ${chave === 'endereco' ? u.formCheia : ''}`}>
                <span>{rotulo}</span>
                <input
                  className={u.entrada}
                  defaultValue={prestadora[chave] ?? ''}
                  key={`${chave}-${prestadora[chave] ?? ''}`}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v !== (prestadora[chave] ?? '')) setPrestadora((p) => ({ ...p, [chave]: v || undefined }));
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        <AvisosPush />

        <section className={u.painel} id="prazos-tarefas">
          <header className={u.painelTopo}>
            <CalendarClock size={28} strokeWidth={1.7} />
            <h2>Prazos das tarefas</h2>
          </header>
          <label className={u.campo} style={{ maxWidth: 420 }}>
            <span>Mostrar como &quot;prazo próximo&quot; as tarefas que vencem em até</span>
            <select
              className={u.entrada}
              value={diasPrazoProximo(prefs)}
              onChange={(e) => setPrefs((p) => ({ ...p, diasPrazoProximo: Number(e.target.value) }))}
            >
              {OPCOES_DIAS_PRAZO_PROXIMO.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'Só no dia (hoje)' : `${n} dia${n > 1 ? 's' : ''}${n === 2 ? ' (padrão)' : ''}`}
                </option>
              ))}
            </select>
          </label>
          <p className={u.nota} style={{ marginTop: 14 }}>
            <Info size={16} /> Vale para a aba Tarefas dos projetos e para o sininho. Tarefas vencidas aparecem sempre, até serem
            concluídas ou terem o prazo alterado. Salvo neste navegador.
          </p>
        </section>


      </div>
    </NexaShell>
  );
}
