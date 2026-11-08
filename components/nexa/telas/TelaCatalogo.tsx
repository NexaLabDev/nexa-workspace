'use client';

// ABA SERVIÇOS — cadastro dos serviços da Nexa Lab.
// Cada serviço pode ter valor de implantação e valor de mensalidade (opcionais).
// Esses valores são sugeridos no lead ao escolher o "Serviço contratado".
// Preços ficam [A DEFINIR] até serem cadastrados aqui: nenhum valor foi inventado.
// "Campos e checklist": campos personalizados que aparecem na Ficha dos projetos com o
// serviço e o checklist padrão (modelo de tarefas). Nada disso vem pronto do código.

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Pencil,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import NexaShell from '../NexaShell';
import Modal from '../Modal';
import u from '../ui.module.css';
import type { ServicoNexa } from '../servicos-nexa';
import { useServicos } from '../dados';
import { reais } from '../util';
import ConfigurarServico from './ConfigurarServico';
import c from './catalogo.module.css';

const ICONES: Record<string, LucideIcon> = {
  sites: Globe,
  apps: Smartphone,
  gestao: LayoutDashboard,
  automacoes: Workflow,
  consultoria: Lightbulb,
  manutencao: Wrench,
};

function lerValor(texto: string): number | null {
  if (!texto.trim()) return null;
  const n = Number(texto.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

function paraTexto(v?: number | null): string {
  return v == null ? '' : String(v).replace('.', ',');
}

export default function TelaCatalogo() {
  const [servicos, setServicos] = useServicos();
  const [editando, setEditando] = useState<ServicoNexa | 'novo' | null>(null);
  const [configurando, setConfigurando] = useState<ServicoNexa | null>(null);

  return (
    <NexaShell aba="servicos">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Serviços</h1>
            <p>O que a Nexa Lab faz, do site ao sistema de gestão.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
          <div className={u.acoesCabecalho}>
            <Link href="/calculadora" className={u.btnSecundario}>
              Abrir calculadora
            </Link>
            <button type="button" className={u.btnPrimario} onClick={() => setEditando('novo')}>
              <Plus size={18} strokeWidth={2.2} /> Novo serviço
            </button>
          </div>
        </div>

        <div className={u.gradeCartoes}>
          {servicos.map((sv) => {
            const Icone = ICONES[sv.id] ?? Box;
            return (
              <article key={sv.id} className={`${u.painel} ${u.cartaoServico}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span className={u.iconeCaixa}>
                    <Icone size={26} strokeWidth={1.7} />
                  </span>
                  <button type="button" className={`${u.btnIcone} ${u.empurra}`} onClick={() => setEditando(sv)} aria-label={`Editar ${sv.nome}`} title="Editar">
                    <Pencil size={17} />
                  </button>
                </div>
                <h2>{sv.nome}</h2>
                <p>{sv.descricao}</p>
                {(() => {
                  const nCampos = (sv.campos ?? []).filter((x) => !x.arquivado).length;
                  const nObrig = (sv.campos ?? []).filter((x) => !x.arquivado && x.obrigatorio).length;
                  const nItens = (sv.checklist ?? []).length;
                  return (
                    <>
                      {(nCampos > 0 || nItens > 0) && (
                        <div className={c.resumoConfig}>
                          {nCampos > 0 && (
                            <span>
                              {nCampos} campo{nCampos > 1 ? 's' : ''}
                              {nObrig ? ` · ${nObrig} obrigatório${nObrig > 1 ? 's' : ''}` : ''}
                            </span>
                          )}
                          {nItens > 0 && <span>Checklist com {nItens} ite{nItens > 1 ? 'ns' : 'm'}</span>}
                        </div>
                      )}
                      <button type="button" className={c.btnConfig} onClick={() => setConfigurando(sv)}>
                        <SlidersHorizontal size={15} /> Campos e checklist
                      </button>
                    </>
                  );
                })()}
                <div className={u.rodapeCartao}>
                  <span>
                    Implantação <strong style={{ color: '#fff' }}>{sv.precoBase == null ? '[A DEFINIR]' : reais(sv.precoBase)}</strong>
                    {sv.mensalidade != null && (
                      <>
                        <br />
                        Mensalidade <strong style={{ color: '#fff' }}>{reais(sv.mensalidade)}</strong>
                      </>
                    )}
                  </span>
                  <Link href={`/calculadora?servico=${sv.id}`} className={u.btnFantasma}>
                    Calcular <ArrowRight size={16} strokeWidth={2} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {configurando && (
        <ConfigurarServico
          servico={configurando}
          onFechar={() => setConfigurando(null)}
          onSalvar={(s) => {
            setServicos((lista) => lista.map((x) => (x.id === s.id ? s : x)));
            setConfigurando(null);
          }}
        />
      )}

      {editando && (
        <ModalServico
          servico={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvar={(s) => {
            setServicos((lista) => (lista.some((x) => x.id === s.id) ? lista.map((x) => (x.id === s.id ? s : x)) : [...lista, s]));
            setEditando(null);
          }}
          onExcluir={
            editando !== 'novo'
              ? () => {
                  if (window.confirm(`Excluir "${editando.nome}" do cadastro? Leads e projetos que já usam este serviço guardam o nome e os valores já preenchidos.`)) {
                    setServicos((lista) => lista.filter((x) => x.id !== editando.id));
                    setEditando(null);
                  }
                }
              : undefined
          }
        />
      )}
    </NexaShell>
  );
}

function ModalServico({
  servico,
  onFechar,
  onSalvar,
  onExcluir,
}: {
  servico: ServicoNexa | null;
  onFechar: () => void;
  onSalvar: (s: ServicoNexa) => void;
  onExcluir?: () => void;
}) {
  const [nome, setNome] = useState(servico?.nome ?? '');
  const [descricao, setDescricao] = useState(servico?.descricao ?? '');
  const [implantacao, setImplantacao] = useState(paraTexto(servico?.precoBase));
  const [mensalidade, setMensalidade] = useState(paraTexto(servico?.mensalidade));
  const vImpl = lerValor(implantacao);
  const vMens = lerValor(mensalidade);
  const valido = !!nome.trim() && !Number.isNaN(vImpl) && !Number.isNaN(vMens);

  return (
    <Modal
      titulo={servico ? 'Editar serviço' : 'Novo serviço'}
      descricao="Os valores são sugeridos no lead ao escolher este serviço, e podem ser alterados em cada negociação."
      onFechar={onFechar}
      textoEnviar="Salvar"
      podeEnviar={valido}
      onEnviar={() =>
        onSalvar({
          // mantém campos personalizados e checklist já configurados
          ...(servico ?? {}),
          id: servico?.id ?? `srv-${Date.now()}`,
          nome: nome.trim(),
          descricao: descricao.trim(),
          precoBase: vImpl,
          mensalidade: vMens,
        })
      }
    >
      <div className={u.formGrade}>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Nome do serviço *</span>
          <input className={u.entrada} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: CRM personalizado" autoFocus />
        </label>
        <label className={`${u.campo} ${u.formCheia}`}>
          <span>Descrição</span>
          <input className={u.entrada} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className={u.campo}>
          <span>Valor de implantação (R$)</span>
          <input className={u.entrada} inputMode="decimal" value={implantacao} onChange={(e) => setImplantacao(e.target.value)} placeholder="Deixe vazio se não tiver" aria-invalid={Number.isNaN(vImpl)} />
        </label>
        <label className={u.campo}>
          <span>Mensalidade (R$)</span>
          <input className={u.entrada} inputMode="decimal" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} placeholder="Opcional" aria-invalid={Number.isNaN(vMens)} />
        </label>
      </div>
      {(Number.isNaN(vImpl) || Number.isNaN(vMens)) && (
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#ff9d85' }}>Use só números nos valores, ex.: 3.000 ou 299,90</p>
      )}
      {onExcluir && (
        <button type="button" className={u.btnFantasma} style={{ marginTop: 16, color: '#ff9d85' }} onClick={onExcluir}>
          Excluir serviço
        </button>
      )}
    </Modal>
  );
}
