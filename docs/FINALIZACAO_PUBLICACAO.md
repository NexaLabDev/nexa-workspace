# Finalização — Etapa 1 publicada

Atualizado: 2026-11-12 (go-live confirmado)  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6 — **MERGED**  
Commit merge: `ca4099396ddaa0a6c03d9c66b71d2bdb93793461`

## Veredito

**Etapa 1 publicada.** Backup offsite validado, DELETE no Cloud, merge na `main`, Production **Ready**, smoke OK.

## Backup recuperável (offsite)

**Localização:** `C:\Users\malui\Downloads\nexa-cloud-backups\pre-delete-20261112\`

| Camada | Arquivo | Status |
|---|---|---|
| Estrutura | `migrations/` | OK |
| Dados app | `02-public-core.sql` | OK |
| Auth | `03-auth.sql` (users+identities+hash) | OK |
| Storage | `04-storage.sql` (0 objetos) | OK |
| Validação | `VALIDATE.log` → `RESTORE_OK` | OK |

Plano Free sem download de backup oficial — dump lógico offsite.

## Migração DELETE (Cloud)

- Nome registrado: `storage_delete_policy` (version `20261112180108`)
- SQL = `supabase/migrations/20261112121500_storage_delete_policy.sql` (Docker-tested)
- Policies: `nexa_arquivo_apagar` + `criar` + `ler`
- Sem delete de arquivos reais (bucket vazio)
- Rollback: `drop policy if exists nexa_arquivo_apagar on storage.objects;`

## Deployment

| Item | Valor |
|---|---|
| Production | **Ready** |
| Alias | https://nexa-workspace-tau.vercel.app |
| Deploy | https://nexa-workspace-7y5aot2ww-nexa-lab.vercel.app |
| `NEXT_PUBLIC_APP_URL` | `https://nexa-workspace-tau.vercel.app` (env + bundle JS) |

## Smoke não destrutivo

| Rota | Resultado |
|---|---|
| `/login` | 200, formulário e-mail/senha |
| `/crm` | redireciona → `/login` |
| `/kanban` | redireciona → `/login` |
| `/acompanhamento` | 200 público |
| APP_URL no JS | presente no chunk de login |

`ACESSO_TESTE_*` **não removidas** (limpeza posterior).

## Ambientes

| Uso | Env |
|---|---|
| Conta real / UI | `.env.local` → Cloud |
| Testes mutáveis | `.env.docker.local` → Docker `54621` |
