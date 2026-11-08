'use client';

// Configurações → Avisos de vencimento no navegador (push de verdade, enviados pelo servidor local).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellPlus, BellOff, RefreshCw, Send } from 'lucide-react';
import u from '../ui.module.css';
import { useLeads } from '../dados';
import { ativarPush, desativarPush, lerEstado, testarPush, verificarAgora, type EstadoPush, type InfoServidor } from '../push';
import { lerConfigAvisos, OPCOES_DIAS_ANTES, salvarConfigAvisos, type ConfigAvisos } from '../notificacoes';

const ICONE = { strokeWidth: 1.7 } as const;

function quando(iso: string | null | undefined): string {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'ainda não' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AvisosPush() {
  const [leads] = useLeads();
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [servidor, setServidor] = useState<InfoServidor | null>(null);
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [config, setConfig] = useState<ConfigAvisos | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);

  const responsaveis = useMemo(
    () => Array.from(new Set(leads.map((l) => l.responsavel?.trim()).filter((r): r is string => !!r))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [leads]
  );

  const atualizar = useCallback(async () => {
    const r = await lerEstado().catch(() => ({ estado: { tipo: 'desativado' } as EstadoPush, servidor: null }));
    setEstado(r.estado);
    setServidor(r.servidor);
    if (r.estado.tipo === 'ativado') setFiltro(r.estado.filtro ?? '');
  }, []);

  useEffect(() => {
    atualizar();
    lerConfigAvisos()
      .then(setConfig)
      .catch((e) => setErroConfig((e as Error).message));
  }, [atualizar]);

  const mudarConfig = (nova: ConfigAvisos) => {
    const anterior = config;
    setConfig(nova);
    salvarConfigAvisos(nova)
      .then(setConfig)
      .catch((e) => {
        setConfig(anterior);
        setMensagem({ texto: (e as Error).message, erro: true });
      });
  };

  const executar = async (acao: () => Promise<string>) => {
    setOcupado(true);
    setMensagem(null);
    try {
      setMensagem({ texto: await acao() });
    } catch (e) {
      setMensagem({ texto: (e as Error).message, erro: true });
    } finally {
      setOcupado(false);
      atualizar();
    }
  };

  const ativado = estado?.tipo === 'ativado';
  const rotuloEstado =
    estado == null
      ? 'Conferindo…'
      : estado.tipo === 'ativado'
        ? 'Ativados neste navegador'
        : estado.tipo === 'bloqueado'
          ? 'Bloqueados pelo navegador'
          : estado.tipo === 'sem-suporte'
            ? 'Navegador sem suporte'
            : 'Desativados neste navegador';
  const classeEstado = ativado ? u.stLima : estado?.tipo === 'bloqueado' ? u.stLaranja : u.stCinza;

  return (
    <section className={u.painel} id="avisos">
      <header className={u.painelTopo}>
        <BellPlus size={28} {...ICONE} />
        <div>
          <h2>Avisos de vencimento</h2>
          <small>
            O servidor gera os avisos de parcelas e mensalidades na central (sininho) e, se ativado, envia notificação ao
            navegador. Cada aviso sai uma vez só e some quando a cobrança é paga.
          </small>
        </div>
        <span className={`${u.status} ${classeEstado}`} style={{ marginLeft: 'auto' }} role="status">
          {rotuloEstado}
        </span>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <fieldset className={u.campo} style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ marginBottom: 8 }}>Quando avisar (vale para a central e para o push)</legend>
          {config ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {OPCOES_DIAS_ANTES.map((d) => (
                <label key={d} className={`${u.filtro} ${config.diasAntes.includes(d) ? u.filtroAtivo : ''}`} style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className={u.somenteLeitor}
                    checked={config.diasAntes.includes(d)}
                    onChange={(e) =>
                      mudarConfig({ ...config, diasAntes: e.target.checked ? [...config.diasAntes, d] : config.diasAntes.filter((x) => x !== d) })
                    }
                  />
                  {d === 1 ? '1 dia antes' : `${d} dias antes`}
                </label>
              ))}
              <label className={`${u.filtro} ${config.noDia ? u.filtroAtivo : ''}`} style={{ cursor: 'pointer' }}>
                <input type="checkbox" className={u.somenteLeitor} checked={config.noDia} onChange={(e) => mudarConfig({ ...config, noDia: e.target.checked })} />
                No dia do vencimento
              </label>
              <label className={`${u.filtro} ${config.vencidas ? u.filtroAtivo : ''}`} style={{ cursor: 'pointer' }}>
                <input type="checkbox" className={u.somenteLeitor} checked={config.vencidas} onChange={(e) => mudarConfig({ ...config, vencidas: e.target.checked })} />
                Depois de vencida
              </label>
            </div>
          ) : (
            <p className={u.nota}>{erroConfig ?? 'Carregando…'}</p>
          )}
        </fieldset>

        <label className={u.campo} style={{ maxWidth: 360 }}>
          <span>Receber avisos de</span>
          <select className={u.entrada} value={filtro} onChange={(e) => setFiltro(e.target.value)} disabled={ocupado || estado?.tipo === 'sem-suporte'}>
            <option value="">Todos os leads</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>
                Leads de {r}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            className={u.btnPrimario}
            disabled={ocupado || estado?.tipo === 'sem-suporte'}
            onClick={() =>
              executar(async () => {
                await ativarPush(filtro || null);
                return ativado ? 'Preferência atualizada.' : 'Avisos ativados. Use “Enviar teste” para conferir.';
              })
            }
          >
            <BellPlus size={17} /> {ativado ? 'Salvar preferência' : 'Ativar avisos'}
          </button>
          {ativado && (
            <>
              <button
                type="button"
                className={u.btnSecundario}
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    await testarPush();
                    return 'Teste enviado. A notificação deve aparecer em alguns segundos.';
                  })
                }
              >
                <Send size={16} /> Enviar teste
              </button>
              <button
                type="button"
                className={u.btnSecundario}
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    const r = await verificarAgora();
                    if (!r.verificado) return r.motivo ?? 'Não foi possível verificar agora.';
                    const central = `Central: ${r.ativas} aviso(s) ativo(s).`;
                    if (r.falhas) return `${central} Push: ${r.enviados} enviado(s), ${r.falhas} falha(s). Veja o terminal do servidor.`;
                    return r.enviados ? `${central} Push: ${r.enviados} enviado(s).` : `${central} Nenhum push novo para enviar.`;
                  })
                }
              >
                <RefreshCw size={16} /> Verificar agora
              </button>
              <button
                type="button"
                className={u.btnSecundario}
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    await desativarPush();
                    return 'Avisos desativados neste navegador.';
                  })
                }
              >
                <BellOff size={16} /> Desativar
              </button>
            </>
          )}
        </div>

        {mensagem && (
          <p className={u.nota} role="status" style={mensagem.erro ? { color: '#ffb199' } : undefined}>
            {mensagem.texto}
          </p>
        )}
        {estado?.tipo === 'bloqueado' && (
          <p className={u.nota}>As notificações deste site estão bloqueadas. Libere em “Configurações do site” no cadeado da barra de endereço.</p>
        )}
        <p className={u.nota}>
          Os avisos saem do servidor do Workspace, então este computador precisa estar ligado com o Workspace rodando. Envio das 8h às
          21h, conferindo a cada 15 minutos. Última verificação: {quando(servidor?.ultimaVerificacao)} · leads enviados ao servidor:{' '}
          {quando(servidor?.leadsSincronizadosEm)}.
        </p>
      </div>
    </section>
  );
}
