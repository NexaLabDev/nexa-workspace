// Recebe do Workspace a versão PÚBLICA dos projetos (só o que o cliente pode ver)
// para os links permanentes de acompanhamento. Os demais dados do projeto nunca chegam aqui.
import { NextResponse } from 'next/server';
import { lerJson, recusar } from '@/lib/servidor/guarda';
import { alterarBanco } from '@/lib/servidor/armazem';
import { CODIGO_PUBLICO_VALIDO, type RetratoPublico } from '@/components/nexa/acompanhamento';
import { etapasProjeto } from '@/components/nexa/dados-exemplo';

export const dynamic = 'force-dynamic';

const ETAPAS = new Set(etapasProjeto.map((e) => e.id));

function limpar(x: unknown): RetratoPublico | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (typeof r.codigo !== 'string' || !CODIGO_PUBLICO_VALIDO.test(r.codigo)) return null;
  if (typeof r.nome !== 'string' || typeof r.etapa !== 'string' || !ETAPAS.has(r.etapa)) return null;
  if ((r.progresso !== null && typeof r.progresso !== 'number') || typeof r.atualizadoEm !== 'string' || Number.isNaN(Date.parse(r.atualizadoEm))) return null;
  // Monta de novo campo a campo: qualquer outro dado enviado é descartado
  return {
    codigo: r.codigo,
    nome: r.nome.slice(0, 160),
    etapa: r.etapa,
    progresso: typeof r.progresso === 'number' && Number.isFinite(r.progresso) ? Math.max(0, Math.min(100, Math.round(r.progresso))) : null,
    base: r.base === 'tarefas' ? 'tarefas' : 'fase',
    atualizadoEm: r.atualizadoEm,
    ...(typeof r.observacao === 'string' && r.observacao.trim() ? { observacao: r.observacao.trim().slice(0, 600) } : {}),
  };
}

export async function PUT(req: Request) {
  const bloqueio = recusar(req);
  if (bloqueio) return bloqueio;
  const lista = await lerJson<unknown>(req, 2_000_000);
  if (!Array.isArray(lista)) return NextResponse.json({ erro: 'Lista inválida.' }, { status: 400 });
  const limpos = lista.map(limpar).filter((x): x is RetratoPublico => !!x);
  alterarBanco((b) => {
    b.acompanhamentos = Object.fromEntries(limpos.map((r) => [r.codigo, r]));
  });
  return NextResponse.json({ ok: true, total: limpos.length });
}
