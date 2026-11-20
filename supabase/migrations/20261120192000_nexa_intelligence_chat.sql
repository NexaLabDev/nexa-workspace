-- Conversas da Nexa Intelligence, isoladas por empresa e pelo próprio administrador.
-- Mensagens ficam no Supabase da Nexa. Somente mensagens enviadas deliberadamente são processadas pela OpenAI.
create table public.nexa_intelligence_chats (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null check(length(btrim(titulo)) between 1 and 120),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index nexa_intelligence_chats_usuario_idx on public.nexa_intelligence_chats(workspace_id,usuario_id,atualizado_em desc);
create table public.nexa_intelligence_chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.nexa_intelligence_chats(id) on delete cascade,
  papel text not null check(papel in ('usuario','assistente')),
  texto text not null check(length(btrim(texto)) between 1 and 18000),
  criado_em timestamptz not null default now()
);
create index nexa_intelligence_chat_mensagens_chat_idx on public.nexa_intelligence_chat_mensagens(chat_id,criado_em,id);
alter table public.nexa_intelligence_chats enable row level security;
alter table public.nexa_intelligence_chats force row level security;
alter table public.nexa_intelligence_chat_mensagens enable row level security;
alter table public.nexa_intelligence_chat_mensagens force row level security;
revoke all on public.nexa_intelligence_chats,public.nexa_intelligence_chat_mensagens from public,anon,authenticated;
grant select,insert,update,delete on public.nexa_intelligence_chats to authenticated;
grant select,insert on public.nexa_intelligence_chat_mensagens to authenticated;
create policy nexa_intelligence_chats_admin on public.nexa_intelligence_chats
for all to authenticated
using (
  workspace_id=(select public.workspace_id_atual()) and
  usuario_id=(select auth.uid()) and
  (select public.pode('workspace','editar'))
)
with check (
  workspace_id=(select public.workspace_id_atual()) and
  usuario_id=(select auth.uid()) and
  (select public.pode('workspace','editar'))
);
create policy nexa_intelligence_mensagens_ler on public.nexa_intelligence_chat_mensagens
for select to authenticated using (
  exists (select 1 from public.nexa_intelligence_chats c
    where c.id=chat_id and c.workspace_id=(select public.workspace_id_atual())
    and c.usuario_id=(select auth.uid()) and (select public.pode('workspace','editar')))
);
create policy nexa_intelligence_mensagens_criar on public.nexa_intelligence_chat_mensagens
for insert to authenticated with check (
  exists (select 1 from public.nexa_intelligence_chats c
    where c.id=chat_id and c.workspace_id=(select public.workspace_id_atual())
    and c.usuario_id=(select auth.uid()) and (select public.pode('workspace','editar')))
);
