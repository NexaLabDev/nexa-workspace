'use client';

// Aplica as ligações CRM ↔ Clientes ↔ Vendas ↔ Projetos (regra em relacoes.ts)
// sempre que alguma dessas listas muda. Também liga os dados antigos na primeira vez.
// As gravações mexem só nos campos de vínculo, por id, para não atropelar outras edições.
// Também dá o código PRJ-0001… aos projetos que ainda não têm (dados antigos), sem mexer no resto.

import { useEffect } from 'react';
import { useClientes, useLeads, useProjetos, useVendas } from './dados';
import type { Cliente } from './dados-exemplo';
import { reconciliarRelacoes } from './relacoes';
import { garantirCodigosProjetos, garantirProgressoPorFase } from './projetos';
import { garantirTarefasDoChecklist } from './tarefas';
import { garantirBibliotecaDasTarefas } from './biblioteca';
import { papel } from './remoto';

/** Detecta mudança real em cliente sem JSON.stringify do objeto inteiro.
 *  Serviços e histórico: conteúdo importa mesmo se o tamanho da lista for igual. */
export function clienteMudou(antes: Cliente, depois: Cliente): boolean {
  if (
    antes.nome !== depois.nome ||
    antes.nomeCompleto !== depois.nomeCompleto ||
    antes.documento !== depois.documento ||
    antes.email !== depois.email ||
    antes.telefone !== depois.telefone ||
    antes.endereco !== depois.endereco ||
    antes.assinante !== depois.assinante ||
    antes.contato !== depois.contato ||
    antes.status !== depois.status ||
    antes.segmento !== depois.segmento ||
    antes.ultimaAtividade !== depois.ultimaAtividade ||
    antes.origem !== depois.origem
  ) {
    return true;
  }
  const sa = antes.servicos ?? [];
  const sd = depois.servicos ?? [];
  if (sa.length !== sd.length || sa.some((v, i) => v !== sd[i])) return true;
  const ha = antes.historico ?? [];
  const hd = depois.historico ?? [];
  if (ha.length !== hd.length) return true;
  for (let i = 0; i < ha.length; i++) {
    const a = ha[i];
    const b = hd[i];
    if (a.em !== b.em || a.texto !== b.texto || a.chave !== b.chave || a.leadId !== b.leadId) return true;
  }
  return false;
}

export default function ReconciliarRelacoes() {
  const [leads, setLeads] = useLeads();
  const [clientes, setClientes] = useClientes();
  const [vendas, setVendas] = useVendas();
  const [projetos, setProjetos] = useProjetos();

  // Só quem pode gravar faz os ajustes automáticos (visualizador apenas lê)
  const podeAjustar = papel() !== null && papel() !== 'visualizador';

  useEffect(() => {
    if (!podeAjustar) return;
    const m = reconciliarRelacoes({ leads, clientes, vendas, projetos });
    if (m.clientes) {
      const alterados = m.clientes.filter((c) => {
        const antes = clientes.find((x) => x.id === c.id);
        return !antes || clienteMudou(antes, c);
      });
      setClientes((atual) => {
        let lista = atual;
        for (const c of alterados) lista = lista.some((x) => x.id === c.id) ? lista.map((x) => (x.id === c.id ? c : x)) : [c, ...lista];
        return lista;
      });
    }
    if (m.leads) {
      const vinculo = new Map(m.leads.map((l) => [l.id, l.clienteId]));
      setLeads((atual) => atual.map((l) => (vinculo.has(l.id) && vinculo.get(l.id) !== l.clienteId ? { ...l, clienteId: vinculo.get(l.id) } : l)));
    }
    if (m.vendas) {
      const porId = new Map(m.vendas.map((v) => [v.id, v]));
      setVendas((atual) =>
        atual.map((v) => {
          const n = porId.get(v.id);
          return n && (n.clienteId !== v.clienteId || n.servico !== v.servico) ? { ...v, clienteId: n.clienteId, servico: n.servico } : v;
        })
      );
    }
    if (m.projetos) {
      const porId = new Map(m.projetos.map((p) => [p.id, p]));
      setProjetos((atual) =>
        atual.map((p) => {
          const n = porId.get(p.id);
          return n && (n.clienteId !== p.clienteId || (n.valor ?? null) !== (p.valor ?? null) || n.cliente !== p.cliente)
            ? { ...p, clienteId: n.clienteId, valor: n.valor, cliente: n.cliente }
            : p;
        })
      );
    }
  }, [leads, clientes, vendas, projetos, setLeads, setClientes, setVendas, setProjetos, podeAjustar]);

  // Código único para todo projeto (os que já têm mantêm o seu)
  // e checklists copiados antes da aba Tarefas viram tarefas (uma única vez por serviço)
  useEffect(() => {
    // e anexos de tarefas de antes da biblioteca passam a aparecer na aba Anexos (sem copiar o conteúdo)
    // e o progresso de cada projeto é sempre o percentual fixo da fase
    if (!podeAjustar) return;
    const ajustar = (l: typeof projetos) => garantirProgressoPorFase(garantirBibliotecaDasTarefas(garantirTarefasDoChecklist(garantirCodigosProjetos(l))));
    if (ajustar(projetos) === projetos) return;
    setProjetos((atual) => ajustar(atual));
  }, [projetos, setProjetos, podeAjustar]);

  return null;
}
