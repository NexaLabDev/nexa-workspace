-- Baseline Cloud (pré-DELETE) — regenera apenas as policies já existentes.
-- Uso: restauração pontual se CREATE/READ Storage forem alteradas por engano.
-- Não remove nexa_arquivo_apagar (use 03_rollback_delete.sql para isso).

drop policy if exists nexa_arquivo_ler on storage.objects;
drop policy if exists nexa_arquivo_criar on storage.objects;

create policy nexa_arquivo_ler on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nexa-arquivos'
    and (storage.foldername(name))[1] = (select public.workspace_id_atual())::text
    and (select public.pode('arquivos', 'ler'))
  );

create policy nexa_arquivo_criar on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nexa-arquivos'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$'
    and (storage.foldername(name))[1] = (select public.workspace_id_atual())::text
    and (select public.pode('arquivos', 'criar'))
  );
