-- Cada registro de negócio mantém seu ID e o formato utilizado pelas telas.
-- Parcelas, contatos, tarefas e comentários pertencem ao agregado que os edita.
create function public.modulo_colecao(c text) returns public.modulo language sql immutable set search_path='' as $$
 select case c when 'dias-trabalho' then 'metas' when 'categorias-arquivos' then 'arquivos'
 when 'preferencias' then 'workspace' when 'avisos' then 'workspace'
 when 'metas' then 'metas' when 'prestadora' then 'prestadora' when 'servicos' then 'servicos'
 when 'projetos' then 'projetos' when 'clientes' then 'clientes' when 'leads' then 'leads'
 when 'documentos' then 'documentos' when 'conversas' then 'conversas' when 'vendas' then 'vendas' end::public.modulo
$$;
create table public.registros_workspace (
 workspace_id uuid not null references public.workspaces(id), colecao text not null check(public.modulo_colecao(colecao) is not null),
 id text not null check(length(id) between 1 and 160), conteudo jsonb, ordem bigint not null default 0,
 versao bigint not null default 1, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 primary key(workspace_id,colecao,id),
 check (conteudo is null or pg_column_size(conteudo)<=8388608),
 check (conteudo is null or case when colecao='dias-trabalho' then id='@' and conteudo in ('"seg-sex"','"seg-sab"','"todos"')
 when colecao in ('metas','prestadora','preferencias','avisos') then id='@' and jsonb_typeof(conteudo)='object'
 else jsonb_typeof(conteudo)='object' and conteudo ? 'id' and conteudo->>'id'=id end),
 tipo_lead text generated always as ('leads'::text) stored,
 lead_id text generated always as (case when colecao in ('projetos','vendas','documentos','conversas') then nullif(conteudo->>'leadId','') end) stored,
 tipo_cliente text generated always as ('clientes'::text) stored,
 cliente_id text generated always as (case when colecao in ('projetos','vendas','leads') then nullif(conteudo->>'clienteId','') end) stored,
 foreign key(workspace_id,tipo_lead,lead_id) references public.registros_workspace(workspace_id,colecao,id) deferrable initially deferred,
 foreign key(workspace_id,tipo_cliente,cliente_id) references public.registros_workspace(workspace_id,colecao,id) deferrable initially deferred
);
create index registros_lead on public.registros_workspace(workspace_id,tipo_lead,lead_id) where lead_id is not null;
create index registros_cliente on public.registros_workspace(workspace_id,tipo_cliente,cliente_id) where cliente_id is not null;
create unique index projetos_codigo_publico on public.registros_workspace((conteudo->>'codigoPublico')) where colecao='projetos' and conteudo->>'codigoPublico' is not null;
alter table public.registros_workspace enable row level security;
alter table public.registros_workspace force row level security;
revoke all on public.registros_workspace from public,anon,authenticated,service_role;
grant select on public.registros_workspace to authenticated;
create policy registros_ler on public.registros_workspace for select to authenticated using(workspace_id=(select public.workspace_id_atual()) and public.pode(public.modulo_colecao(colecao),'ler'));

create function nexa_privado.gravar_registros(p_workspace uuid,p_usuario uuid,p_mudancas jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare m jsonb; r public.registros_workspace%rowtype; c text; chave text; v bigint; novo jsonb; pos bigint; ac public.acao; campos text[]; papel_ator public.papel;
begin
 if auth.uid() is distinct from p_usuario or p_usuario is null then raise insufficient_privilege; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 select p.papel into strict papel_ator from public.perfis p where p.id=auth.uid() and p.ativo and p.workspace_id=p_workspace for share;
 if jsonb_typeof(p_mudancas) is distinct from 'array' or jsonb_array_length(p_mudancas)>10000 then raise exception 'Lote inválido'; end if;
 for m in select value from jsonb_array_elements(p_mudancas) loop
  c:=m->>'colecao'; chave:=m->>'id'; v:=(m->>'versao')::bigint; novo:=nullif(m->'conteudo','null'::jsonb); pos:=(m->>'ordem')::bigint;
  if v is null or v<0 or pos is null or not(m?'conteudo') then raise exception 'Registro inválido'; end if;
  select * into r from public.registros_workspace where workspace_id=p_workspace and colecao=c and id=chave;
  ac:=case when novo is null then 'excluir' when r.conteudo is null then 'criar' else 'editar' end;
  if c in ('avisos','preferencias','dias-trabalho','metas','prestadora') then ac:='editar'; end if;
  if not exists(select from public.permissoes_papel p where p.papel=papel_ator and p.modulo=public.modulo_colecao(c) and p.acao=ac) then raise insufficient_privilege; end if;
  if r.versao is not null and r.conteudo is not distinct from novo and r.ordem=pos then continue; end if;
  if coalesce(r.versao,0)<>v then raise exception 'Registro alterado em outra sessão: %/%',c,chave using errcode='40001'; end if;
  insert into public.registros_workspace(workspace_id,colecao,id,conteudo,ordem) values(p_workspace,c,chave,novo,pos)
   on conflict(workspace_id,colecao,id) do update set conteudo=excluded.conteudo,ordem=excluded.ordem,versao=public.registros_workspace.versao+1,atualizado_em=clock_timestamp();
  select array_agg(k order by k) into campos from unnest(array['etapa','responsavel','valor','pagamento','parcelas','tarefasProjeto','documentos','mensagens','status','ativo','codigoPublico']) k where (r.conteudo->k) is distinct from (novo->k);
  insert into public.auditoria(workspace_id,perfil_id,origem,tabela,registro_id,acao,campos)
   values(p_workspace,auth.uid(),'authenticated',replace(c,'-','_'),chave,case when novo is null then 'excluir' when r.conteudo is null then 'criar' else 'editar' end,coalesce(campos,array['conteudo']));
 end loop;
end $$;
create function public.gravar_registros(p_workspace uuid,p_usuario uuid,p_mudancas jsonb) returns void language sql security invoker set search_path='' as $$select nexa_privado.gravar_registros(p_workspace,p_usuario,p_mudancas)$$;
create function public.ler_registros() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('colecao',colecao,'id',id,'conteudo',conteudo,'ordem',ordem,'versao',versao) order by colecao,ordem,id),'[]'::jsonb) from public.registros_workspace
$$;
create function nexa_privado.acompanhamento(codigo text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object('nome',left(conteudo->>'servico',160),'etapa',conteudo->>'etapa','atualizadoEm',conteudo->>'atualizadoEm','observacao',left(conteudo->>'observacaoPublica',600)))
 || jsonb_build_object('base',case when conteudo->>'modoProgresso'='tarefas' then 'tarefas' else 'fase' end,'progresso',case when conteudo->>'modoProgresso'='tarefas' and coalesce(jsonb_array_length(conteudo->'tarefasProjeto'),0)=0 then null else conteudo->'progresso' end)
 from public.registros_workspace where colecao='projetos' and conteudo->>'codigoPublico'=codigo and codigo ~ '^[A-Za-z0-9_-]{22}$'
$$;
create function public.acompanhamento_projeto(codigo text) returns jsonb language sql stable security invoker set search_path='' as $$select nexa_privado.acompanhamento(codigo)$$;
revoke all on function public.ler_registros(),public.modulo_colecao(text),public.gravar_registros(uuid,uuid,jsonb),nexa_privado.gravar_registros(uuid,uuid,jsonb),public.acompanhamento_projeto(text),nexa_privado.acompanhamento(text) from public,authenticated,anon,service_role;
grant execute on function public.ler_registros(),public.modulo_colecao(text),public.gravar_registros(uuid,uuid,jsonb),nexa_privado.gravar_registros(uuid,uuid,jsonb) to authenticated;
grant usage on schema nexa_privado to anon;
grant execute on function public.acompanhamento_projeto(text),nexa_privado.acompanhamento(text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('nexa-arquivos','nexa-arquivos',false,26214400,array['application/octet-stream']);
create policy nexa_arquivo_ler on storage.objects for select to authenticated using(bucket_id='nexa-arquivos' and (storage.foldername(name))[1]=(select public.workspace_id_atual())::text and (select public.pode('arquivos','ler')));
create policy nexa_arquivo_criar on storage.objects for insert to authenticated with check(bucket_id='nexa-arquivos' and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,160}$' and (storage.foldername(name))[1]=(select public.workspace_id_atual())::text and (select public.pode('arquivos','criar')));
