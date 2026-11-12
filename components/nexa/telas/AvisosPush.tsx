'use client';

// Configurações → Avisos de vencimento.
// Os avisos aparecem na central (sininho) em todos os aparelhos, calculados dos dados
// sincronizados. A notificação push (com o Workspace fechado) depende de um serviço
// agendado no servidor e ainda não está disponível nesta versão.

import { BellPlus, Info } from 'lucide-react';
import u from '../ui.module.css';
import { OPCOES_DIAS_ANTES, useConfigAvisos, type ConfigAvisos } from '../notificacoes';

const ICONE = { strokeWidth: 1.7 } as const;

export default function AvisosPush() {
  const { config, salvar, podeEditar } = useConfigAvisos();
  const mudar = (nova: ConfigAvisos) => {
    if (podeEditar) salvar({ ...nova, diasAntes: [...nova.diasAntes].sort((a, b) => b - a) });
  };
  const chip = (ativo: boolean) => `${u.filtro} ${ativo ? u.filtroAtivo : ''}`;
  const estilo = { cursor: podeEditar ? 'pointer' : 'not-allowed', opacity: podeEditar ? 1 : 0.7 } as const;

  return (
    <section className={u.painel} id="avisos">
      <header className={u.painelTopo}>
        <BellPlus size={28} {...ICONE} />
        <div>
          <h2>Avisos de vencimento</h2>
          <small>
            Parcelas e mensalidades aparecem na central de notificações (sininho), no computador e no celular. Cada aviso
            some quando a cobrança é paga.
          </small>
        </div>
        <span className={`${u.status} ${u.stLima}`} style={{ marginLeft: 'auto' }}>
          Central ativa
        </span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <fieldset className={u.campo} style={{ border: 0, margin: 0, padding: 0 }} disabled={!podeEditar}>
          <legend style={{ marginBottom: 8 }}>Quando avisar (vale para toda a equipe)</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OPCOES_DIAS_ANTES.map((d) => (
              <label key={d} className={chip(config.diasAntes.includes(d))} style={estilo}>
                <input
                  type="checkbox"
                  className={u.somenteLeitor}
                  checked={config.diasAntes.includes(d)}
                  onChange={(e) => mudar({ ...config, diasAntes: e.target.checked ? [...config.diasAntes, d] : config.diasAntes.filter((x) => x !== d) })}
                />
                {d === 1 ? '1 dia antes' : `${d} dias antes`}
              </label>
            ))}
            <label className={chip(config.noDia)} style={estilo}>
              <input type="checkbox" className={u.somenteLeitor} checked={config.noDia} onChange={(e) => mudar({ ...config, noDia: e.target.checked })} />
              No dia do vencimento
            </label>
            <label className={chip(config.vencidas)} style={estilo}>
              <input type="checkbox" className={u.somenteLeitor} checked={config.vencidas} onChange={(e) => mudar({ ...config, vencidas: e.target.checked })} />
              Depois de vencida
            </label>
          </div>
        </fieldset>
        {!podeEditar && <p className={u.nota}>Só o administrador altera quando avisar.</p>}
        <p className={u.nota}>
          <Info size={16} /> Notificação push com o Workspace fechado: indisponível nesta versão. Ela depende de um serviço
          agendado no servidor, que ainda será configurado. Por enquanto os avisos aparecem ao abrir o Workspace.
        </p>
      </div>
    </section>
  );
}
