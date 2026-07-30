-- FASE 4: trava de seguranca antes do deploy.
-- Re-liga o RLS e libera acesso somente para usuarios AUTENTICADOS.
-- Anon (chave publica exposta no site) nao le nem grava nada.
-- Rodar no SQL Editor do Supabase. Substitui o 0002 (dev off).

do $$
declare t text;
begin
  foreach t in array array[
    'ibk_fornecedores','ibk_lotes','ibk_lote_itens','ibk_produtos',
    'ibk_insumos','ibk_vendas','ibk_venda_itens','ibk_movimentos'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists admin_all on %I;', t);
    -- authenticated pode tudo; anon nao entra em nenhuma policy, entao fica bloqueado
    execute format(
      'create policy admin_all on %I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;
