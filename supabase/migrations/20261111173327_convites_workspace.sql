create table public.convites_workspace (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default public.workspace_id_atual() references public.workspaces(id),
 email text not null check(email=lower(btrim(email)) and length(email) between 3 and 320 and position('@' in email)>1),
 criado_por uuid not null default auth.uid() references public.perfis(id),
 expira_em timestamptz not null default now()+interval '7 days',
 aceito_em timestamptz, unique(workspace_id,email)
);
alter table public.convites_workspace enable row level security;
alter table public.convites_workspace force row level security;
revoke all on public.convites_workspace from public,anon,authenticated,service_role;
grant select,insert(email),delete on public.convites_workspace to authenticated;
create policy convites_admin on public.convites_workspace for all to authenticated
using(workspace_id=(select public.workspace_id_atual()) and (select public.papel_atual())='administrador')
with check(workspace_id=(select public.workspace_id_atual()) and (select public.papel_atual())='administrador');
create trigger convites_auditar after insert or update or delete on public.convites_workspace for each row execute function nexa_privado.auditar();
create function nexa_privado.aceitar_convite(p_convite uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare conta auth.users%rowtype; convite public.convites_workspace%rowtype; ws uuid;
begin
 select * into conta from auth.users where id=auth.uid() and email_confirmed_at is not null and not is_anonymous and deleted_at is null and (banned_until is null or banned_until<=now()) for update;
 if not found then return null; end if;
 select workspace_id into ws from public.perfis where id=conta.id and ativo;
 if found then return ws; end if;
 select * into convite from public.convites_workspace where id=p_convite and email=lower(conta.email) and expira_em>now() and aceito_em is null for update;
 if not found or exists(select from public.perfis where id=conta.id) then return null; end if;
 insert into public.perfis(id,workspace_id,email,papel) values(conta.id,convite.workspace_id,conta.email,'visualizador');
 update public.convites_workspace set aceito_em=now() where id=convite.id;
 return convite.workspace_id;
end $$;
create function public.aceitar_convite_workspace(p_convite uuid default null) returns uuid language sql security invoker set search_path='' as $$select nexa_privado.aceitar_convite(p_convite)$$;
revoke all on function public.aceitar_convite_workspace(uuid),nexa_privado.aceitar_convite(uuid) from public,anon,authenticated,service_role;
grant execute on function public.aceitar_convite_workspace(uuid),nexa_privado.aceitar_convite(uuid) to authenticated;
