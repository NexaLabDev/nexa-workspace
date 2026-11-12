# Progresso — Nexa Workspace

Branch: `audit/continuidade-workspace`  
Atualizado: 2026-11-12

## Feito nesta sessão

- [x] Domínio público tau para links de cliente / convite / auth (`origemPublica`)
- [x] Revisão migração Storage DELETE + testes de predicados
- [x] Decisão env: sem `SUPABASE_SECRET_KEY` / VAPID na Vercel por enquanto
- [x] HIBP: confirmado Pro+ — não ativado (custo)
- [x] Limpeza `.env.local` (sem tokens/credenciais extras)
- [x] Docs de auditoria atualizados
- [x] Commit `e166252` + PR https://github.com/NexaLabDev/nexa-workspace/pull/6 (sem merge)
- [ ] `NEXT_PUBLIC_APP_URL` na Vercel (reautorizar equipe MCP ou dashboard)
- [ ] Conta de teste isolada + auditoria autenticada CRM/Kanban/etc.

## Testes executados

| Teste | Resultado |
|---|---|
| `node supabase/tests/storage_delete_predicados.mjs` | OK |
| `npx tsc --noEmit` | OK |
| `https://nexa-workspace-tau.vercel.app/acompanhamento/...` | 200, “Link inválido”, sem SSO |
| Docker Postgres isolado | Falhou (Docker Desktop não rodando) |
| Branches Supabase | Nenhuma disponível |

## Continuidade

1. Abrir/acompanhar PR desta branch
2. Cadastrar `NEXT_PUBLIC_APP_URL` na Vercel
3. Após merge+deploy (autorizado): validar links gerados apontam para tau
4. Com conta de teste: CRM, Kanban, sync, permissões
5. Autorizar migração DELETE se os riscos forem aceitos
