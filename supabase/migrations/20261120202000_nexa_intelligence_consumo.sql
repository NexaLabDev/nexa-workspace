-- Nexa Intelligence: uso financeiro da API, separado por workspace/usuário.
-- O usuário consulta os próprios gastos; nenhuma chave da OpenAI fica no banco.
create table public.nexa_intelligence_consumo (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid references public.nexa_intelligence_chats(id) on delete set null,
  modelo text not null check(length(modelo) between 1 and 80),
  tokens_entrada integer not null default 0 check(tokens_entrada >= 0),
  tokens_saida integer not null default 0 check(tokens_saida >= 0),
  custo_estimado_usd numeric(12,6) not null default 0 check(custo_estimado_usd >= 0),
  audio_minutos_estimados numeric(9,3),
  criado_em timestamptz not null default now()
);
create index nexa_intelligence_consumo_mes_idx
 on public.nexa_intelligence_consumo (workspace_id,usuario_id,criado_em desc);
alter table public.nexa_intelligence_consumo enable row level security;
alter table public.nexa_intelligence_consumo force row level security;
revoke all on public.nexa_intelligence_consumo from public,anon,authenticated;
grant select,insert on public.nexa_intelligence_consumo to authenticated;
create policy nexa_intelligence_consumo_ler on public.nexa_intelligence_consumo
for select to authenticated using (
 workspace_id=(select public.workspace_id_atual())
 and usuario_id=(select auth.uid()) and (select public.pode('workspace','editar'))
);
create policy nexa_intelligence_consumo_criar on public.nexa_intelligence_consumo
for insert to authenticated with check (
 workspace_id=(select public.workspace_id_atual())
 and usuario_id=(select auth.uid()) and (select public.pode('workspace','editar'))
);
