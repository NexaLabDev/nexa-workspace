# Progresso — Nexa Workspace

Branch: `audit/continuidade-workspace`  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6  
Atualizado: 2026-11-12

## Feito nesta continuidade

- [x] Docker Desktop ligado; uso do stack `nexa-teste-local`
- [x] Seed de usuários/perfis de teste (isolado)
- [x] Policy DELETE reforçada com `owner` + testes Storage API
- [x] Fluxos auth/sync/módulos operacionais via scripts
- [x] Aceitar anon JWT local em `config.ts` / `servidor.ts`
- [x] Liberar `/api/supabase/status` no middleware (ainda localhost-only)
- [x] Next dev apontando ao isolado; acompanhamento HTML OK
- [ ] Commit + push desta rodada no PR #6
- [ ] `NEXT_PUBLIC_APP_URL` na Vercel
- [ ] Autorização para aplicar DELETE em produção

## Comandos de teste locais

```bash
node supabase/tests/seed_local_users.mjs
# psql seed_local_perfis.sql no container
node supabase/tests/storage_delete_predicados.mjs
node supabase/tests/storage_delete_api_local.mjs
node supabase/tests/fluxos_auth_local.mjs
node supabase/tests/modulos_operacionais_local.mjs
npx tsc --noEmit
```

## Contas isoladas

| E-mail | Senha | Papel |
|---|---|---|
| admin@teste.local | TesteAdmin!123 | administrador |
| gestor@teste.local | TesteGestor!123 | gestor |
| colab@teste.local | TesteColab!123 | colaborador |
| viewer@teste.local | TesteViewer!123 | visualizador |
| intruso@teste.local | TesteIntruso!123 | sem vínculo |
