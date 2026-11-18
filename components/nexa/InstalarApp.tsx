'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import u from './ui.module.css';

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function modoInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalado(modoInstalado());
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacao);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setEvento(null);
    };
    window.addEventListener('beforeinstallprompt', aoPrompt);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPrompt);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  const instalar = async () => {
    if (!evento) return;
    try {
      await evento.prompt();
      const escolha = await evento.userChoice;
      if (escolha.outcome === 'accepted') setInstalado(true);
    } finally {
      setEvento(null);
    }
  };

  return (
    <section className={u.painel} aria-labelledby="titulo-instalar-app">
      <header className={u.painelTopo}>
        <Smartphone size={28} className={u.iconeVerde} />
        <div>
          <h2 id="titulo-instalar-app">Nexa Workspace como aplicativo</h2>
          <small>Ícone na tela inicial e abertura sem a barra do navegador.</small>
        </div>
      </header>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/pwa/icon/192"
          alt="Ícone do Nexa Workspace"
          width={68}
          height={68}
          style={{ borderRadius: 16, flexShrink: 0 }}
        />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <p style={{ lineHeight: 1.55, overflowWrap: 'anywhere' }}>
            {instalado
              ? 'O Nexa já está aberto em modo aplicativo neste dispositivo.'
              : ios
                ? 'No iPhone: abra este endereço no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'
                : evento
                  ? 'Seu navegador permite instalar o Nexa diretamente.'
                  : 'No Chrome ou Edge, abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.'}
          </p>
          {evento && !instalado && (
            <button type="button" className={u.btnPrimario} style={{ marginTop: 12 }} onClick={() => void instalar()}>
              <Download size={18} /> Instalar Nexa Workspace
            </button>
          )}
        </div>
      </div>
      <p className={u.nota} style={{ marginTop: 14 }}>
        Para entrar e trabalhar, continue usando sua conta. Sem conexão, o aplicativo exibe apenas um aviso;
        dados privados não ficam disponíveis offline.
      </p>
    </section>
  );
}
