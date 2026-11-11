-- Entrega 1A. Aplicar em uma única transação. Identidades são provisionadas fora do Git.
create schema nexa_privado;
revoke all on schema nexa_privado from public, anon, authenticated, service_role;

-- Tipos
-- --------------------------------------------

create type public.papel as enum (
  'administrador',
  'gestor',
  'colaborador',
  'visualizador'
);

-- Módulos que já existem no produto. As tabelas operacionais entram nas
-- entregas seguintes e passam a consultar public.pode(). Recebimentos é uma
-- tela sobre leads e vendas, então não há módulo à parte. Preferências
-- continuam no navegador até a entrega de sessão.
create type public.modulo as enum (
  'workspace',
  'usuarios',
  'equipes',
  'auditoria',
  'leads',
  'vendas',
  'metas',
  'clientes',
  'projetos',
  'arquivos',
  'conversas',
  'documentos',
  'servicos',
  'prestadora'
);

create type public.acao as enum ('ler', 'criar', 'editar', 'excluir');

-- --------------------------------------------
-- Tabelas
-- --------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  admins_ativos integer not null default 0 check (admins_ativos >= 0),
  constraint workspaces_nome_ok check (char_length(btrim(nome)) between 1 and 120)
);

comment on table public.workspaces is
  'Organização criada junto com seu primeiro administrador autorizado.';

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  nome text,
  email text,
  -- Texto livre, o mesmo campo de Configurações. Não é o papel de acesso.
  cargo text,
  papel public.papel not null default 'visualizador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (workspace_id, id),
  constraint perfis_nome_ok check (nome is null or char_length(nome) <= 120),
  constraint perfis_email_ok check (email is null or char_length(email) <= 320),
  constraint perfis_cargo_ok check (cargo is null or char_length(cargo) <= 80)
);

comment on table public.perfis is
  'Conta ligada ao login do Supabase. cargo é o texto do perfil; papel é a permissão.';
comment on column public.perfis.cargo is
  'Função exibida no perfil. Independente de papel.';

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  nome text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (workspace_id, id),
  constraint equipes_nome_ok check (char_length(btrim(nome)) between 1 and 80)
);

comment on table public.equipes is
  'Grupo de pessoas do mesmo workspace.';

create table public.equipe_membros (
  workspace_id uuid not null,
  equipe_id uuid not null,
  perfil_id uuid not null,
  foreign key (workspace_id, equipe_id) references public.equipes (workspace_id, id) on delete cascade,
  foreign key (workspace_id, perfil_id) references public.perfis (workspace_id, id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (equipe_id, perfil_id)
);

comment on table public.equipe_membros is
  'Pessoa dentro de uma equipe. As duas precisam ser do mesmo workspace.';

create table public.permissoes_papel (
  papel public.papel not null,
  modulo public.modulo not null,
  acao public.acao not null,
  primary key (papel, modulo, acao)
);

comment on table public.permissoes_papel is
  'Matriz fixa desta entrega. O navegador só lê. Mudança de regra entra por migração.';

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  perfil_id uuid, -- Identidade histórica do ator mesmo após remoção da conta.
  origem text not null,
  campos text[] not null,
  em timestamptz not null default now(),
  tabela text not null,
  registro_id text not null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  constraint auditoria_tabela_ok check (tabela ~ '^[a-z][a-z0-9_]{0,62}$'),
  constraint auditoria_registro_ok check (char_length(registro_id) between 1 and 200),
  constraint auditoria_acao_ok check (acao in ('criar', 'editar', 'excluir', 'restaurar'))
);

comment on table public.auditoria is
  'Quem alterou o quê. A pessoa não escolhe o próprio id: o gatilho registra a alteração na mesma transação.';

create index perfis_workspace_idx on public.perfis (workspace_id);
create index perfis_admin_idx on public.perfis (workspace_id) where papel = 'administrador' and ativo;
create index equipes_workspace_idx on public.equipes (workspace_id);
create unique index equipes_nome_unico on public.equipes (workspace_id, lower(btrim(nome)));
create index equipe_membros_perfil_idx on public.equipe_membros (perfil_id);
create index auditoria_workspace_em_idx on public.auditoria (workspace_id, em desc);

-- --------------------------------------------
-- Matriz de permissão (antes do RLS, para o dono da tabela gravar)
-- --------------------------------------------
-- Leitura: todo papel ativo lê o workspace, exceto a auditoria (só administrador).
-- Operacional (leads, vendas, clientes, projetos, arquivos, conversas, documentos):
--   colaborador, gestor e administrador criam, editam e excluem.
-- Gestão (metas, serviços, prestadora, equipes e usuários): gestor e administrador.
-- Gestor edita usuários, mas o gatilho impede promover ou alterar um administrador.
-- Workspace: só o administrador edita. Ninguém cria outro por esta matriz.

insert into public.permissoes_papel (papel, modulo, acao)
select r.papel, m.modulo, 'ler'::public.acao
from unnest(enum_range(null::public.papel)) as r(papel)
cross join unnest(enum_range(null::public.modulo)) as m(modulo)
where m.modulo is distinct from 'auditoria'::public.modulo
   or r.papel = 'administrador'::public.papel;

insert into public.permissoes_papel (papel, modulo, acao)
select r.papel, m.modulo, a.acao
from unnest(array['administrador', 'gestor', 'colaborador']::public.papel[]) as r(papel)
cross join unnest(array[
  'leads', 'vendas', 'clientes', 'projetos', 'arquivos', 'conversas', 'documentos'
]::public.modulo[]) as m(modulo)
cross join unnest(array['criar', 'editar', 'excluir']::public.acao[]) as a(acao);

insert into public.permissoes_papel (papel, modulo, acao)
select r.papel, m.modulo, a.acao
from unnest(array['administrador', 'gestor']::public.papel[]) as r(papel)
cross join unnest(array[
  'metas', 'servicos', 'prestadora', 'equipes'
]::public.modulo[]) as m(modulo)
cross join unnest(array['criar', 'editar', 'excluir']::public.acao[]) as a(acao);

insert into public.permissoes_papel (papel, modulo, acao)
values ('administrador', 'workspace', 'editar'),
       ('administrador', 'usuarios', 'editar'), ('gestor', 'usuarios', 'editar');

-- --------------------------------------------
-- Apenas o operador do projeto configura e consome a autorização inicial.
create table nexa_privado.autorizacao_inicial (
  unica boolean primary key default true check (unica),
  email text not null check (email = lower(btrim(email)) and email <> ''),
  workspace_id uuid unique references public.workspaces(id),
  consumida_em timestamptz,
  check ((workspace_id is null) = (consumida_em is null))
);
alter table nexa_privado.autorizacao_inicial enable row level security;
revoke all on nexa_privado.autorizacao_inicial from public, anon, authenticated, service_role;

-- O lookup privado evita recursão na política de perfis. O sujeito vem da sessão.
create function nexa_privado.perfil_atual()
returns table (workspace_id uuid, papel public.papel)
language sql stable security definer set search_path = ''
as $$
  select p.workspace_id, p.papel from public.perfis p
  where p.id = (select auth.uid()) and p.ativo
$$;

create function public.workspace_id_atual() returns uuid
language sql stable security invoker set search_path = ''
as $$ select workspace_id from nexa_privado.perfil_atual() $$;

create function public.papel_atual() returns public.papel
language sql stable security invoker set search_path = ''
as $$ select papel from nexa_privado.perfil_atual() $$;

create function public.pode(p_modulo public.modulo, p_acao public.acao) returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.permissoes_papel
    where papel = (select public.papel_atual()) and modulo = p_modulo and acao = p_acao)
$$;

alter table public.equipes alter workspace_id set default public.workspace_id_atual();
alter table public.equipe_membros alter workspace_id set default public.workspace_id_atual();

-- Usadas apenas pelo operador confiável. O e-mail esperado e o UUID precisam
-- corresponder à mesma conta Auth confirmada e apta. O lock coordena mudanças no Auth.
create function nexa_privado.email_verificado(p_usuario uuid, p_email text) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  email_atual text;
begin
  select u.email into strict email_atual from auth.users u
  where u.id = p_usuario and lower(u.email) = lower(btrim(p_email))
    and u.email_confirmed_at is not null and not u.is_anonymous
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  for update;
  return email_atual;
end;
$$;

create function nexa_privado.ativar_inicial(p_usuario uuid) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  autorizado nexa_privado.autorizacao_inicial%rowtype;
  email_atual text;
  ws uuid;
begin
  select * into strict autorizado from nexa_privado.autorizacao_inicial where unica for update;
  if autorizado.consumida_em is not null then
    raise exception 'Autorização inicial já utilizada.' using errcode = '23514';
  end if;
  email_atual := nexa_privado.email_verificado(p_usuario, autorizado.email);
  insert into public.workspaces (nome) values ('Nexa Lab') returning id into ws;
  insert into public.perfis (id, workspace_id, email, papel)
    values (p_usuario, ws, email_atual, 'administrador');
  update nexa_privado.autorizacao_inicial set workspace_id = ws, consumida_em = now() where unica;
  return ws;
end;
$$;

create function nexa_privado.associar_visualizador(p_workspace uuid, p_usuario uuid, p_email text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.perfis (id, workspace_id, email, papel)
    values (p_usuario, p_workspace, nexa_privado.email_verificado(p_usuario, p_email), 'visualizador');
end;
$$;

create function nexa_privado.marcar_atualizado() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.atualizado_em := statement_timestamp();
  return new;
end;
$$;
create trigger workspaces_atualizado before update of nome on public.workspaces
  for each row execute function nexa_privado.marcar_atualizado();
create trigger perfis_atualizado before update on public.perfis
  for each row execute function nexa_privado.marcar_atualizado();
create trigger equipes_atualizado before update on public.equipes
  for each row execute function nexa_privado.marcar_atualizado();

create function nexa_privado.normalizar_nome() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.nome := btrim(new.nome);
  return new;
end;
$$;
create trigger equipes_normalizar before insert or update of nome on public.equipes
  for each row execute function nexa_privado.normalizar_nome();
create trigger workspaces_normalizar before insert or update of nome on public.workspaces
  for each row execute function nexa_privado.normalizar_nome();

create function nexa_privado.guardar_perfil() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  sujeito uuid := auth.uid();
  ator public.papel;
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.workspace_id) is distinct from (old.id, old.workspace_id) then
      raise exception 'Identidade e workspace são fixos.' using errcode = '42501';
    end if;
    if sujeito is not null then
      select p.papel into ator from public.perfis p
      where p.id = sujeito and p.workspace_id = old.workspace_id and p.ativo for share;
      if ator is null then
        raise exception 'Sessão sem vínculo ativo.' using errcode = '42501';
      end if;
      if ator <> 'administrador' then
        if old.id = sujeito then
          if (new.papel, new.ativo) is distinct from (old.papel, old.ativo) then
            raise exception 'Alteração do próprio acesso recusada.' using errcode = '42501';
          end if;
        elsif ator <> 'gestor' or old.papel in ('gestor', 'administrador')
           or new.papel in ('gestor', 'administrador') then
          raise exception 'Alteração de perfil não permitida.' using errcode = '42501';
        end if;
      end if;
    end if;
  end if;
  if new.ativo and (tg_op = 'INSERT' or not old.ativo or new.papel is distinct from old.papel) then
    perform 1 from auth.users u where u.id = new.id and u.email_confirmed_at is not null
      and not u.is_anonymous and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) for share;
    if not found then
      raise exception 'Conta indisponível para ativação.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger perfis_guardar before insert or update on public.perfis
  for each row execute function nexa_privado.guardar_perfil();

-- Um único contador por workspace serializa alterações concorrentes de administradores.
-- A validação diferida permite criar o workspace e o primeiro perfil na mesma transação.
create function nexa_privado.contar_administradores() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  delta integer := 0;
begin
  if tg_op <> 'INSERT' and old.ativo and old.papel = 'administrador' then delta := delta - 1; end if;
  if tg_op <> 'DELETE' and new.ativo and new.papel = 'administrador' then delta := delta + 1; end if;
  if delta <> 0 then
    update public.workspaces set admins_ativos = admins_ativos + delta
    where id = coalesce(new.workspace_id, old.workspace_id);
  end if;
  return null;
end;
$$;
create trigger perfis_contar after insert or update or delete on public.perfis
  for each row execute function nexa_privado.contar_administradores();

create function nexa_privado.exigir_administrador() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.workspaces where id = new.id and admins_ativos < 1) then
    raise exception 'Mantenha um administrador ativo neste workspace.' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger workspace_com_admin after insert or update of admins_ativos on public.workspaces
  deferrable initially deferred for each row execute function nexa_privado.exigir_administrador();

-- O cadastro por si só não concede vínculo. Sincroniza somente perfis já associados.
create function nexa_privado.sincronizar_auth() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  permite_acesso boolean := new.email_confirmed_at is not null and not new.is_anonymous
    and new.deleted_at is null and (new.banned_until is null or new.banned_until <= now());
begin
  update public.perfis p set email = new.email, ativo = p.ativo and permite_acesso
  where p.id = new.id and (p.email is distinct from new.email or (p.ativo and not permite_acesso));
  return null;
end;
$$;
create trigger usuarios_sincronizar after update of email, email_confirmed_at, is_anonymous, deleted_at, banned_until on auth.users
  for each row execute function nexa_privado.sincronizar_auth();

-- O histórico nasce das linhas atingidas, inclusive nas operações do operador.
-- Nomes, cargos e e-mails aparecem só como nomes de campos alterados.
create function nexa_privado.auditar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  anterior jsonb := to_jsonb(old);
  atual jsonb := to_jsonb(new);
  linha jsonb := coalesce(atual, anterior);
  campos text[];
  ws uuid := coalesce(linha->>'workspace_id', linha->>'id')::uuid;
  chave text := coalesce(linha->>'id', concat_ws('/', linha->>'equipe_id', linha->>'perfil_id'));
  ator uuid := auth.uid();
  origem_evento text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
begin
  select array_agg(k order by k) into campos
    from jsonb_object_keys(linha) as keys(k)
    where k not in ('atualizado_em', 'criado_em', 'admins_ativos')
      and (anterior->k) is distinct from (atual->k);
  if campos is null then return null; end if;
  insert into public.auditoria (workspace_id, perfil_id, origem, tabela, registro_id, acao, campos, antes, depois)
    values (ws, ator, origem_evento, tg_table_name, chave,
      case tg_op when 'INSERT' then 'criar' when 'UPDATE' then 'editar' else 'excluir' end, campos,
      case when anterior is not null then jsonb_strip_nulls(jsonb_build_object('papel', anterior->'papel', 'ativo', anterior->'ativo')) end,
      case when atual is not null then jsonb_strip_nulls(jsonb_build_object('papel', atual->'papel', 'ativo', atual->'ativo')) end);
  return null;
end;
$$;

create trigger workspaces_auditar after insert or update of nome on public.workspaces
  for each row execute function nexa_privado.auditar();
create trigger perfis_auditar after insert or update or delete on public.perfis
  for each row execute function nexa_privado.auditar();
create trigger equipes_auditar after insert or update or delete on public.equipes
  for each row execute function nexa_privado.auditar();
create trigger equipe_membros_auditar after insert or delete on public.equipe_membros
  for each row execute function nexa_privado.auditar();
alter table public.workspaces enable row level security;
alter table public.perfis enable row level security;
alter table public.equipes enable row level security;
alter table public.equipe_membros enable row level security;
alter table public.permissoes_papel enable row level security;
alter table public.auditoria enable row level security;

alter table public.workspaces force row level security;
alter table public.perfis force row level security;
alter table public.equipes force row level security;
alter table public.equipe_membros force row level security;
alter table public.permissoes_papel force row level security;
alter table public.auditoria force row level security;

create policy workspaces_ler on public.workspaces
  for select to authenticated
  using (id = (select public.workspace_id_atual()));

create policy workspaces_editar on public.workspaces
  for update to authenticated
  using (id = (select public.workspace_id_atual()) and (select public.pode('workspace', 'editar')))
  with check (id = (select public.workspace_id_atual()) and (select public.pode('workspace', 'editar')));

create policy perfis_ler on public.perfis
  for select to authenticated
  using (workspace_id = (select public.workspace_id_atual()));

create policy perfis_editar on public.perfis
  for update to authenticated
  using (
    workspace_id = (select public.workspace_id_atual())
    and (id = (select auth.uid()) or (select public.pode('usuarios', 'editar')))
  )
  with check (
    workspace_id = (select public.workspace_id_atual())
    and (id = (select auth.uid()) or (select public.pode('usuarios', 'editar')))
  );

create policy equipes_ler on public.equipes
  for select to authenticated
  using (workspace_id = (select public.workspace_id_atual()));

create policy equipes_criar on public.equipes
  for insert to authenticated
  with check (
    workspace_id = (select public.workspace_id_atual())
    and (select public.pode('equipes', 'criar'))
  );

create policy equipes_editar on public.equipes
  for update to authenticated
  using (workspace_id = (select public.workspace_id_atual()) and (select public.pode('equipes', 'editar')))
  with check (workspace_id = (select public.workspace_id_atual()) and (select public.pode('equipes', 'editar')));

create policy equipes_excluir on public.equipes
  for delete to authenticated
  using (workspace_id = (select public.workspace_id_atual()) and (select public.pode('equipes', 'excluir')));

create policy equipe_membros_ler on public.equipe_membros for select to authenticated
  using (workspace_id = (select public.workspace_id_atual()));
create policy equipe_membros_criar on public.equipe_membros for insert to authenticated
  with check (workspace_id = (select public.workspace_id_atual()) and (select public.pode('equipes', 'criar')));
create policy equipe_membros_excluir on public.equipe_membros for delete to authenticated
  using (workspace_id = (select public.workspace_id_atual()) and (select public.pode('equipes', 'excluir')));

create policy permissoes_ler on public.permissoes_papel
  for select to authenticated
  using ((select public.workspace_id_atual()) is not null);

create policy auditoria_ler on public.auditoria
  for select to authenticated
  using (
    workspace_id = (select public.workspace_id_atual())
    and (select public.papel_atual()) = 'administrador'
  );


-- Supabase pode conceder privilégios por padrão. Remover também os grants
-- explícitos dos papéis da API antes de conceder as operações permitidas.
revoke all on public.workspaces, public.perfis, public.equipes, public.equipe_membros,
  public.permissoes_papel, public.auditoria from public, anon, authenticated, service_role;
revoke all on all functions in schema nexa_privado from public, anon, authenticated, service_role;
revoke all on function public.workspace_id_atual(), public.papel_atual(), public.pode(public.modulo, public.acao)
  from public, anon, authenticated, service_role;
grant usage on schema public, nexa_privado to authenticated;
grant execute on function nexa_privado.perfil_atual(), public.workspace_id_atual(),
  public.papel_atual(), public.pode(public.modulo, public.acao) to authenticated;
grant select on public.workspaces, public.perfis, public.equipes, public.equipe_membros,
  public.permissoes_papel, public.auditoria to authenticated;
grant update (nome) on public.workspaces to authenticated;
grant update (nome, cargo, papel, ativo) on public.perfis to authenticated;
grant insert (workspace_id, nome), update (nome), delete on public.equipes to authenticated;
grant insert (workspace_id, equipe_id, perfil_id), delete on public.equipe_membros to authenticated;
