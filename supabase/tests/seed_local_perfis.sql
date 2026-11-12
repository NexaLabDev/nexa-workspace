-- Liga contas de teste ao workspace local (idempotente). Só no Docker isolado.
update public.perfis set ativo = true where email in ('admin@teste.local','maria@teste.local');

-- Garante papéis conhecidos
update public.perfis set papel = 'administrador', nome = 'Admin Teste', ativo = true
where email = 'admin@teste.local';

-- Migrar maria legado para gestor@ se existir só maria
update public.perfis set email = 'gestor@teste.local', nome = 'Gestor Teste', papel = 'gestor', ativo = true
where email = 'maria@teste.local'
  and not exists (select 1 from public.perfis where email = 'gestor@teste.local');

insert into public.perfis (id, workspace_id, email, nome, papel, ativo)
select u.id, w.id, u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email,'@',1)), v.papel, true
from auth.users u
cross join public.workspaces w
join (values
  ('admin@teste.local'::text, 'administrador'::papel),
  ('gestor@teste.local', 'gestor'),
  ('colab@teste.local', 'colaborador'),
  ('viewer@teste.local', 'visualizador')
) as v(email, papel) on v.email = u.email
on conflict (id) do update
set workspace_id = excluded.workspace_id,
    email = excluded.email,
    nome = excluded.nome,
    papel = excluded.papel,
    ativo = true;

-- Intruso permanece sem perfil/workspace
delete from public.perfis where email = 'intruso@teste.local';

select email, papel, ativo from public.perfis order by email;
