# Auditoria técnica — Nexa Workspace

Branch: `audit/continuidade-workspace`  
PR: https://github.com/NexaLabDev/nexa-workspace/pull/6  
Atualizado: 2026-11-12 (gaps: etapa CRM, subtarefa, mobile, viewer)

## Ambiente isolado usado

- Docker Desktop iniciado
- Stack `supabase_*_nexa-teste-local` (Postgres `54622`, Kong `54621`)
- Contas de teste: `admin@teste.local`, `gestor@teste.local`, `colab@teste.local`, `viewer@teste.local`, `intruso@teste.local`
- `.env.local` aponta para o isolado (não commitado)
- **Nenhuma migração/aplicação no Supabase de produção**
- **Nenhum publish Production / merge na main**

## Preview Vercel (PR #6)

| Item | Status |
|---|---|
| Check GitHub `Vercel` | SUCCESS |
| Preview URL | `https://nexa-workspace-git-audit-continuidade-workspace-nexa-lab.vercel.app` |
| Acesso sem SSO | Bloqueado (302 → Vercel SSO) — smoke HTTP só confirma Ready |
| Production | Não alterada nesta rodada |

## Problemas / decisões

| ID | Gravidade | Status |
|---|---|---|
| A08 Anexos Storage | P0 | Corrigido no código |
| A09 DELETE Storage | P1 | Policy reforçada (owner); **testada no Docker**; **não aplicada em produção** |
| A10 Domínio público tau | P1 | Corrigido no código |
| A15 Status API atrás do middleware | P2 | **Corrigido** — `/api/supabase/status` liberado; rota ainda restringe localhost |
| A16 Config só `sb_publishable_` | P2 | **Corrigido** — aceita anon JWT em URL localhost (Supabase local) |
| A17 Dashboard crash `v.data.startsWith` | P0 | **Corrigido** — `metas.ts` / `financeiro.ts` ignoram vendas sem `data` |
| A18 Clientes crash `servicos.map` | P0 | **Corrigido** — UI + `relacoes.ts` toleram `servicos` ausente |
| A19 Conversas `?lead=` race | P1 | **Corrigido** — espera sync de leads antes do fallback |
| A04 HIBP | P1 | Pro+ — sem ativação gratuita |
| A14 `NEXT_PUBLIC_APP_URL` na Vercel | P2 | Pendente (dashboard / reauth equipe) |

## Policy DELETE (revisão)

Regra proposta (migração local/pendente prod):

- mesmo workspace (`foldername` = `workspace_id_atual`)
- `pode('arquivos','excluir')`
- **admin/gestor**: qualquer arquivo do workspace
- **colaborador**: só se `owner = auth.uid()`
- **visualizador**: negado

Arquivo: `supabase/migrations/20261112121500_storage_delete_policy.sql`

### Testes efetivos (Docker + Storage API)

| Caso | Resultado |
|---|---|
| Colab apaga próprio | OK |
| Colab tenta apagar de admin | Bloqueado |
| Admin apaga de outro | OK |
| Gestor apaga do workspace | OK |
| Viewer tenta apagar | Bloqueado |
| Predicados Node (7 casos) | OK |

## Validação visual/funcional (Playwright, local isolado)

Comando: `npm run test:e2e` (Chromium desktop + Pixel 7)

| Área | Desktop | Mobile | Notas |
|---|---|---|---|
| Login | OK | OK* | *revalidar após restart do `next dev` se `.next` for limpo |
| Dashboard + menus | OK | OK | Trilho / nav |
| CRM (funil/lista) | OK | OK | Criar lead + venda ganha |
| Conversas + painel | OK | — | Pagamento à vista no painel |
| Metas | OK | OK | Sem crash com vendas incompletas |
| Recebimentos | OK | OK | Página carrega |
| Clientes | OK | OK | Sem crash com `servicos` undefined |
| Kanban / projetos | OK | OK | Projeto da venda + tarefa |
| Serviços / Calculadora / Docs | OK | OK | Smoke de rota |
| Configurações / Equipe | OK | OK | Texto de equipe/permissões |
| Conta / Acompanhamento | OK | OK | Link público gerado e aberto |
| Fluxo empresarial E2E | OK | (só desktop) | lead→venda→projeto→tarefa→pagamento→anexo→reload |
| Persistência pós-reload | OK | — | CRM + Kanban mantêm empresa E2E |
| CRM etapa (ficha + DnD a11y) | OK | — | select Contato + Space/Arrow para Proposta |
| Subtarefa + reload | OK | — | criar, reabrir sessão, reload |
| Mensagem em Conversas | OK | — | envio no chat do lead |
| Documentos (gerar) | OK | OK | smoke da tela |
| Equipe / papéis | OK | OK | admin vê papéis; viewer não persiste lead |
| Mobile forms (CRM/cliente/kanban) | — | OK | modais Cancelar usáveis |

Suite adicional: `e2e/gaps-pendentes.spec.ts` (4 passed / 4 skipped por viewport).

### Correções feitas durante a validação UI

1. `components/nexa/metas.ts` — filtra vendas sem `data`/`valor` válido
2. `components/nexa/financeiro.ts` — mesma defesa nos indicadores
3. `components/nexa/telas/TelaClientes.tsx` / `TelaCliente.tsx` — `(servicos ?? [])`
4. `components/nexa/relacoes.ts` — `servicos` opcional na reconciliação
5. `components/nexa/telas/TelaConversas.tsx` — `useEffect` reage a `leads`/`conversas` para honrar `?lead=`

### Build e segredos

- `npm run build` — **OK** (após limpar `.next` corrompido por concorrência com `next dev`)
- Segredos: `.env.local` gitignored; demo JWTs só em scripts de teste local / `.env.example` documenta placeholders
- Artefatos Playwright (`test-results/`, `playwright-report/`) adicionados ao `.gitignore`

## Checklist seguro para publicar na Vercel

1. **Backup** do projeto Supabase cloud (dados + Storage) antes de qualquer migração.
2. Cadastrar `NEXT_PUBLIC_APP_URL=https://nexa-workspace-tau.vercel.app` (Preview e Production) — links públicos de acompanhamento/convite.
3. Redeploy Preview do PR #6 e validar SSO → login → páginas críticas no Preview (não Production).
4. **Só com autorização explícita**: aplicar `20261112121500_storage_delete_policy.sql` no Supabase de produção.
5. Verificar compatibilidade: policy DELETE é aditiva/restritiva; rollback = dropar a policy nova e restaurar a anterior (ou snapshot).
6. Confirmar que Production aponta ao commit desejado; **não** fazer merge na `main` até o Preview e a migração (se autorizada) estarem ok.
7. Pós-go-live: smoke login, CRM, Kanban, upload/exclusão de anexo, link `/acompanhamento/[codigo]` no domínio tau.

## Riscos que ainda impedem publicação Production

1. Migração DELETE **não** está em produção — exclusão real de anexos na nuvem continua falha/órfãos até autorizar. (Cloud hoje: só policies criar/ler.)
2. `NEXT_PUBLIC_APP_URL` **ausente** na Vercel (confirmado via `vercel env ls`) — cadastrar `https://nexa-workspace-tau.vercel.app`.
3. HIBP indisponível no plano Free.
4. Preview protegido por SSO — validação UI mutável foi no Docker; conta real Cloud OK no localhost.

Ver `docs/FINALIZACAO_PUBLICACAO.md` para backup/implantação/reversão e backlog priorizado.
