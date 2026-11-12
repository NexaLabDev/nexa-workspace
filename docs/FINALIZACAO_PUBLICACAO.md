# Finalização — prontidão para publicar

Atualizado: 2026-11-12  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6

## Veredito

**Ainda não pronta para Production** — faltam 2 passos operacionais (env + migração DELETE autorizada).  
**Pronta para merge/Preview** após cadastrar `NEXT_PUBLIC_APP_URL` e validar o Preview; a migração DELETE pode ir no mesmo go-live ou imediatamente depois, com backup.

## Conta e permissões (Cloud, só leitura)

| Item | Valor |
|---|---|
| Conta | `suportenexalab@gmail.com` |
| Papel | `administrador` (ativo) |
| Workspace | Nexa Lab |
| Permissões matriz | 49 ações (administrador) — acesso total a módulos |
| Membros ativos no workspace | 1 (você) |

Papéis esperados no produto: administrador / gestor / colaborador / visualizador — sua conta é o administrador do workspace.

## Páginas autenticadas

- Login real na Cloud: **OK** (confirmado por você).
- E2E mutáveis: já cobertos no **Docker** (não repetidos na Cloud).
- Cloud: checagens só de leitura (perfil, permissões, policies Storage). Sem writes.

## PR #6

- OPEN, MERGEABLE, checks Vercel **SUCCESS**
- HEAD `65af7b6` (auth callbacks + E2E + fixes UI + DELETE migration file)
- Preview Ready (SSO): `nexa-workspace-git-audit-continuidade-workspace-nexa-lab.vercel.app`

## Vercel — `NEXT_PUBLIC_APP_URL`

**Ausente** hoje. Variáveis presentes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ACESSO_TESTE_*`.

Configurar em Production + Preview (+ Development se quiser):

```text
NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app
```

Impacto se faltar: links de acompanhamento/convite/recuperação podem cair no host errado (SSO Preview ou origin inadequado).

## Migração DELETE Storage

Arquivo: `supabase/migrations/20261112121500_storage_delete_policy.sql`

| Ambiente | Policy DELETE `nexa_arquivo_apagar` |
|---|---|
| Docker (testes) | Aplicada e validada |
| Cloud produção | **Não existe** — só `nexa_arquivo_criar` + `nexa_arquivo_ler` |

### Backup (antes de aplicar)

1. Dashboard Supabase → Project Settings → Database → **Download backup** / PITR se disponível.
2. Opcional: exportar policies atuais:
   ```sql
   select polname, pg_get_expr(polqual, polrelid)
   from pg_policy where polrelid = 'storage.objects'::regclass;
   ```
3. Anotar bucket `nexa-arquivos`.

### Implantação (só com autorização)

1. Aplicar o SQL da migração no SQL Editor (ou `supabase db push` com cuidado).
2. Smoke: upload → delete como admin; colaborador só do próprio `owner`.

### Reversão

```sql
drop policy if exists nexa_arquivo_apagar on storage.objects;
-- se havia policy antiga, recriar a partir do backup / snapshot
```

Compatibilidade: mudança só de RLS DELETE; não altera tabelas de negócio.

## Impedimentos restantes para publicar

1. **P0** Cadastrar `NEXT_PUBLIC_APP_URL` na Vercel e redeploy.
2. **P0** Autorizar e aplicar migração DELETE (com backup) — senão exclusão de anexos na nuvem continua quebrada.
3. **P1** Confirmar Redirect URLs Auth: `http://127.0.0.1:3000/**`, `http://localhost:3000/**`, domínio tau.
4. **P2** HIBP (plano Free) — aceitar sem ou upgrade.
5. **P2** Remover/rotacionar `ACESSO_TESTE_*` na Vercel se obsoletos.
6. Merge/`main` só após sua autorização.

## Backlog de desenvolvimento (pós-publicação)

### P0 — operação / confiabilidade
1. Aplicar DELETE Storage + smoke de anexos em Production.
2. Hardening Auth redirects + monitoramento de `invalid_credentials`.
3. Backup automático / runbook de restore documentado na equipe.

### P1 — produto incompleto (já marcado no código)
1. **CRM Automação** e **Relatórios** (`[A DEFINIR]`).
2. **Conversas reais** (hoje “Modo demonstração” — não envia ao cliente).
3. **Push / avisos agendados** (VAPID + agendador incompletos).
4. **Aditivo contratual** (modelo pendente).
5. Cadastro completo de **preços** (calculadora/catálogo ainda `[A DEFINIR]`).

### P2 — evolução
1. Equipes/convites em escala (hoje 1 admin).
2. Integrações externas (WhatsApp/e-mail real).
3. Relatórios financeiros avançados.
4. Testes E2E na CI (Playwright) contra Docker no pipeline.

## Separação de ambientes

| Uso | Env |
|---|---|
| Conta real / UI manual | `.env.local` → Cloud |
| Testes que gravam/apagam | `.env.docker.local` → Docker `54621` |
