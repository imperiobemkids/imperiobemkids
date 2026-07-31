-- Conciliacao de repasse: comparar o que a plataforma deveria pagar com o que caiu na conta.
-- E onde a margem some sem o vendedor perceber (comissao a mais, frete debitado,
-- campanha, estorno, ajuste que nao aparece ligado ao pedido).
-- Idempotente. Rodar no SQL Editor.

alter table ibk_vendas add column if not exists recebido numeric;          -- null = ainda nao caiu
alter table ibk_vendas add column if not exists data_recebimento date;
alter table ibk_vendas add column if not exists obs_conciliacao text;

create index if not exists ibk_vendas_recebido_idx on ibk_vendas(recebido);
