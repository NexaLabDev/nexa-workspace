'use client';

// Configuração de um serviço (aba Serviços): campos personalizados e checklist padrão.
// - Campos aparecem sozinhos na Ficha dos projetos que têm este serviço.
// - Remover um campo só o ARQUIVA: some dos projetos onde está vazio, mas valores já
//   preenchidos continuam guardados e visíveis. Dá para restaurar.
// - O checklist é só um modelo: projetos que já copiaram não mudam.

import { useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, ListChecks, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import Modal from '../Modal';
import u from '../ui.module.css';
import c from './catalogo.module.css';
import { TIPOS_CAMPO, type CampoServico, type ItemChecklistModelo, type ServicoNexa, type TipoCampo } from '../servicos-nexa';
import { useProjetos } from '../dados';

const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= lista.length) return lista;
  const n = [...lista];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Linha de edição: opções da seleção são digitadas uma por linha. */
type CampoEdicao = CampoServico & { opcoesTexto: string; novo?: boolean };

export default function ConfigurarServico({ servico, onFechar, onSalvar }: { servico: ServicoNexa; onFechar: () => void; onSalvar: (s: ServicoNexa) => void }) {
  const [projetos] = useProjetos();
  const [campos, setCampos] = useState<CampoEdicao[]>(() => (servico.campos ?? []).map((x) => ({ ...x, opcoesTexto: (x.opcoes ?? []).join('\n') })));
  const [checklist, setChecklist] = useState<ItemChecklistModelo[]>(() => servico.checklist ?? []);

  const usos = projetos.filter((p) => p.servicos?.some((s) => s.servicoId === servico.id)).length;
  const ativos = campos.filter((x) => !x.arquivado);
  const arquivados = campos.filter((x) => x.arquivado);

  const erros = useMemo(() => {
    const e: Record<string, string> = {};
    const nomes = new Map<string, number>();
    for (const x of ativos) {
      const n = x.nome.trim().toLowerCase();
      if (n) nomes.set(n, (nomes.get(n) ?? 0) + 1);
    }
    for (const x of ativos) {
      if (!x.nome.trim()) e[x.id] = 'Dê um nome ao campo';
      else if ((nomes.get(x.nome.trim().toLowerCase()) ?? 0) > 1) e[x.id] = 'Já existe um campo com este nome';
      else if (x.tipo === 'selecao' && !x.opcoesTexto.split('\n').some((o) => o.trim())) e[x.id] = 'Escreva pelo menos uma opção (uma por linha)';
    }
    return e;
  }, [ativos]);
  const valido = !Object.keys(erros).length;

  const alterar = (id: string, mud: Partial<CampoEdicao>) => setCampos((l) => l.map((x) => (x.id === id ? { ...x, ...mud } : x)));
  const moverCampo = (id: string, d: -1 | 1) =>
    setCampos((l) => {
      const at = l.filter((x) => !x.arquivado);
      const i = at.findIndex((x) => x.id === id);
      return [...mover(at, i, d), ...l.filter((x) => x.arquivado)];
    });
  const removerCampo = (x: CampoEdicao) =>
    // campo criado agora (nunca salvo) sai de vez; os já salvos são arquivados
    setCampos((l) => (x.novo ? l.filter((y) => y.id !== x.id) : l.map((y) => (y.id === x.id ? { ...y, arquivado: true } : y))));

  // Enter num campo de texto não deve salvar a janela inteira
  const semEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
  };

  const salvar = () => {
    const limpos: CampoServico[] = campos.map(({ opcoesTexto, novo: _novo, ...x }) => {
      const base: CampoServico = { id: x.id, nome: x.nome.trim(), tipo: x.tipo, obrigatorio: x.tipo === 'checkbox' ? false : x.obrigatorio };
      if (x.tipo === 'selecao') base.opcoes = Array.from(new Set(opcoesTexto.split('\n').map((o) => o.trim()).filter(Boolean)));
      if (x.arquivado) base.arquivado = true;
      return base;
    });
    onSalvar({ ...servico, campos: limpos, checklist: checklist.map((i) => ({ ...i, texto: i.texto.trim() })).filter((i) => i.texto) });
  };

  return (
    <Modal
      titulo={`Campos e checklist · ${servico.nome}`}
      descricao={`Os campos aparecem na Ficha de todo projeto com este serviço${usos ? ` (hoje: ${usos} projeto${usos > 1 ? 's' : ''})` : ''}. O checklist é um modelo copiado ao vincular o serviço; projetos que já copiaram não mudam.`}
      onFechar={onFechar}
      textoEnviar="Salvar configuração"
      podeEnviar={valido}
      onEnviar={salvar}
    >
      <div className={c.config} onKeyDown={semEnter}>
        <section aria-labelledby="titulo-campos">
          <h3 id="titulo-campos" className={c.configTitulo}>
            <SlidersHorizontal size={16} aria-hidden /> Campos personalizados
          </h3>
          {!ativos.length && <p className={c.vazio}>Nenhum campo. Projetos com este serviço mostram só os campos comuns.</p>}
          <ol className={c.listaCampos}>
            {ativos.map((x, i) => (
              <li key={x.id} className={c.linhaCampo}>
                <div className={c.linhaCampoTopo}>
                  <label className={c.rotuloOculto} htmlFor={`nome-${x.id}`}>
                    Nome do campo {i + 1}
                  </label>
                  <input
                    id={`nome-${x.id}`}
                    className={u.entrada}
                    value={x.nome}
                    maxLength={60}
                    placeholder="Nome do campo (ex.: Domínio)"
                    onChange={(e) => alterar(x.id, { nome: e.target.value })}
                    aria-invalid={!!erros[x.id] || undefined}
                  />
                  <label className={c.rotuloOculto} htmlFor={`tipo-${x.id}`}>
                    Tipo do campo {i + 1}
                  </label>
                  <select id={`tipo-${x.id}`} className={u.entrada} value={x.tipo} onChange={(e) => alterar(x.id, { tipo: e.target.value as TipoCampo })}>
                    {TIPOS_CAMPO.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {x.tipo === 'selecao' && (
                  <label className={c.opcoes}>
                    <span>Opções (uma por linha)</span>
                    <textarea className={u.entrada} rows={3} value={x.opcoesTexto} onChange={(e) => alterar(x.id, { opcoesTexto: e.target.value })} />
                  </label>
                )}
                <div className={c.linhaCampoRodape}>
                  {x.tipo !== 'checkbox' ? (
                    <label className={c.marcar}>
                      <input type="checkbox" checked={x.obrigatorio} onChange={(e) => alterar(x.id, { obrigatorio: e.target.checked })} />
                      <span>Obrigatório</span>
                    </label>
                  ) : (
                    <span className={c.dica}>Caixa de marcar não tem obrigatório</span>
                  )}
                  <span className={c.empurra} />
                  <button type="button" className={u.btnIcone} onClick={() => moverCampo(x.id, -1)} disabled={i === 0} aria-label={`Subir ${x.nome || 'campo'}`}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className={u.btnIcone} onClick={() => moverCampo(x.id, 1)} disabled={i === ativos.length - 1} aria-label={`Descer ${x.nome || 'campo'}`}>
                    <ArrowDown size={15} />
                  </button>
                  <button type="button" className={`${u.btnIcone} ${c.perigo}`} onClick={() => removerCampo(x)} aria-label={`Remover ${x.nome || 'campo'}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {erros[x.id] && (
                  <small className={c.erro} role="alert">
                    {erros[x.id]}
                  </small>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={u.btnSecundario}
            onClick={() => setCampos((l) => [...l.filter((x) => !x.arquivado), { id: novoId('cmp'), nome: '', tipo: 'texto', obrigatorio: false, opcoesTexto: '', novo: true }, ...l.filter((x) => x.arquivado)])}
          >
            <Plus size={16} /> Adicionar campo
          </button>
          {arquivados.length > 0 && (
            <details className={c.arquivados}>
              <summary>Campos removidos ({arquivados.length})</summary>
              <p className={c.dica}>Não aparecem em projetos novos nem vazios. Onde já tinham valor, o valor continua guardado.</p>
              <ul>
                {arquivados.map((x) => (
                  <li key={x.id}>
                    <span>{x.nome}</span>
                    <button type="button" className={u.btnFantasma} onClick={() => alterar(x.id, { arquivado: false })}>
                      <RotateCcw size={14} /> Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section aria-labelledby="titulo-checklist">
          <h3 id="titulo-checklist" className={c.configTitulo}>
            <ListChecks size={16} aria-hidden /> Checklist padrão
          </h3>
          {!checklist.length && <p className={c.vazio}>Nenhum item. Sem checklist, o projeto começa sem modelo de tarefas.</p>}
          <ol className={c.listaChecklist}>
            {checklist.map((it, i) => (
              <li key={it.id}>
                <label className={c.rotuloOculto} htmlFor={`chk-${it.id}`}>
                  Item {i + 1}
                </label>
                <input
                  id={`chk-${it.id}`}
                  className={u.entrada}
                  value={it.texto}
                  maxLength={160}
                  placeholder="Ex.: Receber o briefing"
                  onChange={(e) => setChecklist((l) => l.map((y) => (y.id === it.id ? { ...y, texto: e.target.value } : y)))}
                />
                <button type="button" className={u.btnIcone} onClick={() => setChecklist((l) => mover(l, i, -1))} disabled={i === 0} aria-label={`Subir item ${i + 1}`}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className={u.btnIcone} onClick={() => setChecklist((l) => mover(l, i, 1))} disabled={i === checklist.length - 1} aria-label={`Descer item ${i + 1}`}>
                  <ArrowDown size={15} />
                </button>
                <button type="button" className={`${u.btnIcone} ${c.perigo}`} onClick={() => setChecklist((l) => l.filter((y) => y.id !== it.id))} aria-label={`Remover item ${i + 1}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className={u.btnSecundario} onClick={() => setChecklist((l) => [...l, { id: novoId('mod'), texto: '' }])}>
            <Plus size={16} /> Adicionar item
          </button>
        </section>
      </div>
    </Modal>
  );
}
