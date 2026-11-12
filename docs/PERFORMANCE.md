# Performance — auditoria e correções

Branch: `fix/performance-navegacao`  
Medições: Docker isolado (`127.0.0.1:54621`), conta `admin@teste.local`  
Scripts: `scripts/perf-baseline.mjs`, `scripts/perf-interacao.mjs`

## Causas identificadas (com evidência)

1. **`remoto.atualizar()` a cada poll rematerializava tudo**  
   Mesmo sem mudanças no servidor: `materializar()` + `JSON.stringify` (`normalizar`) em todas as coleções + `avisar()` acordando todos os `useSyncExternalStore` (TopoAcoes, NexaShell, telas, ReconciliarRelacoes).

2. **Poll fixo de 15 s** em `DadosWorkspace` (aba visível), somando RPC `ler_registros` e o custo acima.

3. **Dashboard re-renderizava o painel inteiro a cada 1 s** (relógio), recalculando meta/vendas junto.

4. **`ReconciliarRelacoes`** usava `JSON.stringify` em clientes a cada mudança de listas.

5. **`TopoAcoes`** (em todas as páginas) recalculava cobranças/tarefas/meta em todo render.

`SincronizarServidor.tsx` **não está montado** em nenhum layout — não contribuiu para a lentidão atual.

## Correções

| Arquivo | Mudança |
|---|---|
| `components/nexa/remoto.ts` | Assinatura por versão/ordem; skip rematerializar/avisar se igual; `mesmoValor` antes de JSON |
| `components/acesso/DadosWorkspace.tsx` | Poll 30 s (pendências ainda saem no debounce 300 ms + focus/online) |
| `components/dashboard-nexa/DashboardNexa.tsx` | Relógio isolado; meta só 1×/min |
| `components/nexa/ReconciliarRelacoes.tsx` | Comparação pontual sem `JSON.stringify` |
| `components/nexa/TopoAcoes.tsx` / `NexaShell.tsx` | `useMemo` nos derivados caros |

Segurança/persistência/RLS/gravação versionada: **preservadas**.

## Comparação (warm, full navigation)

| Métrica | Antes | Depois |
|---|---|---|
| Média `navMs` (7 rotas) | ~1970 ms | ~2390 ms* |
| Heap JS (dashboard) | 69 MB | 61 MB |
| Soft nav CRM (client) | — | **578 ms** |
| Soft nav Kanban | — | **650 ms** |
| Digitar na busca (por tecla) | — | **3–12 ms** |
| RPC `ler_registros` em idle 18 s | ≥1 esperado (poll 15 s) | **0** (poll 30 s + skip) |

\*Full `page.goto` é dominado por TTFB do Next em dev; o ganho real está no **idle sync** e na **navegação client-side** (soft).

## Testes funcionais (Docker)

`npx playwright test e2e/gaps-pendentes.spec.ts --project=desktop`  
→ **3 passed** (CRM etapa/drag, subtarefa/conversas/docs/equipe, viewer), 1 skipped (mobile project).

## Limites conscientes

- Sync entre aparelhos continua via poll (agora 30 s) + focus/online; não foi removido.
- Sem migração Cloud / sem escrita em dados reais nesta branch.
