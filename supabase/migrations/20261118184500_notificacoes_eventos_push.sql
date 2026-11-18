-- Notificações reais do Workspace: por pessoa e com push assinado.
-- Não altera nem apaga cadastros existentes.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.eventos_notificacao (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  perfil_id uuid not null,
  chave text not null check (length(chave) between 1 and 240),
  tipo text not null check (tipo in ('mensagem','lead','tarefa','movimentacao','financeiro','documento')),
  titulo text not null check (length(titulo) between 1 and 160),
  detalhe text not null check (length(detalhe) <= 300),
  rota text not null check (left(rota,1)='/' and left(rota,2)<>'//' and length(rota)<=320),
  criado_em timestamptz not null default now(),
  lida_em timestamptz,
  foreign key (workspace_id,perfil_id) references public.perfis(workspace_id,id) on delete cascade,
  unique (workspace_id,perfil_id,chave)
);
create index eventos_notificacao_perfil on public.eventos_notificacao(perfil_id,criado_em desc);
alter table public.eventos_notificacao enable row level security;
alter table public.eventos_notificacao force row level security;
revoke all on public.eventos_notificacao from public,anon,authenticated,service_role;
grant select,update(lida_em) on public.eventos_notificacao to authenticated;
create policy eventos_notificacao_ler on public.eventos_notificacao
 for select to authenticated
 using (perfil_id=(select auth.uid()) and workspace_id=(select public.workspace_id_atual()));
create policy eventos_notificacao_marcar on public.eventos_notificacao
 for update to authenticated
 using (perfil_id=(select auth.uid()) and workspace_id=(select public.workspace_id_atual()))
 with check (perfil_id=(select auth.uid()) and workspace_id=(select public.workspace_id_atual()));

-- Nenhum usuário do app pode escolher destinatários ou forjar avisos.
create function nexa_privado.emitir_notificacao(
 ws uuid, ator uuid, modulo public.modulo, tipo_ text,
 chave_ text, titulo_ text, detalhe_ text, rota_ text, incluir_ator boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.eventos_notificacao(workspace_id,perfil_id,chave,tipo,titulo,detalhe,rota)
 select ws,p.id,left(chave_,240),tipo_,left(titulo_,160),left(detalhe_,300),left(rota_,320)
 from public.perfis p
 where p.workspace_id=ws and p.ativo
   and (incluir_ator or p.id is distinct from ator)
   and exists (
     select 1 from public.permissoes_papel pe
     where pe.papel=p.papel and pe.modulo=modulo and pe.acao='ler'
   )
 on conflict(workspace_id,perfil_id,chave) do nothing;
end $$;
revoke all on function nexa_privado.emitir_notificacao(uuid,uuid,public.modulo,text,text,text,text,text,boolean)
 from public,anon,authenticated,service_role;

-- A transação de salvar um lead/conversa/projeto é a fonte autoritativa.
-- O trigger não confia em chamadas de notificação feitas pelo navegador.
create function nexa_privado.notificar_registro()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 antigo jsonb := '{}'::jsonb;
 c jsonb := new.conteudo;
 msg jsonb;
 task jsonb;
 velho jsonb;
 roteador text;
 ator uuid := auth.uid();
 chave_evento text;
begin
 if tg_op='UPDATE' then antigo := coalesce(old.conteudo,'{}'::jsonb); end if;
 if c is null then return new; end if;
 if tg_op='UPDATE' and old.conteudo is not distinct from c then return new; end if;

 if new.colecao='leads' then
   roteador := '/crm?lead='||pg_catalog.regexp_replace(new.id,'[^A-Za-z0-9_-]','','g');
   if tg_op='INSERT' or (tg_op='UPDATE' and old.conteudo is null) then
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'leads','lead',
       'lead:'||new.id||':'||new.versao,'Novo lead cadastrado',
       left(coalesce(c->>'empresa','Um cliente foi cadastrado'),180),roteador);
   elsif (c->>'responsavel') is distinct from (antigo->>'responsavel') then
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'leads','lead',
       'lead-responsavel:'||new.id||':'||new.versao,'Responsável de lead alterado',
       left(coalesce(c->>'empresa','Lead'),180),roteador);
   end if;
   if (c->>'etapa') is distinct from (antigo->>'etapa') and tg_op='UPDATE' then
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'leads','movimentacao',
       'lead-etapa:'||new.id||':'||new.versao,'Lead mudou de etapa',
       left(coalesce(c->>'empresa','Lead')||' · '||coalesce(c->>'etapa','sem etapa'),180),roteador);
   end if;
   if (c->'pagamento') is distinct from (antigo->'pagamento')
       and tg_op='UPDATE' then
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'leads','financeiro',
       'lead-pagamento:'||new.id||':'||new.versao,'Pagamento atualizado',
       left(coalesce(c->>'empresa','Lead'),180),'/recebimentos');
   end if;
 elsif new.colecao='conversas' and jsonb_typeof(c->'mensagens')='array' then
   roteador := '/conversas?lead='||pg_catalog.regexp_replace(coalesce(c->>'leadId',''),'[^A-Za-z0-9_-]','','g');
   for msg in select value from jsonb_array_elements(c->'mensagens') value
     where jsonb_typeof(value)='object'
       and not exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(antigo->'mensagens')='array' then antigo->'mensagens' else '[]'::jsonb end
         ) anterior where anterior->>'id'=value->>'id')
     order by value->>'em' desc limit 12
   loop
     chave_evento := 'mensagem:'||new.id||':'||coalesce(msg->>'id',new.versao::text);
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'conversas','mensagem',
       chave_evento,'Nova mensagem',
       case when msg->>'de'='cliente' then 'Mensagem recebida no atendimento'
            else 'A equipe enviou uma mensagem' end,
       roteador,msg->>'de'='cliente');
   end loop;
 elsif new.colecao='projetos' then
   roteador := '/kanban?projeto='||pg_catalog.regexp_replace(new.id,'[^A-Za-z0-9_-]','','g');
   if tg_op='UPDATE' and (c->>'etapa') is distinct from (antigo->>'etapa') then
     perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'projetos','movimentacao',
       'projeto-etapa:'||new.id||':'||new.versao,'Projeto mudou de etapa',
       left(coalesce(c->>'cliente','Projeto')||' · '||coalesce(c->>'etapa','sem etapa'),180),roteador);
   end if;
   if jsonb_typeof(c->'tarefasProjeto')='array' then
     for task in select value from jsonb_array_elements(c->'tarefasProjeto') value
       where jsonb_typeof(value)='object'
     loop
       select value into velho from jsonb_array_elements(
         case when jsonb_typeof(antigo->'tarefasProjeto')='array' then antigo->'tarefasProjeto' else '[]'::jsonb end
       ) value where value->>'id'=task->>'id' limit 1;
       if velho is null then
         perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'projetos','tarefa',
           'tarefa:'||new.id||':'||coalesce(task->>'id',new.versao::text),
           'Nova tarefa no projeto',left(coalesce(task->>'titulo','Tarefa adicionada'),180),
           roteador||'&aba=tarefas');
       elsif (task->>'responsavel') is distinct from (velho->>'responsavel') then
         perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'projetos','tarefa',
           'tarefa-responsavel:'||new.id||':'||coalesce(task->>'id','')||':'||new.versao,
           'Responsável da tarefa alterado',left(coalesce(task->>'titulo','Tarefa'),180),
           roteador||'&aba=tarefas');
       end if;
       velho := null;
     end loop;
   end if;
 elsif new.colecao='documentos' and (tg_op='INSERT' or (tg_op='UPDATE' and old.conteudo is null)) then
   perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'documentos','documento',
     'documento:'||new.id||':'||new.versao,'Novo documento cadastrado',
     'Um documento foi adicionado ao Workspace','/documentos');
 elsif new.colecao='vendas' and (tg_op='INSERT' or (tg_op='UPDATE' and old.conteudo is null)) then
   perform nexa_privado.emitir_notificacao(new.workspace_id,ator,'vendas','financeiro',
     'venda:'||new.id||':'||new.versao,'Nova venda registrada',
     'Uma venda foi adicionada ao Workspace','/recebimentos');
 end if;
 return new;
end $$;
revoke all on function nexa_privado.notificar_registro() from public,anon,authenticated,service_role;
create trigger nexa_notificacoes_registros after insert or update of conteudo on public.registros_workspace
 for each row execute function nexa_privado.notificar_registro();

-- Configuração do destino de push. Segredo é inserido fora do repositório,
-- depois de validar o endpoint HTTPS na Vercel.
create table nexa_privado.config_push (
 unica boolean primary key default true check(unica),
 webhook_url text not null,
 segredo text not null check(length(segredo)>=48)
);
revoke all on nexa_privado.config_push from public,anon,authenticated,service_role;
alter table nexa_privado.config_push enable row level security;

-- O corpo inclui somente os dados do aviso e a inscrição do destinatário.
-- A assinatura HMAC não revela o segredo e expira em 120 segundos.
create function nexa_privado.enfileirar_push() returns trigger
language plpgsql security definer set search_path='' as $$
declare conf record; disp record; tstamp bigint; sig text;
begin
 select webhook_url,segredo into conf from nexa_privado.config_push where unica;
 if conf.webhook_url is null then return new; end if;
 tstamp:=extract(epoch from clock_timestamp())::bigint;
 for disp in
   select endpoint,chaves from public.dispositivos_push
   where workspace_id=new.workspace_id and perfil_id=new.perfil_id
     and (filtro is null or filtro='todos' or filtro=new.tipo)
 loop
   sig:=pg_catalog.encode(extensions.hmac(
     pg_catalog.convert_to(new.id::text||'.'||disp.endpoint||'.'||tstamp::text,'UTF8'),
     pg_catalog.convert_to(conf.segredo,'UTF8'),'sha256'),'hex');
   perform net.http_post(
     url:=conf.webhook_url,
     body:=pg_catalog.jsonb_build_object(
       'id',new.id,'endpoint',disp.endpoint,'keys',disp.chaves,
       'titulo',new.titulo,'corpo',new.detalhe,'url',new.rota,'tag',new.chave),
     headers:=pg_catalog.jsonb_build_object(
       'Content-Type','application/json','x-nexa-ts',tstamp::text,'x-nexa-sig',sig),
     timeout_milliseconds:=5000
   );
 end loop;
 return new;
end $$;
revoke all on function nexa_privado.enfileirar_push() from public,anon,authenticated,service_role;
create trigger nexa_push_evento after insert on public.eventos_notificacao
 for each row execute function nexa_privado.enfileirar_push();

-- Alertas importantes de tarefas que vencem hoje ou amanhã.
create function nexa_privado.avisar_prazos_tarefas() returns void
language plpgsql security definer set search_path='' as $$
declare r record; item jsonb; hoje date := (now() at time zone 'America/Sao_Paulo')::date; venc date;
begin
 for r in select workspace_id,id,conteudo from public.registros_workspace
   where colecao='projetos' and conteudo is not null
     and jsonb_typeof(conteudo->'tarefasProjeto')='array'
 loop
   for item in select value from jsonb_array_elements(r.conteudo->'tarefasProjeto') value
   loop
     if item->>'situacao'='concluida' or coalesce(item->>'prazo','') !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
     begin venc := (item->>'prazo')::date; exception when others then continue; end;
     if venc between hoje and hoje+1 then
       perform nexa_privado.emitir_notificacao(r.workspace_id,null,'projetos','tarefa',
         'prazo:'||r.id||':'||coalesce(item->>'id','')||':'||venc::text,
         case when venc=hoje then 'Tarefa vence hoje' else 'Tarefa vence amanhã' end,
         left(coalesce(item->>'titulo','Confira a tarefa'),180),
         '/kanban?projeto='||pg_catalog.regexp_replace(r.id,'[^A-Za-z0-9_-]','','g')||'&aba=tarefas',true);
     end if;
   end loop;
 end loop;
end $$;
revoke all on function nexa_privado.avisar_prazos_tarefas() from public,anon,authenticated,service_role;
select cron.schedule('nexa-prazos-tarefas','0 12 * * *','select nexa_privado.avisar_prazos_tarefas();');

-- Publica novos avisos em tempo quase real; a consulta continua protegida por RLS.
alter publication supabase_realtime add table public.eventos_notificacao;
