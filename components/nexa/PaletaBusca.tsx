'use client';

// Busca global (Ctrl + K): encontra telas, leads, clientes, projetos e documentos.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, X } from 'lucide-react';
import s from './shell.module.css';
import { useClientes, useDocumentos, useLeads, useProjetos, nomeEtapaLead } from './dados';
import { etapasProjeto } from './dados-exemplo';

type Resultado = { id: string; grupo: string; titulo: string; detalhe?: string; href: string };

const TELAS: Resultado[] = [
  { id: 't-inicio', grupo: 'Telas', titulo: 'Dashboard', href: '/' },
  { id: 't-crm', grupo: 'Telas', titulo: 'CRM de Leads', href: '/crm' },
  { id: 't-conversas', grupo: 'Telas', titulo: 'Conversas', href: '/conversas' },
  { id: 't-metas', grupo: 'Telas', titulo: 'Meta Mensal', href: '/metas' },
  { id: 't-receb', grupo: 'Telas', titulo: 'Recebimentos', href: '/recebimentos' },
  { id: 't-clientes', grupo: 'Telas', titulo: 'Clientes', href: '/clientes' },
  { id: 't-kanban', grupo: 'Telas', titulo: 'Kanban de projetos', href: '/kanban' },
  { id: 't-servicos', grupo: 'Telas', titulo: 'Serviços', href: '/catalogo' },
  { id: 't-calc', grupo: 'Telas', titulo: 'Calculadora de Serviço', href: '/calculadora' },
  { id: 't-docs', grupo: 'Telas', titulo: 'Gerador de Documentos', href: '/documentos' },
  { id: 't-config', grupo: 'Telas', titulo: 'Configurações', href: '/configuracoes' },
];

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default function PaletaBusca({ onFechar, termoInicial = '' }: { onFechar: () => void; termoInicial?: string }) {
  const router = useRouter();
  const [termo, setTermo] = useState(termoInicial);
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const [leads] = useLeads();
  const [clientes] = useClientes();
  const [projetos] = useProjetos();
  const [documentos] = useDocumentos();

  useEffect(() => {
    campo.current?.focus();
  }, []);

  const resultados = useMemo(() => {
    const todos: Resultado[] = [
      ...TELAS,
      ...leads.map((l) => ({
        id: `l-${l.id}`,
        grupo: 'Leads',
        titulo: l.empresa,
        detalhe: `${l.descricao} · ${nomeEtapaLead(l.etapa)}`,
        href: `/crm?lead=${encodeURIComponent(l.id)}`,
      })),
      ...clientes.map((c) => ({
        id: `c-${c.id}`,
        grupo: 'Clientes',
        titulo: c.nome,
        detalhe: `${c.segmento} · ${c.status}`,
        href: `/clientes?busca=${encodeURIComponent(c.nome)}`,
      })),
      ...projetos.map((p) => ({
        id: `p-${p.id}`,
        grupo: 'Projetos',
        titulo: `${p.servico} — ${p.cliente}`,
        detalhe: etapasProjeto.find((e) => e.id === p.etapa)?.nome,
        href: `/kanban?projeto=${encodeURIComponent(p.id)}`,
      })),
      ...documentos.map((d) => ({
        id: `d-${d.id}`,
        grupo: 'Documentos',
        titulo: d.titulo,
        detalhe: d.descricao,
        href: `/documentos?filtro=${encodeURIComponent(d.tipo)}`,
      })),
    ];
    const t = normalizar(termo.trim());
    if (!t) return TELAS;
    return todos.filter((r) => normalizar(`${r.titulo} ${r.detalhe ?? ''}`).includes(t)).slice(0, 30);
  }, [termo, leads, clientes, projetos, documentos]);

  useEffect(() => setAtivo(0), [termo]);

  const abrir = (r: Resultado) => {
    onFechar();
    router.push(r.href);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onFechar();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && resultados[ativo]) {
      e.preventDefault();
      abrir(resultados[ativo]);
    }
  };

  let grupoAnterior = '';

  return (
    <div className={s.paletaFundo} onClick={onFechar}>
      <div
        className={s.paleta}
        role="dialog"
        aria-modal="true"
        aria-label="Busca"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={teclas}
      >
        <div className={s.paletaCampo}>
          <Search size={20} strokeWidth={1.8} aria-hidden />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar telas, leads, clientes, projetos ou documentos..."
            aria-label="O que você procura?"
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-resultados"
            aria-activedescendant={resultados[ativo] ? `res-${resultados[ativo].id}` : undefined}
          />
          <button type="button" className={s.paletaFechar} onClick={onFechar} aria-label="Fechar busca">
            <X size={18} />
          </button>
        </div>
        <ul id="paleta-resultados" className={s.paletaLista} role="listbox">
          {resultados.map((r, i) => {
            const cabecalho = r.grupo !== grupoAnterior ? r.grupo : null;
            grupoAnterior = r.grupo;
            return (
              <li key={r.id} role="presentation">
                {cabecalho && <p className={s.paletaGrupo}>{cabecalho}</p>}
                <button
                  id={`res-${r.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === ativo}
                  className={`${s.paletaItem} ${i === ativo ? s.paletaItemAtivo : ''}`}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => abrir(r)}
                >
                  <span>
                    <strong>{r.titulo}</strong>
                    {r.detalhe && <small>{r.detalhe}</small>}
                  </span>
                  <ArrowRight size={16} aria-hidden />
                </button>
              </li>
            );
          })}
          {resultados.length === 0 && <li className={s.paletaVazio}>Nada encontrado para “{termo}”.</li>}
        </ul>
        <p className={s.paletaRodape}>
          <kbd>↑</kbd> <kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> fechar
        </p>
      </div>
    </div>
  );
}
