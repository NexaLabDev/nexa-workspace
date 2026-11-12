# Performance — auditoria e correções

Branch: `fix/performance-navegacao` (PR #7)  
Medições: Docker isolado (`127.0.0.1:54621`), conta `admin@teste.local`  
Scripts: `scripts/perf-baseline.mjs`, `scripts/perf-interacao.mjs`, `scripts/perf-prod.mjs`, `scripts/test-sync-sessoes.mjs`, `scripts/test-cliente-mudou.mjs`

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
| `components/nexa/ReconciliarRelacoes.tsx` | Comparação pontual (`clienteMudou`) sem `JSON.stringify`; **histórico e serviços comparam conteúdo**, não só `length` |
| `components/nexa/TopoAcoes.tsx` / `NexaShell.tsx` | `useMemo` nos derivados caros |

Segurança/persistência/RLS/gravação versionada: **preservadas**.

## Validação final — produção local (`next build` + `next start`)

Ambiente equivalente: mesmo Docker, mesma conta, mesma máquina; **antes** = componentes em `3881219`; **depois** = branch + `clienteMudou`. Script: `node scripts/perf-prod.mjs`.

| Métrica (`next start`) | Antes | Depois (equiv.) |
|---|---|---|
| Média full `navMs` (7 rotas) | 1393 ms | **1281 ms** |
| Média TTFB / FCP | 362 / 391 ms | **91 / 115 ms**\* |
| Soft nav CRM / Kanban | 134 / 111 ms | 151 / 158 ms |
| Digitar busca (por tecla) | 2–7 ms | 1–7 ms |
| RPC `ler_registros` idle 18 s | **1** (poll 15 s) | **0** (poll 30 s + skip) |
| Heap JS (páginas) | ~10 MB | ~10 MB |

\*Full `page.goto` TTFB/FCP oscila com warm-up do Node; o ganho estável e intencional é **idle sync sem rematerializar** + soft nav sem thrash. Soft nav em produção já era rápido nos dois lados (~110–160 ms).

### Sync entre duas sessões

`node scripts/test-sync-sessoes.mjs` (A cria lead; B na mesma rota CRM):

| Cenário | Resultado |
|---|---|
| Poll ≤ ~30 s | **ok** |
| Evento `focus` | **ok** |
| Offline → online | **ok** |
| Persistência (reload) | **ok** |

### `clienteMudou` (campos complexos)

`node scripts/test-cliente-mudou.mjs` → **ok**  
Mesmo tamanho de `historico`/`servicos` com conteúdo diferente **não** é ignorado.

## Testes E2E (produção local, Docker)

```
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
npx playwright test e2e/gaps-pendentes.spec.ts e2e/validacao-completa.spec.ts
```

- **desktop:** 6 passed, 2 skipped (mobile-only)
- **mobile:** 3 passed, 5 skipped (desktop-only)

Cobre CRM/funil, Kanban/tarefas, conversas, documentos, permissões (viewer), fluxo lead→venda→projeto→pagamento→anexo→persistência, formulários mobile.

## Limites conscientes

- Sync entre aparelhos continua via poll (30 s) + focus/online; não foi removido.
- Sem migração Cloud / sem merge / sem publicação em Production nesta validação.
- Recomendação de publicação: **sim, após merge do PR #7** — ganhos de idle confirmados, sync e E2E verdes, regressão de comparação de histórico/serviços corrigida.
