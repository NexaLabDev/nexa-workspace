-- Pendente de autorização: NÃO aplicar em produção sem aprovação explícita.
--
-- Regras:
-- - bucket privado `nexa-arquivos`
-- - pasta = workspace_id_atual() → bloqueia outro workspace
-- - precisa pode('arquivos','excluir')
-- - administrador/gestor: podem apagar qualquer arquivo do workspace
-- - colaborador: só apaga arquivos cujo owner = auth.uid()
-- - visualizador: sem excluir (bloqueado por pode)
--
-- owner é preenchido pelo Storage no upload autenticado.

drop policy if exists nexa_arquivo_apagar on storage.objects;

create policy nexa_arquivo_apagar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'nexa-arquivos'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$'
    and (storage.foldername(name))[1] = (select public.workspace_id_atual())::text
    and (select public.pode('arquivos', 'excluir'))
    and (
      (select public.papel_atual()) in ('administrador'::public.papel, 'gestor'::public.papel)
      or owner = (select auth.uid())
    )
  );
