-- ============================================
-- Nexa Workspace — acesso, papéis e auditoria
-- ============================================
-- Entrega 1A. Não cria leads, clientes, projetos nem qualquer outro dado operacional.
-- Não lê nem apaga o que está salvo no navegador.
-- Este arquivo não contém chave, token nem senha.
--
-- Aplicar no projeto Supabase (SQL Editor ou `supabase db push`) só quando
-- NEXT_PUBLIC_SUPABASE_URL e as chaves já estiverem definidas fora do Git.
-- O papel postgres do Supabase ignora o RLS de propósito. O navegador, não.
-- ============================================

-- gen_random_uuid() já vem no Postgres 13+, que é o do Supabase.
-- Não cria extensão: o projeto não precisa de pgcrypto além disso.

-- --------------------------------------------
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
  constraint workspaces_nome_ok check (char_length(btrim(nome)) between 1 and 120)
);

comment on table public.workspaces is
  'Organização. Esta entrega cria uma só, quando a primeira conta é confirmada.';

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
  constraint equipes_nome_ok check (char_length(btrim(nome)) between 1 and 80)
);

comment on table public.equipes is
  'Grupo de pessoas do mesmo workspace.';

create table public.equipe_membros (
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
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
  perfil_id uuid references public.perfis (id) on delete set null,
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
  'Quem alterou o quê. A pessoa não escolhe o próprio id: a função registrar_auditoria grava.';

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
  'metas', 'servicos', 'prestadora', 'equipes', 'usuarios'
]::public.modulo[]) as m(modulo)
cross join unnest(array['criar', 'editar', 'excluir']::public.acao[]) as a(acao);

insert into public.permissoes_papel (papel, modulo, acao)
values ('administrador', 'workspace', 'editar');

-- --------------------------------------------
-- Funções de sessão
-- --------------------------------------------

create function public.workspace_id_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from public.perfis
  where id = auth.uid()
    and ativo
$$;

create function public.papel_atual()
returns public.papel
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from public.perfis
  where id = auth.uid()
    and ativo
$$;

create function public.pode(p_modulo public.modulo, p_acao public.acao)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.permissoes_papel
    where papel = public.papel_atual()
      and modulo = p_modulo
      and acao = p_acao
  )
$$;

comment on function public.pode(public.modulo, public.acao) is
  'Verdadeiro se o usuário ativo da sessão tem a ação naquele módulo.';

-- A pessoa logada grava no próprio workspace, sempre com o próprio id.
create function public.registrar_auditoria(
  p_tabela text,
  p_registro_id text,
  p_acao text,
  p_antes jsonb,
  p_depois jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_id uuid;
  ws uuid;
begin
  if auth.uid() is null or public.workspace_id_atual() is null then
    raise exception 'Auditoria exige uma sessão ativa.'
      using errcode = '42501';
  end if;
  if public.papel_atual() = 'visualizador' then
    raise exception 'Visualizador não registra auditoria.'
      using errcode = '42501';
  end if;
  if p_tabela is null or p_tabela !~ '^[a-z][a-z0-9_]{0,62}$' then
    raise exception 'Tabela de auditoria inválida.'
      using errcode = '23514';
  end if;
  if p_registro_id is null or char_length(p_registro_id) not between 1 and 200 then
    raise exception 'Registro de auditoria sem identificação.'
      using errcode = '23514';
  end if;
  if p_acao is null or p_acao not in ('criar', 'editar', 'excluir', 'restaurar') then
    raise exception 'Ação de auditoria inválida.'
      using errcode = '23514';
  end if;
  if pg_column_size(p_antes) > 500000 or pg_column_size(p_depois) > 500000 then
    raise exception 'Registro de auditoria grande demais.'
      using errcode = '54000';
  end if;

  ws := public.workspace_id_atual();
  insert into public.auditoria (workspace_id, perfil_id, tabela, registro_id, acao, antes, depois)
  values (ws, auth.uid(), p_tabela, p_registro_id, p_acao, p_antes, p_depois)
  returning id into novo_id;
  return novo_id;
end;
$$;

revoke all on function public.workspace_id_atual() from public;
revoke all on function public.papel_atual() from public;
revoke all on function public.pode(public.modulo, public.acao) from public;
revoke all on function public.registrar_auditoria(text, text, text, jsonb, jsonb) from public;

-- --------------------------------------------
-- Gatilhos
-- --------------------------------------------

create function public.marcar_atualizado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

revoke all on function public.marcar_atualizado() from public;

create trigger workspaces_atualizado
  before update on public.workspaces
  for each row execute function public.marcar_atualizado();

create function public.guardar_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'O id do workspace é fixo.'
      using errcode = '42501';
  end if;
  new.nome := btrim(new.nome);
  return new;
end;
$$;

revoke all on function public.guardar_workspace() from public;

create trigger workspaces_guardar
  before update on public.workspaces
  for each row execute function public.guardar_workspace();

create trigger perfis_atualizado
  before update on public.perfis
  for each row execute function public.marcar_atualizado();

create trigger equipes_atualizado
  before update on public.equipes
  for each row execute function public.marcar_atualizado();

-- Perfil só nasce pelo servidor (gatilho da conta). Papel e workspace
-- não sobem por conta própria. Gestor não mexe em administrador.
-- O workspace nunca fica sem um administrador ativo.
create function public.guardar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ator public.papel;
  email_login text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      raise exception 'O perfil nasce com a conta.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'O id do perfil é fixo.'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and new.workspace_id is distinct from old.workspace_id then
    raise exception 'O perfil não muda de workspace.'
      using errcode = '42501';
  end if;

  if auth.uid() is not null then
    ator := public.papel_atual();
    if ator is null then
      raise exception 'Usuário sem perfil ativo.'
        using errcode = '42501';
    end if;

    if new.email is distinct from old.email then
      select u.email into email_login from auth.users u where u.id = new.id;
      if new.email is distinct from email_login then
        raise exception 'O e-mail do perfil acompanha o login.'
          using errcode = '42501';
      end if;
    end if;

    if ator = 'administrador' then
      null;
    elsif ator = 'gestor' and public.pode('usuarios', 'editar') then
      if old.id = auth.uid() then
        if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo then
          raise exception 'Você não pode alterar o próprio papel.'
            using errcode = '42501';
        end if;
      elsif old.papel = 'administrador' or new.papel = 'administrador' then
        raise exception 'Gestor não altera um administrador.'
          using errcode = '42501';
      end if;
    else
      if old.id is distinct from auth.uid() then
        raise exception 'Você só altera o próprio perfil.'
          using errcode = '42501';
      end if;
      if new.papel is distinct from old.papel or new.ativo is distinct from old.ativo then
        raise exception 'Você não pode alterar o próprio papel.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if old.papel = 'administrador' and old.ativo
     and (new.papel is distinct from 'administrador' or not new.ativo) then
    if not exists (
      select 1
      from public.perfis
      where workspace_id = old.workspace_id
        and papel = 'administrador'
        and ativo
        and id <> old.id
    ) then
      raise exception 'O workspace precisa manter um administrador ativo.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guardar_perfil() from public;

create trigger perfis_guardar
  before insert or update on public.perfis
  for each row execute function public.guardar_perfil();

create function public.guardar_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.nome := btrim(new.nome);
  if new.nome is null or new.nome = '' then
    raise exception 'A equipe precisa de um nome.'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null
     and new.workspace_id is distinct from old.workspace_id then
    raise exception 'A equipe não muda de workspace.'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and new.workspace_id is distinct from public.workspace_id_atual() then
    raise exception 'Equipe fora do seu workspace.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guardar_equipe() from public;

create trigger equipes_guardar
  before insert or update on public.equipes
  for each row execute function public.guardar_equipe();

create function public.guardar_membro_equipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_equipe uuid;
  ws_perfil uuid;
begin
  select workspace_id into ws_equipe from public.equipes where id = new.equipe_id;
  select workspace_id into ws_perfil from public.perfis where id = new.perfil_id;
  if ws_equipe is null or ws_perfil is null or ws_equipe is distinct from ws_perfil then
    raise exception 'Equipe e pessoa precisam ser do mesmo workspace.'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and ws_equipe is distinct from public.workspace_id_atual() then
    raise exception 'Equipe fora do seu workspace.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guardar_membro_equipe() from public;

create trigger equipe_membros_guardar
  before insert or update on public.equipe_membros
  for each row execute function public.guardar_membro_equipe();

-- Primeira conta confirmada vira administrador. As seguintes entram como
-- visualizador até um administrador mudar o papel. Conta ainda não
-- confirmada não vira administrador.
create function public.tratar_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
  papel_novo public.papel;
  nome_novo text;
begin
  perform pg_advisory_xact_lock(847291001);

  if tg_op = 'INSERT' then
    select id into ws
    from public.workspaces
    order by criado_em, id
    limit 1;

    if ws is null then
      insert into public.workspaces (nome)
      values ('Nexa Lab')
      returning id into ws;
    end if;

    nome_novo := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
    if nome_novo is null then
      nome_novo := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
    end if;
    nome_novo := left(nome_novo, 120);

    papel_novo := 'visualizador';
    if new.confirmed_at is not null and not exists (
      select 1
      from public.perfis
      where workspace_id = ws
        and papel = 'administrador'
        and ativo
    ) then
      papel_novo := 'administrador';
    end if;

    insert into public.perfis (id, workspace_id, nome, email, papel)
    values (new.id, ws, nome_novo, left(new.email, 320), papel_novo)
    on conflict (id) do nothing;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.email is distinct from old.email then
      update public.perfis
      set email = left(new.email, 320)
      where id = new.id;
    end if;

    if old.confirmed_at is null and new.confirmed_at is not null then
      select workspace_id into ws from public.perfis where id = new.id;
      if ws is not null and not exists (
        select 1
        from public.perfis
        where workspace_id = ws
          and papel = 'administrador'
          and ativo
      ) then
        update public.perfis
        set papel = 'administrador'
        where id = new.id
          and papel is distinct from 'administrador';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.tratar_usuario_auth() from public;

create trigger usuarios_tratar
  after insert or update of email, confirmed_at on auth.users
  for each row execute function public.tratar_usuario_auth();

-- O default usa a função, que só existe a partir daqui.
alter table public.equipes
  alter column workspace_id set default public.workspace_id_atual();

-- --------------------------------------------
-- RLS
-- --------------------------------------------

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
  using (id = public.workspace_id_atual());

create policy workspaces_editar on public.workspaces
  for update to authenticated
  using (id = public.workspace_id_atual() and public.pode('workspace', 'editar'))
  with check (id = public.workspace_id_atual() and public.pode('workspace', 'editar'));

create policy perfis_ler on public.perfis
  for select to authenticated
  using (workspace_id = public.workspace_id_atual());

create policy perfis_editar on public.perfis
  for update to authenticated
  using (
    workspace_id = public.workspace_id_atual()
    and (id = auth.uid() or public.pode('usuarios', 'editar'))
  )
  with check (
    workspace_id = public.workspace_id_atual()
    and (id = auth.uid() or public.pode('usuarios', 'editar'))
  );

create policy equipes_ler on public.equipes
  for select to authenticated
  using (workspace_id = public.workspace_id_atual());

create policy equipes_criar on public.equipes
  for insert to authenticated
  with check (
    workspace_id = public.workspace_id_atual()
    and public.pode('equipes', 'criar')
  );

create policy equipes_editar on public.equipes
  for update to authenticated
  using (workspace_id = public.workspace_id_atual() and public.pode('equipes', 'editar'))
  with check (workspace_id = public.workspace_id_atual() and public.pode('equipes', 'editar'));

create policy equipes_excluir on public.equipes
  for delete to authenticated
  using (workspace_id = public.workspace_id_atual() and public.pode('equipes', 'excluir'));

create policy equipe_membros_ler on public.equipe_membros
  for select to authenticated
  using (
    exists (
      select 1
      from public.equipes e
      where e.id = equipe_id
        and e.workspace_id = public.workspace_id_atual()
    )
  );

create policy equipe_membros_criar on public.equipe_membros
  for insert to authenticated
  with check (
    public.pode('equipes', 'criar')
    and exists (
      select 1
      from public.equipes e
      where e.id = equipe_id
        and e.workspace_id = public.workspace_id_atual()
    )
  );

create policy equipe_membros_excluir on public.equipe_membros
  for delete to authenticated
  using (
    public.pode('equipes', 'excluir')
    and exists (
      select 1
      from public.equipes e
      where e.id = equipe_id
        and e.workspace_id = public.workspace_id_atual()
    )
  );

create policy permissoes_ler on public.permissoes_papel
  for select to authenticated
  using (public.workspace_id_atual() is not null);

create policy auditoria_ler on public.auditoria
  for select to authenticated
  using (
    workspace_id = public.workspace_id_atual()
    and public.papel_atual() = 'administrador'
  );

-- --------------------------------------------
-- Privilégios do navegador
-- --------------------------------------------
-- Sem política de insert/delete, o RLS recusa mesmo que alguém reabra o grant.
-- anon não recebe nada. A chave secreta usa service_role e ignora o RLS.

revoke all on table public.workspaces from public, anon;
revoke all on table public.perfis from public, anon;
revoke all on table public.equipes from public, anon;
revoke all on table public.equipe_membros from public, anon;
revoke all on table public.permissoes_papel from public, anon;
revoke all on table public.auditoria from public, anon;

grant usage on schema public to authenticated;

grant select, update on table public.workspaces to authenticated;
grant select, update on table public.perfis to authenticated;
grant select, insert, update, delete on table public.equipes to authenticated;
grant select, insert, delete on table public.equipe_membros to authenticated;
grant select on table public.permissoes_papel to authenticated;
grant select on table public.auditoria to authenticated;

grant execute on function public.workspace_id_atual() to authenticated;
grant execute on function public.papel_atual() to authenticated;
grant execute on function public.pode(public.modulo, public.acao) to authenticated;
grant execute on function public.registrar_auditoria(text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.marcar_atualizado() to authenticated;
grant execute on function public.guardar_workspace() to authenticated;
grant execute on function public.guardar_perfil() to authenticated;
grant execute on function public.guardar_equipe() to authenticated;
grant execute on function public.guardar_membro_equipe() to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.tratar_usuario_auth() to supabase_auth_admin;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.workspaces to service_role;
    grant all on table public.perfis to service_role;
    grant all on table public.equipes to service_role;
    grant all on table public.equipe_membros to service_role;
    grant all on table public.permissoes_papel to service_role;
    grant all on table public.auditoria to service_role;
  end if;
end;
$$;
