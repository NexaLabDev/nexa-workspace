-- Executar com psql -X -v ON_ERROR_STOP=1 apenas em banco de teste descartável.
-- Fixtures sintéticas. Uma transação. Nenhuma dependência de pgTAP.
begin;
create function pg_temp.confere(ok boolean, detalhe text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falhou: %', detalhe; end if;
end; $$;
create function pg_temp.bloqueado(comando text, estado text) returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    if sqlstate = estado then return; end if;
    raise;
  end;
  raise exception 'Esperava SQLSTATE % para %', estado, comando;
end; $$;

-- Sete contas confirmadas e uma pendente. Metadados editáveis não concedem acesso.
insert into auth.users (id, email, email_confirmed_at, is_anonymous, raw_user_meta_data)
select ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       'conta' || i || '@example.invalid', case when i < 8 then now() end, false,
       '{"papel":"administrador"}'::jsonb
from generate_series(1,8) as s(i);
select pg_temp.confere(not exists(select from public.workspaces) and not exists(select from public.perfis), 'cadastro isolado');
insert into nexa_privado.autorizacao_inicial(email) values ('conta1@example.invalid');
select pg_temp.bloqueado($q$select nexa_privado.ativar_inicial('10000000-0000-0000-0000-000000000007')$q$, 'P0002');
select set_config('teste.ws', nexa_privado.ativar_inicial('10000000-0000-0000-0000-000000000001')::text,true);
select pg_temp.bloqueado($q$select nexa_privado.ativar_inicial('10000000-0000-0000-0000-000000000001')$q$, '23514');
select pg_temp.bloqueado($q$select nexa_privado.associar_visualizador(current_setting('teste.ws')::uuid,'10000000-0000-0000-0000-000000000008','conta8@example.invalid')$q$, 'P0002');
select nexa_privado.associar_visualizador(current_setting('teste.ws')::uuid, id, email) from auth.users where email in ('conta2@example.invalid','conta3@example.invalid','conta4@example.invalid');
update public.perfis set papel = 'gestor' where email = 'conta2@example.invalid';
update public.perfis set papel = 'colaborador' where email = 'conta3@example.invalid';

-- Segundo workspace, sem reutilizar a autorização inicial.
insert into public.workspaces (id,nome) values ('20000000-0000-0000-0000-000000000001','Outra organização');
select nexa_privado.associar_visualizador('20000000-0000-0000-0000-000000000001',id,email) from auth.users where email = 'conta5@example.invalid';
update public.perfis set papel = 'administrador' where email = 'conta5@example.invalid';
set constraints all immediate;
select pg_temp.bloqueado($q$update public.perfis set ativo=false where email='conta1@example.invalid'$q$, '23514');
select pg_temp.bloqueado($q$delete from auth.users where email='conta1@example.invalid'$q$, '23514');
select pg_temp.bloqueado($q$update auth.users set banned_until=now()+interval '1 day' where email='conta1@example.invalid'$q$, '23514');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.confere(public.papel_atual()='administrador' and (select count(*)=1 from public.workspaces), 'admin e isolamento');
select pg_temp.confere((select count(*)=4 from public.perfis), 'perfis do workspace');
update public.workspaces set nome='Organização de teste' where id=public.workspace_id_atual();
with equipe as (insert into public.equipes(nome) values ('Equipe teste') returning id)
select set_config('teste.equipe',id::text,true) from equipe;
insert into public.equipe_membros(equipe_id,perfil_id) values (current_setting('teste.equipe')::uuid,'10000000-0000-0000-0000-000000000003');
select pg_temp.bloqueado($q$insert into public.equipe_membros(equipe_id,perfil_id) values(current_setting('teste.equipe')::uuid,'10000000-0000-0000-0000-000000000005')$q$,'23503');
select pg_temp.confere(exists(select from public.auditoria where tabela='equipe_membros' and acao='criar' and perfil_id=auth.uid() and em is not null), 'autoria autenticada');
select pg_temp.bloqueado($q$update public.workspaces set admins_ativos=123$q$, '42501');
select pg_temp.bloqueado($q$update public.perfis set workspace_id='20000000-0000-0000-0000-000000000001'$q$, '42501');
select pg_temp.bloqueado($q$insert into public.auditoria default values$q$, '42501');
select pg_temp.bloqueado($q$delete from public.auditoria$q$, '42501');
select pg_temp.bloqueado($q$update public.auditoria set em=now()$q$, '42501');
select pg_temp.bloqueado($q$truncate public.auditoria$q$, '42501');
select pg_temp.bloqueado($q$update public.permissoes_papel set papel='administrador'$q$, '42501');
select pg_temp.bloqueado($q$select nexa_privado.ativar_inicial('10000000-0000-0000-0000-000000000001')$q$, '42501');
select pg_temp.bloqueado($q$select * from nexa_privado.autorizacao_inicial$q$, '42501');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.confere(public.pode('equipes','criar') and not public.pode('workspace','editar') and not exists(select from public.auditoria),'gestor');
select pg_temp.bloqueado($q$update public.perfis set papel='administrador' where id=auth.uid()$q$, '42501');
select pg_temp.bloqueado($q$update public.perfis set ativo=false where papel='administrador'$q$, '42501');
select pg_temp.bloqueado($q$update public.perfis set papel='gestor' where papel='visualizador'$q$, '42501');
update public.perfis set papel='colaborador' where email='conta4@example.invalid';
select pg_temp.confere(exists(select from public.perfis where email='conta4@example.invalid' and papel='colaborador'), 'gestor altera papel inferior');
update public.perfis set papel='visualizador' where email='conta4@example.invalid';
update public.equipes set nome='Novo nome';
delete from public.equipe_membros where equipe_id=current_setting('teste.equipe')::uuid;
delete from public.equipes where id=current_setting('teste.equipe')::uuid;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.confere(public.pode('leads','editar') and not public.pode('equipes','criar') and not exists(select from public.auditoria),'colaborador');
select pg_temp.bloqueado($q$insert into public.equipes(nome) values ('Indevida')$q$, '42501');
select pg_temp.bloqueado($q$update public.perfis set papel='gestor' where id=auth.uid()$q$, '42501');
with afetados as (update public.perfis set nome='Indevido' where papel='administrador' returning id)
select pg_temp.confere((select count(*)=0 from afetados),'colaborador não edita terceiros');
update public.perfis set nome='Nome privado', cargo='Cargo privado' where id=auth.uid();

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.confere(public.pode('leads','ler') and not public.pode('leads','editar') and not exists(select from public.auditoria),'visualizador');
select pg_temp.bloqueado($q$insert into public.equipes(nome) values ('Indevida')$q$, '42501');
select pg_temp.bloqueado($q$update public.perfis set ativo=false where id=auth.uid()$q$, '42501');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
select pg_temp.confere((select count(*)=1 from public.perfis) and not exists(select from public.auditoria where workspace_id=current_setting('teste.ws')::uuid),'segundo administrador isolado');
with afetados as (update public.workspaces set nome='Indevido' where id=current_setting('teste.ws')::uuid returning id)
select pg_temp.confere((select count(*)=0 from afetados),'escrita entre workspaces');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000007',true);
select pg_temp.confere(public.workspace_id_atual() is null and not public.pode('leads','ler') and not exists(select from public.perfis) and not exists(select from public.permissoes_papel),'sem vínculo');

reset role;
select set_config('request.jwt.claim.sub','',true);
update auth.users set email='atualizado@example.invalid' where email='conta4@example.invalid';
update auth.users set banned_until=now()+interval '1 day' where email='atualizado@example.invalid';
select pg_temp.confere(exists(select from public.perfis where email='atualizado@example.invalid' and not ativo),'sincronização e bloqueio Auth');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.confere(public.papel_atual() is null and not exists(select from public.workspaces),'sessão após suspensão');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.confere(exists(select from public.auditoria where tabela='perfis' and acao='editar' and antes->>'papel'='visualizador' and depois->>'papel'='colaborador' and perfil_id='10000000-0000-0000-0000-000000000002'),'alterações de papel');
select pg_temp.confere(not exists(select from public.auditoria where concat(antes,depois) ~* 'example.invalid|Nome privado|Cargo privado'),'minimização');
select pg_temp.confere(exists(select from public.auditoria where campos @> array['nome','cargo'] and perfil_id='10000000-0000-0000-0000-000000000003'),'campos editados');
select pg_temp.confere(exists(select from public.auditoria where tabela='equipes' and acao='excluir' and perfil_id='10000000-0000-0000-0000-000000000002'),'remoção auditada');
set local role anon;
select pg_temp.bloqueado('select * from public.workspaces','42501');
select pg_temp.bloqueado('select public.workspace_id_atual()','42501');
reset role;
rollback;
