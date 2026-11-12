'use client';

// ABA CONFIGURAÇÕES — conta e equipe, dados da prestadora, avisos, prazos,
// backup/importação e auditoria. Tudo salvo no Supabase, conforme o perfil de acesso.

import { BadgeCheck, CalendarClock, Info } from 'lucide-react';
import NexaShell from '../NexaShell';
import u from '../ui.module.css';
import { OPCOES_DIAS_PRAZO_PROXIMO, diasPrazoProximo, usePreferencias, usePrestadora } from '../dados';
import { podeEscrever } from '../remoto';
import Importar from '@/components/acesso/Importar';
import Equipe from '@/components/acesso/Equipe';
import Auditoria from '@/components/acesso/Auditoria';
import AvisosPush from './AvisosPush';

export default function TelaConfiguracoes() {
  const [prefs, setPrefs] = usePreferencias();
  const [prestadora, setPrestadora] = usePrestadora();
  const editaPrestadora = podeEscrever('prestadora');
  const editaPrefs = podeEscrever('preferencias');

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

        <Equipe />

        {/* ----- Dados da prestadora: usados nos documentos (nunca ficam no código) ----- */}
        <section className={u.painel} id="prestadora">
          <header className={u.painelTopo}>
            <BadgeCheck size={28} strokeWidth={1.7} />
            <div>
              <h2>Dados da prestadora</h2>
              <small>Aparecem no contrato, na ordem de serviço e no recibo. Editados por administrador ou gestor.</small>
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
                  readOnly={!editaPrestadora}
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
              disabled={!editaPrefs}
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
            concluídas ou terem o prazo alterado. Vale para toda a equipe; só o administrador altera.
          </p>
        </section>

        <Importar />
        <Auditoria />
      </div>
    </NexaShell>
  );
}
