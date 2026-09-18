-- Correcao do indice de ibk_produto_canais (migration 0021).
--
-- O indice unico (canal, id_anuncio, coalesce(id_variacao,'')) impedia salvar
-- os codigos de um produto com variacoes: o pai e cada variacao carregam o
-- MESMO id_anuncio (e o anuncio da plataforma) e o pai nao tem id_variacao,
-- entao duas linhas colidiam e o "salvar codigos" falhava sempre.
--
-- O que precisa ser unico dentro do canal e o id da variacao e o SKU do
-- anuncio, que sao o que a importacao usa para achar o produto.
-- Idempotente.

drop index if exists ibk_produto_canais_codigo_uq;

create unique index if not exists ibk_produto_canais_variacao_uq
  on ibk_produto_canais (canal_id, id_variacao) where id_variacao is not null;

create unique index if not exists ibk_produto_canais_sku_uq
  on ibk_produto_canais (canal_id, lower(sku_canal)) where sku_canal is not null;
