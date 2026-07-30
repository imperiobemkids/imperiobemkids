-- Seed do 1o lote do Imperio Bem Kids (29/07/2026)
-- Rodar depois da migration 0001. Idempotente o suficiente para 1 execucao.

do $$
declare
  v_forn uuid;
  v_lote uuid;
begin
  -- Fornecedor (nome a confirmar; catalogo ConectaVenda)
  insert into ibk_fornecedores (nome, canal, link)
  values ('ConectaVenda (a confirmar)', 'catalogo',
          'https://app.conectavenda.com.br/84ded64ae69221e961f40003e42468ce')
  returning id into v_forn;

  -- Lote de compra
  insert into ibk_lotes (data, fornecedor_id, descricao)
  values (date '2026-07-29', v_forn, '1o lote de teste (verao + inverno + insumos + impressora)')
  returning id into v_lote;

  -- Itens do lote
  insert into ibk_lote_itens (lote_id, tipo, descricao, qtd, custo_total) values
    (v_lote, 'mercadoria', 'Conjuntos Verao (25 menino + 25 menina)', 50, 745.00),
    (v_lote, 'mercadoria', 'Conjuntos Inverno (11 menino + 12 menina)', 23, 544.18),
    (v_lote, 'insumo', 'Etiquetas de pedido (2 bobinas de 250)', 500, 30.00),
    (v_lote, 'insumo', 'Embalagens (sacos)', 100, 34.00),
    (v_lote, 'capex', 'Impressora de etiquetas', 1, 268.52);

  -- Produtos em estoque (tamanho a preencher; ~2 conjuntos por tamanho)
  insert into ibk_produtos (linha, genero, custo_unit, qtd_inicial, qtd_atual, fornecedor_id, lote_id) values
    ('verao', 'menino', 14.90, 25, 25, v_forn, v_lote),
    ('verao', 'menina', 14.90, 25, 25, v_forn, v_lote),
    ('inverno', 'menino', 23.66, 11, 11, v_forn, v_lote),
    ('inverno', 'menina', 23.66, 12, 12, v_forn, v_lote);

  -- Insumos em estoque
  insert into ibk_insumos (nome, qtd_atual, custo_unit) values
    ('Etiqueta de pedido', 500, 0.06),
    ('Saco de embalagem', 100, 0.34);

  -- Movimentos de caixa (saidas do 1o lote)
  insert into ibk_movimentos (data, tipo, categoria, valor, descricao, ref_lote_id) values
    (date '2026-07-29', 'saida', 'mercadoria', 1289.18, 'Mercadoria 1o lote (verao + inverno)', v_lote),
    (date '2026-07-29', 'saida', 'insumo', 64.00, 'Insumos 1o lote (etiquetas + sacos)', v_lote),
    (date '2026-07-29', 'saida', 'capex', 268.52, 'Impressora de etiquetas', v_lote);
end $$;
