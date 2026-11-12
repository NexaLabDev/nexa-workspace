# Auditoria técnica — Nexa Workspace

Branch: `audit/continuidade-workspace`  
Atualizado: 2026-11-12

Legenda: **P0** bloqueia uso · **P1** alto risco/segurança · **P2** funcionalidade parcial · **P3** melhoria

## Problemas encontrados

| ID | Gravidade | Área | Problema | Status |
|---|---|---|---|---|
| A01 | P0 | Vercel/env | `NEXT_PUBLIC_SUPABASE_*` só em Preview | **Corrigido** (redeploy anterior) |
| A02 | P2 | Vercel/env | `SUPABASE_SECRET_KEY` ausente | **Não configurar** — só usada por `/api/supabase/status` (localhost) |
| A03 | P2 | Vercel/env | `ACESSO_TESTE_*` legadas | Aberto (limpeza) |
| A04 | P1 | Auth | HIBP desabilitado | **Bloqueado pelo plano** — recurso Pro+; não ativável sem custo |
| A05 | P3 | RLS | `autorizacao_inicial` sem policies | Aberto |
| A06 | P2 | Tooling | Sem `lint`/`test` no app | Aberto |
| A07 | P2 | Local | CLI Vercel instável / reauth MCP | Aberto |
| A08 | P0 | Anexos | Storage vs IndexedDB / texto enganoso | **Corrigido no código** |
| A09 | P1 | Storage/RLS | Falta policy DELETE | Migração revisada + testes isolados; **não aplicada** |
| A10 | P1 | Domínio público | Links gerados com `location.origin` (SSO) | **Corrigido no código** (`origemPublica` → tau) |
| A11 | P2 | Push | Push incompleto / localhost | **Não habilitar VAPID na Vercel** |
| A12 | P2 | Dependências | CVEs Next 14 | Parcial (`nanoid` ok) |
| A13 | P3 | Dados | `registros_workspace` vazio | Observação |
| A14 | P2 | Env | Falta `NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app` na Vercel | Pendente (MCP sem escopo de equipe após reauth; adicionar no dashboard) |

## Correções nesta rodada

1. `origemPublica()` / `DOMINIO_PUBLICO_PADRAO` — links de acompanhamento, convites e redirects de auth usam domínio público (tau), com fallback localhost.
2. Textos de compartilhamento atualizados.
3. Migração DELETE reforçada (regex de path + `drop policy if exists`) + testes `storage_delete_predicados.mjs` e SQL isolado (Docker indisponível neste host).
4. `.env.example` atualizado; `.env.local` limpo (sem OIDC/credenciais de teste).

## Storage DELETE — resultados e riscos (antes de autorizar produção)

**Modelo:** path `{workspace_id}/{arquivoId}`. Não há dono por usuário; exclusão é por workspace + `pode('arquivos','excluir')` (admin/gestor/colaborador). Visualizador não apaga. Outro workspace não é alcançado.

**Testes isolados:** predicados Node OK (5 casos). SQL `storage_delete_policy_isolado.sql` pronto; Postgres Docker não iniciou (daemon off). Branches Supabase: nenhuma disponível no plano.

**Riscos ao aplicar em produção:**
- Colaborador pode apagar anexos de colegas do mesmo workspace (intencional, igual a criar).
- Sem policy, `apagarArquivo` no cliente falha silenciosamente no Storage (órfãos).
- Aplicar só com aprovação; não há rollback automático de objetos já apagados.

## Escopo funcional

| Módulo | Status |
|---|---|
| Login / convite / recuperação | Código OK; redirects públicos corrigidos; login real pendente de conta de teste |
| Acompanhamento público | `tau` 200 sem SSO; payload só público via RPC |
| CRM / Kanban / Recebimentos / Docs | UI e hooks de sync presentes; operação autenticada pendente |
| Anexos | Upload Storage; delete client-side; policy DB pendente |
| Push | Intencionalmente incompleto |

## Pendências de autorização

1. Adicionar na Vercel: `NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app` (Production/Preview) e publicar a branch quando quiser (sem merge automático).
2. Aplicar migração DELETE Storage.
3. Upgrade Pro se quiser HIBP nativo.
4. Conta de teste isolada para auditoria autenticada.
