-- TRAVA DE SEGURANCA (rodar antes de publicar o site).
-- Substitui a 0002 (que desligava o RLS para desenvolvimento) e completa a 0003,
-- incluindo a tabela nova do kardex (ibk_estoque_mov).
--
-- Depois de rodar, a chave publica sozinha NAO le nem grava nada:
-- so quem estiver autenticado (login do portal) acessa os dados.
-- Idempotente.

do $$
declare t text;
begin
  foreach t in array array[
    'ibk_fornecedores','ibk_lotes','ibk_lote_itens','ibk_produtos',
    'ibk_insumos','ibk_vendas','ibk_venda_itens','ibk_movimentos','ibk_estoque_mov'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists admin_all on %I;', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;
