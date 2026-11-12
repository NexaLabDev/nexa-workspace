# Finalização — Etapa 1 publicada

Atualizado: 2026-11-12 (go-live)  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6

## Veredito

**Etapa 1 publicada** após backup offsite validado, migração DELETE no Cloud e merge do PR #6.

## Backup recuperável (offsite)

**Localização (fora do repositório):**  
`C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`

| Camada | Cobertura |
|---|---|
| Estrutura DB | `migrations/` até schema pré-DELETE + SQL de restore |
| Dados app | workspace + perfil admin (`02-public-core.sql`) |
| Auth | `auth.users` + `auth.identities` com hash (`03-auth.sql`) |
| Storage | bucket metadata; **0 objetos** no dump (`04-storage.sql`) |
| Validação | `VALIDATE.log` → `RESTORE_OK public+auth+storage_metadata` (Docker) |

Plano Free: backups oficiais não são baixáveis — alternativa lógica offsite conforme [docs Supabase](https://supabase.com/docs/guides/platform/backups).

## Migração DELETE (Cloud)

- Aplicada via `apply_migration` (`storage_delete_policy`, version Cloud `20261112180108`)
- SQL idêntico a `supabase/migrations/20261112121500_storage_delete_policy.sql` (testado no Docker)
- Policies atuais: `nexa_arquivo_apagar` (DELETE) + `criar` + `ler`
- Sem exclusão de objetos reais (Storage com 0 arquivos)
- Rollback: `drop policy if exists nexa_arquivo_apagar on storage.objects;`

## Vercel

- `NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app` (Production + Preview)
- `ACESSO_TESTE_*` **mantidas** (limpeza em etapa separada)

## Ambientes

| Uso | Env |
|---|---|
| Conta real / UI | `.env.local` → Cloud |
| Testes que gravam/apagam | `.env.docker.local` → Docker `54621` |
