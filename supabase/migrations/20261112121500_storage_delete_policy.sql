-- Pendente de autorização: NÃO aplicar em produção sem aprovação explícita.
--
-- Escopo da exclusão (igual a ler/criar):
-- - bucket privado `nexa-arquivos`
-- - pasta = workspace_id_atual()  → impede apagar arquivos de outro workspace
-- - public.pode('arquivos','excluir') → visualizador não apaga; admin/gestor/colaborador sim
--
-- Observação: o caminho é {workspace}/{arquivoId}. Não há dono por usuário no Storage;
-- quem tem "excluir" no workspace pode remover anexos da equipe (modelo colaborativo atual).

drop policy if exists nexa_arquivo_apagar on storage.objects;

create policy nexa_arquivo_apagar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'nexa-arquivos'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$'
    and (storage.foldername(name))[1] = (select public.workspace_id_atual())::text
    and (select public.pode('arquivos', 'excluir'))
  );
