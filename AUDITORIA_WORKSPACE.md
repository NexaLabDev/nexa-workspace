# Auditoria técnica — Nexa Workspace

Branch: `audit/continuidade-workspace`  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6  
Atualizado: 2026-11-12

## Ambiente isolado usado

- Docker Desktop iniciado
- Stack `supabase_*_nexa-teste-local` (Postgres `54622`, Kong `54621`)
- Contas de teste: `admin@teste.local`, `gestor@teste.local`, `colab@teste.local`, `viewer@teste.local`, `intruso@teste.local`
- `.env.local` aponta para o isolado (não commitado)
- **Nenhuma migração/aplicação no Supabase de produção**

## Problemas / decisões

| ID | Gravidade | Status |
|---|---|---|
| A08 Anexos Storage | P0 | Corrigido no código |
| A09 DELETE Storage | P1 | Policy reforçada (owner); **testada no Docker**; **não aplicada em produção** |
| A10 Domínio público tau | P1 | Corrigido no código |
| A15 Status API atrás do middleware | P2 | **Corrigido** — `/api/supabase/status` liberado; rota ainda restringe localhost |
| A16 Config só `sb_publishable_` | P2 | **Corrigido** — aceita anon JWT em URL localhost (Supabase local) |
| A04 HIBP | P1 | Pro+ — sem ativação gratuita |
| A14 `NEXT_PUBLIC_APP_URL` na Vercel | P2 | Pendente (dashboard / reauth equipe) |

## Policy DELETE (revisão)

Regra proposta (migração local/pendente prod):

- mesmo workspace (`foldername` = `workspace_id_atual`)
- `pode('arquivos','excluir')`
- **admin/gestor**: qualquer arquivo do workspace
- **colaborador**: só se `owner = auth.uid()`
- **visualizador**: negado

### Testes efetivos (Docker + Storage API)

| Caso | Resultado |
|---|---|
| Colab apaga próprio | OK |
| Colab tenta apagar de admin | Bloqueado |
| Admin apaga de outro | OK |
| Gestor apaga do workspace | OK |
| Viewer tenta apagar | Bloqueado |
| Predicados Node (7 casos) | OK |

SQL direto em `storage.objects` é bloqueado pelo trigger `protect_delete` (esperado — usar Storage API).

## Testes autenticados (isolado)

| Fluxo | Resultado |
|---|---|
| Login admin | OK |
| Intruso sem workspace | OK |
| Viewer lê / não grava | OK |
| Sync lead+projeto colab→admin | OK |
| Acompanhamento público (RPC + página Next) | OK |
| Recuperação de senha (API) | OK |
| Módulos: CRM lead/etapa, cliente, venda, projeto/tarefas, cobrança, documento, conversa | OK |
| `/api/supabase/status` local | OK (publicável + secreta) |

## Riscos que ainda impedem publicação

1. Migração DELETE **não** está em produção — exclusão real de anexos na nuvem continua falha/órfãos até autorizar.
2. `NEXT_PUBLIC_APP_URL` ainda precisa ser cadastrada na Vercel e a branch deployada (sem merge automático).
3. HIBP indisponível no plano Free.
4. Testes UI E2E no browser (drag-and-drop visual) não substituem os testes de API/persistência já feitos; validação visual manual recomendada após deploy preview.
