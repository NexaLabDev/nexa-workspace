-- Teste isolado da policy nexa_arquivo_apagar (não roda no projeto hospedado).
-- Uso: docker exec -i <container> psql -U postgres -v ON_ERROR_STOP=1 -f - < este arquivo
-- Encerrado em ROLLBACK: nada permanece.

begin;

create schema if not exists storage;
create extension if not exists "pgcrypto";

do $$ begin
  create type modulo as enum ('arquivos','leads');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type acao as enum ('ler','criar','editar','excluir');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type papel as enum ('administrador','gestor','colaborador','visualizador');
exception when duplicate_object then null;
end $$;

create table if not exists public.permissoes_papel (
  papel papel not null,
  modulo modulo not null,
  acao acao not null,
  primary key (papel, modulo, acao)
);
truncate public.permissoes_papel;
insert into public.permissoes_papel(papel, modulo, acao) values
  ('administrador','arquivos','ler'),('administrador','arquivos','criar'),('administrador','arquivos','excluir'),
  ('colaborador','arquivos','ler'),('colaborador','arquivos','criar'),('colaborador','arquivos','excluir'),
  ('visualizador','arquivos','ler');

create table if not exists storage.buckets (id text primary key, name text);
insert into storage.buckets(id,name) values ('nexa-arquivos','nexa-arquivos')
  on conflict (id) do nothing;

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
truncate storage.objects;

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;

-- Sessão simulada
create temporary table sessao (
  workspace_id uuid not null,
  papel papel not null
) on commit drop;
insert into sessao values ('11111111-1111-1111-1111-111111111111','colaborador');

create or replace function public.workspace_id_atual() returns uuid language sql stable as $$
  select workspace_id from sessao limit 1
$$;
create or replace function public.papel_atual() returns papel language sql stable as $$
  select papel from sessao limit 1
$$;
create or replace function public.pode(p_modulo modulo, p_acao acao) returns boolean language sql stable as $$
  select exists (
    select 1 from public.permissoes_papel
    where papel = (select public.papel_atual()) and modulo = p_modulo and acao = p_acao
  )
$$;

alter table storage.objects enable row level security;
drop policy if exists nexa_arquivo_apagar on storage.objects;
create policy nexa_arquivo_apagar on storage.objects
  for delete to public
  using (
    bucket_id = 'nexa-arquivos'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$'
    and (storage.foldername(name))[1] = (select public.workspace_id_atual())::text
    and (select public.pode('arquivos', 'excluir'))
  );

-- Fixtures
insert into storage.objects(bucket_id, name) values
  ('nexa-arquivos','11111111-1111-1111-1111-111111111111/arq-ok'),
  ('nexa-arquivos','22222222-2222-2222-2222-222222222222/arq-outro-ws'),
  ('nexa-arquivos','11111111-1111-1111-1111-111111111111/nome invalido!');

-- 1) Colaborador apaga do próprio workspace
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/arq-ok';
do $$ begin
  if exists (select 1 from storage.objects where name like '%/arq-ok') then
    raise exception 'FALHA: colaborador deveria apagar arquivo do próprio workspace';
  end if;
end $$;

-- 2) Colaborador NÃO apaga de outro workspace
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/arq-outro-ws';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%/arq-outro-ws') then
    raise exception 'FALHA: exclusão cruzou workspace';
  end if;
end $$;

-- 3) Nome fora do padrão não apaga
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/nome invalido!';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%nome invalido%') then
    raise exception 'FALHA: nome inválido foi apagado';
  end if;
end $$;

-- 4) Visualizador não apaga
update sessao set papel = 'visualizador';
insert into storage.objects(bucket_id, name) values
  ('nexa-arquivos','11111111-1111-1111-1111-111111111111/arq-viz');
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/arq-viz';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%/arq-viz') then
    raise exception 'FALHA: visualizador conseguiu apagar';
  end if;
end $$;

do $$ begin raise notice 'OK: storage_delete_policy_isolado passou'; end $$;

rollback;
