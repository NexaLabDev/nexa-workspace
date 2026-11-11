-- O Supabase atribuiu esta versão ao executar o SQL de 20261111141500.
-- Em bancos novos, a versão original já criou a estrutura. A segunda versão
-- verifica o resultado sem repetir a criação, conceder acesso ou criar contas.
do $$
begin
  if (select count(*) from pg_class where relnamespace = 'public'::regnamespace
        and relname in ('workspaces','perfis','equipes','equipe_membros','permissoes_papel','auditoria')
        and relkind = 'r' and relrowsecurity and relforcerowsecurity) <> 6
     or to_regclass('nexa_privado.autorizacao_inicial') is null
     or to_regprocedure('nexa_privado.ativar_inicial(uuid)') is null then
    raise exception 'A estrutura de acesso 1A precisa estar aplicada antes deste marco.';
  end if;
end;
$$;
