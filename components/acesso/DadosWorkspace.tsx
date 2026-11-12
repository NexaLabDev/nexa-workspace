'use client';

// Liga a sessão do usuário à camada de dados (remoto.ts) e mostra o estado da
// sincronização: carregando, salvando, falha (com "Tentar novamente") e conflito
// (com "Exportar edição" e "Descartar e recarregar"). As telas só aparecem depois
// que os dados do workspace chegaram.

import { useEffect, useState, useSyncExternalStore } from 'react';
import * as remoto from '@/components/nexa/remoto';
import a from './acesso.module.css';

export default function DadosWorkspace({ perfil, children }: { perfil: remoto.Identidade; children: React.ReactNode }) {
  const [montado, setMontado] = useState(false);
  const estado = useSyncExternalStore(remoto.assinar, remoto.status, () => 'Carregando…');

  useEffect(() => {
    remoto.iniciar(perfil);
    setMontado(true);
    void remoto.atualizar();
    const atualizar = () => void remoto.atualizar();
    const online = () => {
      void remoto.enviar();
      atualizar();
    };
    // 30 s: ainda sincroniza outros aparelhos; remoto.atualizar() não rematerializa se nada mudou.
    // Pendências continuam saindo pelo debounce de 300 ms + eventos focus/online.
    const timer = setInterval(() => {
      if (document.hidden) return;
      void remoto.enviar();
      atualizar();
    }, 30_000);
    const proteger = (e: BeforeUnloadEvent) => {
      if (remoto.temPendentes()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('focus', atualizar);
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', proteger);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', proteger);
    };
  }, [perfil]);

  const eu = remoto.identidade();
  const pronto = montado && remoto.disponivel() && eu?.id === perfil.id && eu?.workspace_id === perfil.workspace_id;
  const falha = /^Falha/.test(estado);
  const conflito = remoto.emConflito();

  const exportar = () => {
    const url = URL.createObjectURL(new Blob([remoto.copiaPendente()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'edicao-pendente.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const tentar = () => {
    void remoto.enviar();
    void remoto.atualizar();
  };
  const descartar = () => {
    if (window.confirm('Descartar as alterações que não foram salvas e recarregar os dados atuais do workspace?')) void remoto.descartarPendentes();
  };

  if (!pronto) {
    return (
      <div className={a.carregando} role="status">
        <div>
          <img src="/dashboard/simbolo-nexa.png" alt="" width={40} />
          <p>{falha ? 'Não foi possível carregar os dados do workspace. Confira a conexão.' : 'Carregando os dados do workspace…'}</p>
          {falha && (
            <button type="button" onClick={tentar}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {perfil.papel === 'visualizador' && <div className={a.faixaLeitura}>Modo leitura: seu perfil não altera dados</div>}
      {estado !== 'Salvo' && (
        <aside className={`${a.aviso} ${falha || conflito ? a.avisoErro : ''}`} role="status" aria-live="polite">
          <span>{estado}</span>
          {falha && !conflito && (
            <button type="button" className={a.principal} onClick={tentar}>
              Tentar novamente
            </button>
          )}
          {(falha || conflito) && remoto.temPendentes() && (
            <button type="button" onClick={exportar}>
              Exportar edição
            </button>
          )}
          {conflito && (
            <button type="button" className={a.principal} onClick={descartar}>
              Descartar e recarregar
            </button>
          )}
        </aside>
      )}
    </>
  );
}
