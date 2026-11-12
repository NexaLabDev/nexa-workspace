# Progresso — Nexa Workspace

Branch: `audit/continuidade-workspace`  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6  
Atualizado: 2026-11-12 (finalização / prontidão para publicar)

## Conta real (Cloud)

- E-mail: `suportenexalab@gmail.com`
- Papel: **administrador** (ativo)
- Workspace: **Nexa Lab**
- Matriz `permissoes_papel`: administrador com 49 ações (acesso total esperado)
- Localhost `.env.local` → Cloud `tiqyujibhjwnrpqpqmep` (Docker preservado em `.env.docker.local`)

## Feito nesta continuidade

- [x] Auth cloud no localhost + recuperação/redirects corrigidos
- [x] E2E Playwright no Docker (rotas, fluxo empresarial, gaps CRM/subtarefa/viewer/mobile)
- [x] Correções UI: metas/clientes/conversas
- [x] Policy DELETE Storage escrita + testada só no Docker
- [x] Preview Vercel do PR #6 Ready
- [x] Confirmação de papel/permissões da conta real (SQL leitura)
- [ ] `NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app` na Vercel
- [ ] Autorização para aplicar DELETE Storage em produção
- [ ] Merge na `main` / publish Production

## PR #6

- Estado: OPEN, MERGEABLE
- HEAD: `65af7b6`
- Checks: Vercel SUCCESS, Preview Comments SUCCESS
- Preview: https://nexa-workspace-git-audit-continuidade-workspace-nexa-lab.vercel.app

## Comandos (Docker / isolado)

```bash
# voltar ao isolado: copiar .env.docker.local → .env.local e reiniciar next
npm run test:e2e
npx playwright test e2e/gaps-pendentes.spec.ts
```
