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
          <section className={u.painel}>
            <header className={u.painelTopo}>
              <UserRound size={28} {...ICONE} />
              <h2>Perfil</h2>
            </header>
            <div className={u.formGrade}>
              <label className={u.campo}>
                <span>Nome</span>
                <input
                  className={u.entrada}
                  value={perfil.nome ?? ''}
                  maxLength={80}
                  placeholder="Seu nome"
                  onChange={(e) => setPerfil((p) => ({ ...p, nome: e.target.value }))}
                />
              </label>
              <label className={u.campo}>
                <span>E-mail</span>
                <input className={u.entrada} placeholder="[A DEFINIR]" />
              </label>
              <label className={u.campo}>
                <span>Empresa</span>
                <input className={u.entrada} value="Nexa Lab" readOnly />
              </label>
              <label className={u.campo}>
                <span>Cargo</span>
                <input className={u.entrada} placeholder="[A DEFINIR]" />
              </label>
            </div>
            <p className={u.nota} style={{ marginTop: 18 }}>
              <Info size={16} /> O nome fica salvo neste navegador e identifica suas atividades nos projetos como &quot;não
              autenticado&quot; até existir login. E-mail e cargo ainda não são salvos.
            </p>
          </section>

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

        <section className={u.painel}>
          <header className={u.painelTopo}>
            <Database size={28} strokeWidth={1.7} />
            <div>
              <h2>Dados deste navegador</h2>
              <small>Leads, conversas, vendas, metas, projetos, clientes, documentos e arquivos anexados ficam salvos aqui até existir um banco de dados.</small>
            </div>
          </header>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className={u.btnPrimario}
              disabled={backupOcupado}
              onClick={async () => {
                setBackupOcupado(true);
                setBackupMsg(null);
                try {
                  const r = await baixarBackup();
                  setBackupMsg({ texto: `Backup baixado: ${r.listas} listas e ${r.arquivos} anexos. Guarde em local seguro (tem dados de clientes).` });
                } catch (e) {
                  setBackupMsg({ texto: `Não foi possível gerar o backup: ${(e as Error).message}`, erro: true });
                } finally {
                  setBackupOcupado(false);
                }
              }}
            >
              <Download size={17} /> Baixar backup completo
            </button>
            <label className={u.btnSecundario} style={{ cursor: backupOcupado ? 'not-allowed' : 'pointer' }}>
              <Upload size={17} /> Restaurar backup
              <input
                type="file"
                accept="application/json,.json"
                hidden
                disabled={backupOcupado}
                onChange={async (e) => {
                  const arquivo = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (!arquivo) return;
                  setBackupMsg(null);
                  try {
                    const b = await lerBackup(arquivo);
                    const quando = new Date(b.criadoEm).toLocaleString('pt-BR');
                    if (!window.confirm(`Restaurar o backup de ${quando}? As listas atuais serão substituídas pelas do backup. Antes, um backup do estado atual será baixado automaticamente.`)) return;
                    setBackupOcupado(true);
                    await restaurarBackup(b);
                    setBackupMsg({ texto: `Backup de ${quando} restaurado. O estado anterior foi baixado como backup.` });
                  } catch (err) {
                    setBackupMsg({ texto: (err as Error).message, erro: true });
                  } finally {
                    setBackupOcupado(false);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className={u.btnSecundario}
              onClick={() => {
                if (window.confirm('Apagar tudo o que foi salvo neste navegador e voltar aos dados de exemplo? Baixe um backup antes, se quiser guardar os dados.')) {
                  restaurarExemplos();
                  apagarTodosArquivos().catch(() => undefined);
                }
              }}
            >
              <RotateCcw size={17} /> Restaurar dados de exemplo
            </button>
          </div>
          {backupMsg && (
            <p className={u.nota} role="status" style={{ marginTop: 12, ...(backupMsg.erro ? { color: '#ffb199' } : {}) }}>
              {backupMsg.texto}
            </p>
          )}
        </section>
      </div>
    </NexaShell>
  );
}
