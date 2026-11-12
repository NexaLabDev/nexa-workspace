-- Rollback da migração DELETE — volta ao estado Cloud atual (só CREATE + READ).
-- Seguro e rápido: não mexe em dados nem no bucket.

drop policy if exists nexa_arquivo_apagar on storage.objects;

-- Conferência esperada após rollback:
-- select polname from pg_policy pol
-- join pg_class c on c.oid = pol.polrelid
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'storage' and c.relname = 'objects' and pol.polname like 'nexa_%'
-- order by 1;
-- → nexa_arquivo_criar, nexa_arquivo_ler
