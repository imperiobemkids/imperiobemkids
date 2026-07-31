-- Adiciona a categoria "ads" (Shopee Ads e outros anuncios) aos movimentos de caixa.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_movimentos drop constraint if exists ibk_movimentos_categoria_check;

alter table ibk_movimentos add constraint ibk_movimentos_categoria_check
  check (categoria in ('mercadoria','insumo','capex','venda','taxa_shopee','frete','ads','outro'));
