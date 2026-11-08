'use client';

// ABA CALCULADORA DE SERVIÇO — simula o valor de um projeto.
// O valor só aparece quando a tabela de preços for preenchida em servicos-nexa.ts.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, FilePlus, Info } from 'lucide-react';
import NexaShell from '../NexaShell';
import u from '../ui.module.css';
import { calcularValor, escopos, prazos } from '../servicos-nexa';
import { useServicos } from '../dados';
import { reais, useParametro } from '../util';

const ICONE = { strokeWidth: 1.7 } as const;

export default function TelaCalculadora() {
  const servicoUrl = useParametro('servico');
  const [servicosNexa] = useServicos();
  const [servico, setServico] = useState('sites');
  const [escopo, setEscopo] = useState(escopos[1].id);
  const [prazo, setPrazo] = useState(prazos[1].id);

  useEffect(() => {
    if (servicoUrl && servicosNexa.some((s) => s.id === servicoUrl)) setServico(servicoUrl);
  }, [servicoUrl]);

  const valor = calcularValor(servico, escopo, prazo, servicosNexa);
  const nomeServico = servicosNexa.find((s) => s.id === servico)?.nome ?? '';
  const nomeEscopo = escopos.find((e) => e.id === escopo)?.nome ?? '';
  const nomePrazo = prazos.find((p) => p.id === prazo)?.nome ?? '';

  return (
    <NexaShell aba="calculadora">
      <div className={u.pagina}>
        <div className={u.cabecalho}>
          <div>
            <h1>Calculadora de Serviço</h1>
            <p>Simule o valor de um projeto antes de montar a proposta.</p>
            <span className={u.sublinhado} aria-hidden />
          </div>
        </div>

        <div className={u.grade2}>
          <section className={u.painel}>
            <header className={u.painelTopo}>
              <Calculator size={30} {...ICONE} />
              <div>
                <h2>Dados do projeto</h2>
                <small>Escolha o serviço, o escopo e o prazo.</small>
              </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <label className={u.campo}>
                <span>Serviço</span>
                <select className={u.entrada} value={servico} onChange={(e) => setServico(e.target.value)}>
                  {servicosNexa.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className={u.campo} role="radiogroup" aria-label="Escopo">
                <span>Escopo</span>
                <div className={u.segmentado}>
                  {escopos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={escopo === e.id}
                      className={`${u.segmento} ${escopo === e.id ? u.segmentoAtivo : ''}`}
                      onClick={() => setEscopo(e.id)}
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              </div>

              <label className={u.campo}>
                <span>Prazo</span>
                <select className={u.entrada} value={prazo} onChange={(e) => setPrazo(e.target.value)}>
                  {prazos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={u.painel}>
            <header className={u.painelTopo} style={{ marginBottom: 4 }}>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: '#d6d6d6' }}>Valor estimado</h2>
            </header>
            <p className={u.destaqueValor} style={{ color: valor == null ? '#d4f66a' : '#fff' }}>
              {valor == null ? '[A DEFINIR]' : reais(valor)}
            </p>

            <ul className={u.resumoLista} style={{ margin: '22px 0' }}>
              <li className={u.resumoItem}>
                Serviço <strong style={{ fontSize: 15, textAlign: 'right' }}>{nomeServico}</strong>
              </li>
              <li className={u.resumoItem}>
                Escopo <strong style={{ fontSize: 15 }}>{nomeEscopo}</strong>
              </li>
              <li className={u.resumoItem}>
                Prazo <strong style={{ fontSize: 15 }}>{nomePrazo}</strong>
              </li>
            </ul>

            {valor == null && (
              <p className={u.nota} style={{ marginBottom: 18 }}>
                <Info size={16} />
                A tabela de preços ainda não foi definida. Quando você tiver os valores, eles entram em
                components/nexa/servicos-nexa.ts e o cálculo passa a aparecer aqui.
              </p>
            )}

            <Link href={`/documentos?novo=Proposta&servico=${servico}`} className={u.btnPrimario}>
              <FilePlus size={18} strokeWidth={2} /> Gerar proposta
            </Link>
          </section>
        </div>
      </div>
    </NexaShell>
  );
}
