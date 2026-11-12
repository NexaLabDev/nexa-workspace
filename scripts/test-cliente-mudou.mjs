/** Unit smoke for clienteMudou — node scripts/test-cliente-mudou.mjs */
import assert from 'node:assert/strict';

// Inline mirror of the TS helper (keep in sync with ReconciliarRelacoes.tsx)
function clienteMudou(antes, depois) {
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

const base = {
  id: 'c1',
  nome: 'Alpha',
  segmento: 'Tech',
  status: 'Ativo',
  servicos: ['A', 'B'],
  ultimaAtividade: 'hoje',
  historico: [{ em: '2026-01-01', texto: 'criado', chave: 'k1', leadId: 'l1' }],
};

assert.equal(clienteMudou(base, { ...base }), false, 'igual');
assert.equal(
  clienteMudou(base, { ...base, historico: [{ em: '2026-01-01', texto: 'alterado', chave: 'k1', leadId: 'l1' }] }),
  true,
  'historico mesmo tamanho, texto diferente',
);
assert.equal(
  clienteMudou(base, { ...base, servicos: ['A', 'C'] }),
  true,
  'servicos mesmo tamanho, item diferente',
);
assert.equal(
  clienteMudou(base, { ...base, historico: [{ em: '2026-01-01', texto: 'criado', chave: 'k2', leadId: 'l1' }] }),
  true,
  'historico chave diferente',
);
console.log('clienteMudou: ok');
