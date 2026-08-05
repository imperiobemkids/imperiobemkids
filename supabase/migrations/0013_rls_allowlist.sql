-- CORRECAO DE SEGURANCA (critica).
--
-- Problema encontrado na auditoria:
-- o cadastro publico do Supabase esta LIGADO (disable_signup: false) e as politicas
-- liberavam tudo para qualquer usuario "authenticated". Ou seja: qualquer pessoa com
-- um e-mail valido podia se cadastrar, confirmar e ler/gravar todo o ERP
-- (estoque, vendas, financeiro), usando a chave publica que fica visivel no site.
--
-- Correcao: acesso passa a exigir estar na lista de administradores, nao basta
-- estar logado. Quem se cadastrar sozinho fica autenticado, porem sem nenhum dado.
-- Idempotente. Rodar no SQL Editor.

create table if not exists ibk_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  created_at timestamptz not null default now()
);

alter table ibk_admins enable row level security;
drop policy if exists admins_leem on ibk_admins;
-- cada um enxerga apenas o proprio registro; ninguem se inclui pelo app
create policy admins_leem on ibk_admins for select to authenticated using (user_id = auth.uid());

-- Quem ja tem conta hoje e legitimo (foi criado a mao pelo Richard): vira admin.
insert into ibk_admins (user_id, nome)
select id, coalesce(raw_user_meta_data->>'name', email) from auth.users
on conflict (user_id) do nothing;

-- Funcao usada pelas politicas
create or replace function ibk_e_admin() returns boolean
language sql security definer stable
set search_path = public
as $$ select exists (select 1 from ibk_admins where user_id = auth.uid()) $$;

-- Todas as tabelas do ERP passam a exigir admin
do $$
declare t text;
begin
  foreach t in array array[
    'ibk_fornecedores','ibk_lotes','ibk_lote_itens','ibk_produtos',
    'ibk_insumos','ibk_vendas','ibk_venda_itens','ibk_movimentos',
    'ibk_estoque_mov','ibk_canais'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists admin_all on %I;', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());', t
    );
  end loop;
end $$;

-- Para adicionar um socio depois: crie o usuario em Authentication > Users e rode
--   insert into ibk_admins (user_id, nome)
--   select id, 'Nome do socio' from auth.users where email = 'email@dele.com';
