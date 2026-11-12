# Progresso — Nexa Workspace

Branch: `main` (após merge do PR #6)  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6  
Atualizado: 2026-11-12 (Etapa 1 — publicação)

## Conta real (Cloud)

- E-mail: `suportenexalab@gmail.com`
- Papel: **administrador** (ativo)
- Workspace: **Nexa Lab**
- Localhost `.env.local` → Cloud `tiqyujibhjwnrpqpqmep` (Docker em `.env.docker.local`)

## Etapa 1 — concluída

- [x] Auth cloud no localhost + recuperação/redirects
- [x] E2E Playwright no Docker
- [x] Correções UI: metas/clientes/conversas
- [x] `NEXT_PUBLIC_APP_URL` na Vercel (Prod+Preview)
- [x] Backup offsite validado (`C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`)
- [x] Migração DELETE Storage aplicada no Cloud (`storage_delete_policy`)
- [x] Merge PR #6 → `main`
- [ ] Remover `ACESSO_TESTE_*` na Vercel (após estabilidade)
- [ ] Smoke Production pós-deploy (login/CRM/Kanban/acompanhamento)

## Backup

Offsite (não versionar segredos de Auth no git):  
`C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`  
Inclui Auth + dados públicos + metadata Storage + `VALIDATE.log`.

## Comandos (Docker / isolado)

```bash
npm run test:e2e
npx playwright test e2e/gaps-pendentes.spec.ts
```

## Backlog pós-Etapa 1

P1: CRM Automação/Relatórios · Conversas reais · Push · Aditivo · Preços  
P2: Equipes em escala · Integrações · E2E na CI
