-- Devolucoes: marcar uma venda como devolvida, com o custo que a devolucao gera.
-- Na Shopee a devolucao traz frete reverso e parte da comissao nao volta.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_vendas add column if not exists devolvida boolean not null default false;
alter table ibk_vendas add column if not exists data_devolucao date;
alter table ibk_vendas add column if not exists custo_devolucao numeric not null default 0;
