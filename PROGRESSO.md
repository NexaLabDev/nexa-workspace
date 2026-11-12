# Progresso — Nexa Workspace

Branch: `main`  
PR #6: MERGED (`ca40993`)  
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
- [x] `NEXT_PUBLIC_APP_URL` na Vercel (Prod+Preview) — confirmado no bundle Production
- [x] Backup offsite validado (`C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`, `RESTORE_OK`)
- [x] Migração DELETE Storage no Cloud (`storage_delete_policy` / `20261112180108`)
- [x] Merge PR #6 → `main` (`ca40993`)
- [x] Deploy Production Vercel **Ready** (`nexa-workspace-7y5aot2ww`)
- [x] Smoke não destrutivo: `/login`, `/crm`→login, `/kanban`→login, `/acompanhamento` 200
- [ ] Remover `ACESSO_TESTE_*` na Vercel (após estabilidade)

## Backup

Offsite (Auth + dados + Storage metadata):  
`C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`

## Production

- Alias: https://nexa-workspace-tau.vercel.app
- Deploy: https://nexa-workspace-7y5aot2ww-nexa-lab.vercel.app (Ready)

## Backlog pós-Etapa 1

P1: CRM Automação/Relatórios · Conversas reais · Push · Aditivo · Preços  
P2: Equipes em escala · Integrações · E2E na CI
