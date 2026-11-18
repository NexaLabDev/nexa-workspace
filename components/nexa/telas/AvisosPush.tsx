'use client';

// Preferências locais de push e prazos compartilhados das cobranças.
import { useEffect, useState } from 'react';
import { BellPlus, Info, Send, BellOff } from 'lucide-react';
import u from '../ui.module.css';
import { OPCOES_DIAS_ANTES, useConfigAvisos, type ConfigAvisos } from '../notificacoes';
import {
  TIPOS_PUSH, TIPOS_PADRAO, ativarPush, desativarPush, lerEstado, testarPush,
  type EstadoPush, type TipoPush,
} from '../push';

const ICONE = { strokeWidth: 1.7 } as const;

export default function AvisosPush() {
  const { config, salvar, podeEditar } = useConfigAvisos();
  const [estado, setEstado] = useState<EstadoPush>({ tipo: 'desativado' });
  const [tipos, setTipos] = useState<TipoPush[]>([...TIPOS_PADRAO]);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [sujou, setSujou] = useState(false);

  useEffect(() => {
    let ativo = true;
    void lerEstado().then((valor) => {
      if (!ativo) return;
      setEstado(valor);
      if (valor.tipo === 'ativado') setTipos(valor.tipos);
    }).catch(() => { if (ativo) setMensagem('Não foi possível consultar as notificações deste dispositivo.'); });
    return () => { ativo = false; };
  }, []);

  const executar = async (funcao: () => Promise<void>, sucesso: string) => {
    setOcupado(true);
    setMensagem('');
    try {
      await funcao();
      const novo = await lerEstado();
      setEstado(novo);
      if (novo.tipo === 'ativado') setTipos(novo.tipos);
      setSujou(false);
      setMensagem(sucesso);
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : 'Não foi possível concluir a operação.');
    } finally {
      setOcupado(false);
    }
  };
  const mudar = (nova: ConfigAvisos) => {
    if (podeEditar) salvar({ ...nova, diasAntes: [...nova.diasAntes].sort((a, b) => b - a) });
  };
  const chip = (ativo: boolean) => `${u.filtro} ${ativo ? u.filtroAtivo : ''}`;
  const estilo = { cursor: podeEditar ? 'pointer' : 'not-allowed', opacity: podeEditar ? 1 : 0.7 } as const;

  return (
    <>
      <section className={u.painel} id="push-app">
        <header className={u.painelTopo}>
          <BellPlus size={28} {...ICONE} />
          <div>
            <h2>Notificações do aplicativo</h2>
            <small>Mensagens, leads, tarefas e mudanças importantes. Funcionam com o app fechado, após ativar a permissão.</small>
          </div>
          <span className={`${u.status} ${estado.tipo === 'ativado' ? u.stLima : ''}`} style={{ marginLeft: 'auto' }}>
            {estado.tipo === 'ativado' ? 'Ativadas' : estado.tipo === 'bloqueado' ? 'Bloqueadas' : 'Desativadas'}
          </span>
        </header>
        <p className={u.nota}>Escolha quais eventos geram aviso neste aparelho. A central do sininho continua recebendo os eventos permitidos para a sua conta.</p>
        <fieldset className={u.campo} style={{ border: 0, padding: 0, margin: '16px 0' }} disabled={ocupado || estado.tipo === 'sem-suporte' || estado.tipo === 'bloqueado'}>
          <legend style={{ marginBottom: 10 }}>Quero receber avisos de:</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIPOS_PUSH.map((op) => (
              <label key={op.id} className={chip(tipos.includes(op.id))} style={{ cursor: 'pointer', maxWidth: '100%' }}>
                <input type="checkbox" className={u.somenteLeitor} checked={tipos.includes(op.id)} onChange={(e) => {
                  setTipos((atual) => e.target.checked ? [...atual, op.id] : atual.filter((v) => v !== op.id));
                  setSujou(true);
                }} />
                {op.nome}
              </label>
            ))}
          </div>
        </fieldset>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {estado.tipo !== 'ativado' && (
            <button type="button" className={u.btnPrimario} disabled={ocupado || estado.tipo === 'sem-suporte' || estado.tipo === 'bloqueado'} onClick={() => void executar(() => ativarPush(tipos), 'Notificações ativadas neste aparelho.')}>
              <BellPlus size={17} /> Ativar notificações
            </button>
          )}
          {estado.tipo === 'ativado' && (
            <>
              <button type="button" className={u.btnPrimario} disabled={ocupado || !sujou} onClick={() => void executar(() => ativarPush(tipos), 'Preferências salvas para este aparelho.')}>
                Salvar preferências
              </button>
              <button type="button" className={u.filtro} disabled={ocupado} onClick={() => void executar(testarPush, 'Aviso de teste enviado ao serviço de notificações.')}>
                <Send size={16} /> Enviar teste
              </button>
              <button type="button" className={u.filtro} disabled={ocupado} onClick={() => void executar(desativarPush, 'Notificações desativadas neste aparelho.')}>
                <BellOff size={16} /> Desativar
              </button>
            </>
          )}
        </div>
        {estado.tipo === 'sem-suporte' && <p className={u.nota}>Este navegador não oferece push. No iPhone, abra o Nexa como aplicativo instalado na tela inicial.</p>}
        {estado.tipo === 'bloqueado' && <p className={u.nota}>As notificações estão bloqueadas nas permissões deste aparelho. Libere o Nexa nas configurações do sistema.</p>}
        {mensagem && <p className={u.nota} role="status" style={{ marginTop: 12 }}>{mensagem}</p>}
      </section>

      <section className={u.painel} id="avisos">
        <header className={u.painelTopo}>
          <BellPlus size={28} {...ICONE} />
          <div>
            <h2>Avisos de vencimento</h2>
            <small>Parcelas e mensalidades aparecem no sininho no computador e no celular. O aviso some quando a cobrança é paga.</small>
          </div>
          <span className={`${u.status} ${u.stLima}`} style={{ marginLeft: 'auto' }}>Central ativa</span>
        </header>
        <fieldset className={u.campo} style={{ border: 0, margin: 0, padding: 0 }} disabled={!podeEditar}>
          <legend style={{ marginBottom: 8 }}>Quando avisar (vale para toda a equipe)</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {OPCOES_DIAS_ANTES.map((d) => (
              <label key={d} className={chip(config.diasAntes.includes(d))} style={estilo}>
                <input type="checkbox" className={u.somenteLeitor} checked={config.diasAntes.includes(d)}
                  onChange={(e) => mudar({ ...config, diasAntes: e.target.checked ? [...config.diasAntes, d] : config.diasAntes.filter((x) => x !== d) })} />
                {d === 1 ? '1 dia antes' : `${d} dias antes`}
              </label>
            ))}
            <label className={chip(config.noDia)} style={estilo}>
              <input type="checkbox" className={u.somenteLeitor} checked={config.noDia}
                onChange={(e) => mudar({ ...config, noDia: e.target.checked })} /> No dia do vencimento
            </label>
            <label className={chip(config.vencidas)} style={estilo}>
              <input type="checkbox" className={u.somenteLeitor} checked={config.vencidas}
                onChange={(e) => mudar({ ...config, vencidas: e.target.checked })} /> Depois de vencida
            </label>
          </div>
        </fieldset>
        {!podeEditar && <p className={u.nota}>Só o administrador altera quando avisar.</p>}
        <p className={u.nota} style={{ marginTop: 14 }}>
          <Info size={16} /> Os lembretes de vencimento aparecem na central. O push externo envia os eventos novos do workspace, como pagamentos atualizados e vendas.
        </p>
      </section>
    </>
  );
}
