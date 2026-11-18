'use client';

// Configurações → Avisos de vencimento.
// Os avisos aparecem na central (sininho) em todos os aparelhos, calculados dos dados
// sincronizados. A notificação push (com o Workspace fechado) depende de um serviço
// agendado no servidor e ainda não está disponível nesta versão.

import { BellPlus, Info, BellRing, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ativarPush, desativarPush, lerEstadoPush, testarPushLocal, type EstadoPush } from '../push';
import u from '../ui.module.css';
import { OPCOES_DIAS_ANTES, useConfigAvisos, type ConfigAvisos } from '../notificacoes';

const ICONE = { strokeWidth: 1.7 } as const;

export default function AvisosPush() {
  const { config, salvar, podeEditar } = useConfigAvisos();
  const [estado, setEstado] = useState<EstadoPush>('desativado');
  const [executando, setExecutando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const recarregar = async () => {
    try { setEstado(await lerEstadoPush()); }
    catch { setMensagem('Não foi possível consultar a permissão do dispositivo.'); }
  };

  useEffect(() => { void recarregar(); }, []);

  async function executar(acao: 'ativar' | 'desativar' | 'teste') {
    setExecutando(true);
    setMensagem('');
    try {
      if (acao === 'ativar') await ativarPush();
      else if (acao === 'desativar') await desativarPush();
      else await testarPushLocal();
      if (acao === 'teste') setMensagem('Aviso local exibido. O envio remoto acontece pelos eventos do Workspace.');
      else setMensagem(acao === 'ativar'
        ? 'Notificações ativadas para mensagens, leads, tarefas, prazos e alertas importantes.'
        : 'Notificações desativadas neste aparelho.');
      await recarregar();
    } catch(e) { setMensagem(e instanceof Error ? e.message : 'Não foi possível alterar as notificações.'); }
    finally { setExecutando(false); }
  }
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
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--borda, #313536)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <BellRing size={22} />
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 6px' }}>Notificações do aplicativo</h3>
              <p className={u.nota}>
                Mensagens recebidas, novos leads, tarefas e responsáveis, prazos, movimentações,
                documentos e alertas financeiros. As notificações são individuais por conta e dispositivo.
              </p>
            </div>
            <span className={`${u.status} ${estado === 'ativado' ? u.stLima : ''}`}>
              {estado === 'ativado' ? 'Ativadas' : estado === 'bloqueado' ? 'Bloqueadas' :
                estado === 'sem-suporte' ? 'Indisponíveis' : 'Desativadas'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 14, flexWrap: 'wrap' }}>
            {estado !== 'ativado' ? (
              <button type="button" className={u.btnPrimario} disabled={executando || estado === 'sem-suporte' || estado === 'bloqueado'}
                onClick={() => void executar('ativar')}>
                <BellRing size={17} /> Ativar notificações
              </button>
            ) : (
              <>
                <button type="button" className={u.btnSecundario} disabled={executando}
                  onClick={() => void executar('teste')}>Testar aviso neste aparelho</button>
                <button type="button" className={u.btnFantasma} disabled={executando}
                  onClick={() => void executar('desativar')}>Desativar neste aparelho</button>
              </>
            )}
          </div>
          {mensagem && <p role="status" className={u.nota} style={{ marginTop: 12 }}>{mensagem}</p>}
          {estado === 'bloqueado' && <p className={u.nota} style={{ marginTop: 8 }}>
            A permissão foi bloqueada pelo sistema. Libere as notificações nas configurações deste dispositivo.
          </p>}
          <p className={u.nota} style={{ marginTop: 12 }}>
            <ShieldCheck size={16} /> O app não ativa notificações sem sua permissão. O conteúdo pode aparecer
            na tela bloqueada conforme as configurações de privacidade do aparelho.
          </p>
        </div>
      </div>
    </section>
  );
}
