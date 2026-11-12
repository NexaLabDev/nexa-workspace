-- Migração já aplicada no Supabase NexaLab como versão 20261111174910.
-- Recuperada do histórico de migrações do próprio banco; NÃO reaplicar manualmente.
create function public.estado_workspace() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('usuario',auth.uid(),'workspace',public.workspace_id_atual(),'registros',public.ler_registros())
$$;
revoke all on function public.estado_workspace() from public,anon,authenticated,service_role;
grant execute on function public.estado_workspace() to authenticated;
create table public.avisos_usuario(
 workspace_id uuid not null default public.workspace_id_atual(), perfil_id uuid not null default auth.uid(),
 chave text not null check(length(chave) between 1 and 600), criado_em timestamptz not null default now(),
 primary key(workspace_id,perfil_id,chave), foreign key(workspace_id,perfil_id) references public.perfis(workspace_id,id)
);
create table public.dispositivos_push(
 workspace_id uuid not null default public.workspace_id_atual(), perfil_id uuid not null default auth.uid(),
 endpoint text not null check(length(endpoint)<=1000), chaves jsonb not null, filtro text check(length(filtro)<=120),
 primary key(workspace_id,perfil_id,endpoint), foreign key(workspace_id,perfil_id) references public.perfis(workspace_id,id)
);
alter table public.avisos_usuario enable row level security;
alter table public.dispositivos_push enable row level security;
alter table public.avisos_usuario force row level security;
alter table public.dispositivos_push force row level security;
revoke all on public.avisos_usuario,public.dispositivos_push from public,anon,authenticated,service_role;
grant select,insert(chave) on public.avisos_usuario to authenticated;
grant select,insert(endpoint,chaves,filtro),update(chaves,filtro),delete on public.dispositivos_push to authenticated;
create policy avisos_proprios on public.avisos_usuario for all to authenticated using(workspace_id=(select public.workspace_id_atual()) and perfil_id=(select auth.uid())) with check(workspace_id=(select public.workspace_id_atual()) and perfil_id=(select auth.uid()));
create policy dispositivos_proprios on public.dispositivos_push for all to authenticated using(workspace_id=(select public.workspace_id_atual()) and perfil_id=(select auth.uid())) with check(workspace_id=(select public.workspace_id_atual()) and perfil_id=(select auth.uid()));
