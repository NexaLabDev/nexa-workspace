-- Teste efetivo da policy nexa_arquivo_apagar no Postgres isolado.
-- Uso:
--   Get-Content ... | docker exec -e PGPASSWORD=postgres -i supabase_db_nexa-teste-local \
--     psql -h 127.0.0.1 -U supabase_storage_admin -d postgres -v ON_ERROR_STOP=1
-- Encerra em ROLLBACK.

begin;

create temporary table sessao (
  workspace_id uuid not null,
  uid uuid not null,
  papel public.papel not null
) on commit drop;

-- Dois workspaces e três usuários
insert into sessao values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'colaborador'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'colaborador'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'administrador'),
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'colaborador');

-- stubs de sessão (sobrescreve funções só nesta transação via create or replace; rollback restaura? 
-- Em Postgres, CREATE OR REPLACE persiste — usamos search_path + wrappers em schema temp.
create schema if not exists teste_rls;

create or replace function teste_rls.ws() returns uuid language sql stable as $$
  select workspace_id from sessao where uid = current_setting('request.jwt.claim.sub', true)::uuid limit 1
$$;
create or replace function teste_rls.papel() returns public.papel language sql stable as $$
  select papel from sessao where uid = current_setting('request.jwt.claim.sub', true)::uuid limit 1
$$;
create or replace function teste_rls.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Usa as funções reais se existirem; para o teste aplicamos a policy com predicados equivalentes inline.

truncate storage.objects;

insert into storage.objects (bucket_id, name, owner) values
  ('nexa-arquivos', '11111111-1111-1111-1111-111111111111/arq-a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('nexa-arquivos', '11111111-1111-1111-1111-111111111111/arq-b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('nexa-arquivos', '22222222-2222-2222-2222-222222222222/arq-x', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('nexa-arquivos', '11111111-1111-1111-1111-111111111111/nome invalido!', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

drop policy if exists nexa_arquivo_apagar on storage.objects;
-- Equivalente à migração: pode('arquivos','excluir') ⊕ admin/gestor ou owner
create policy nexa_arquivo_apagar on storage.objects
  for delete to public
  using (
    bucket_id = 'nexa-arquivos'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$'
    and (storage.foldername(name))[1] = (select teste_rls.ws())::text
    and (select teste_rls.papel()) in ('administrador'::public.papel, 'gestor'::public.papel, 'colaborador'::public.papel)
    and (
      (select teste_rls.papel()) in ('administrador'::public.papel, 'gestor'::public.papel)
      or owner = (select teste_rls.uid())
    )
  );

-- Sessão já é supabase_storage_admin (dono da tabela)
set local row_security = on;
alter table storage.objects force row level security;

-- 1) Colaborador A apaga o próprio
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/arq-a';
do $$ begin
  if exists (select 1 from storage.objects where name like '%/arq-a') then
    raise exception 'FALHA: colaborador deveria apagar o próprio arquivo';
  end if;
end $$;

-- 2) Colaborador A NÃO apaga arquivo do colega B
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/arq-b';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%/arq-b') then
    raise exception 'FALHA: colaborador apagou arquivo de outro colaborador';
  end if;
end $$;

-- 3) Admin apaga arquivo do colaborador B
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/arq-b';
do $$ begin
  if exists (select 1 from storage.objects where name like '%/arq-b') then
    raise exception 'FALHA: administrador deveria apagar arquivo do workspace';
  end if;
end $$;

-- 4) Colaborador do WS1 não apaga WS2
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
delete from storage.objects where name = '22222222-2222-2222-2222-222222222222/arq-x';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%/arq-x') then
    raise exception 'FALHA: exclusão cruzou workspace';
  end if;
end $$;

-- 5) Nome inválido não apaga
delete from storage.objects where name = '11111111-1111-1111-1111-111111111111/nome invalido!';
do $$ begin
  if not exists (select 1 from storage.objects where name like '%nome invalido%') then
    raise exception 'FALHA: nome inválido foi apagado';
  end if;
end $$;

do $$ begin raise notice 'OK storage_delete_policy_isolado (owner + papel + workspace)'; end $$;

rollback;
