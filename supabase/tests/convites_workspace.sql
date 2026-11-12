-- Validação não destrutiva da Entrega 1B.
-- Pré-requisito: entrega 1A/1B aplicadas e uma conta administradora ativa.
-- Não envia e-mails, não cria usuários e reverte todos os convites de teste.
-- Execute com um operador SQL do projeto: psql -X -v ON_ERROR_STOP=1 -f supabase/tests/convites_workspace.sql

begin;

select set_config('request.jwt.claim.sub',
  (select id::text from public.perfis where papel = 'administrador' and ativo order by criado_em limit 1), true);
set local role authenticated;

insert into public.convites_workspace(email)
values ('validacao-1b@example.invalid');

do $$
begin
  if (select count(*) from public.convites_workspace where email = 'validacao-1b@example.invalid') <> 1 then
    raise exception '1B: administrador nao consegue criar e ler convite';
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000987', true);
set local role authenticated;

do $$
declare
  foi_negado boolean := false;
begin
  if exists (select 1 from public.perfis) then
    raise exception '1B: conta sem vinculo conseguiu ler perfis';
  end if;
  if exists (select 1 from public.convites_workspace) then
    raise exception '1B: conta sem vinculo conseguiu ler convites';
  end if;
  if public.aceitar_convite_workspace('11111111-1111-4111-8111-111111111111'::uuid) is not null then
    raise exception '1B: convite inexistente foi aceito';
  end if;

  begin
    insert into public.convites_workspace(email) values ('intruso-1b@example.invalid');
  exception when insufficient_privilege then
    foi_negado := true;
  end;

  if not foi_negado then
    raise exception '1B: conta sem vinculo conseguiu criar convite';
  end if;
end
$$;

rollback;
select '1B: permissoes dos convites verificadas, sem dados de teste persistentes' as resultado;
