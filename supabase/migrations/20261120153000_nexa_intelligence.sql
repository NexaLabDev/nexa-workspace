-- Nexa Intelligence: orçamentos, custos e configurações isolados por workspace.
-- Somente administradores podem acessar dados. Análises de conversas NÃO são salvas.
create table public.nexa_intelligence_config (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  dados jsonb not null check(jsonb_typeof(dados)='object' and pg_column_size(dados)<65536),
  atualizado_em timestamptz not null default now()
);
create table public.nexa_intelligence_projetos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null check(length(btrim(nome)) between 1 and 150),
  categoria text not null check(length(btrim(categoria)) between 1 and 80),
  entradas jsonb not null check(jsonb_typeof(entradas)='object' and pg_column_size(entradas)<32768),
  calculo jsonb not null check(jsonb_typeof(calculo)='object' and pg_column_size(calculo)<32768),
  criado_em timestamptz not null default now()
);
create index nexa_intelligence_projetos_workspace_idx on public.nexa_intelligence_projetos(workspace_id,criado_em desc);
alter table public.nexa_intelligence_config enable row level security;
alter table public.nexa_intelligence_config force row level security;
alter table public.nexa_intelligence_projetos enable row level security;
alter table public.nexa_intelligence_projetos force row level security;
revoke all on public.nexa_intelligence_config,public.nexa_intelligence_projetos from public,anon,authenticated;
grant select,insert,update,delete on public.nexa_intelligence_config,public.nexa_intelligence_projetos to authenticated;
create policy nexa_intelligence_config_admin on public.nexa_intelligence_config
 for all to authenticated
 using (workspace_id=(select public.workspace_id_atual()) and (select public.pode('workspace','editar')))
 with check (workspace_id=(select public.workspace_id_atual()) and (select public.pode('workspace','editar')));
create policy nexa_intelligence_projetos_admin on public.nexa_intelligence_projetos
 for all to authenticated
 using (workspace_id=(select public.workspace_id_atual()) and (select public.pode('workspace','editar')))
 with check (workspace_id=(select public.workspace_id_atual()) and (select public.pode('workspace','editar')));
