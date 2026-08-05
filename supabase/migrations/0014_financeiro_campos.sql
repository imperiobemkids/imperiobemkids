-- Campos que faltavam no lancamento financeiro.
-- A data ja existia na tabela, mas o formulario nao deixava escolher: tudo caia
-- no dia de hoje, impedindo registrar conta paga em outra data.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_movimentos add column if not exists forma_pagamento text;
alter table ibk_movimentos add column if not exists documento text;   -- nota, recibo, numero do pedido
alter table ibk_movimentos add column if not exists data_pagamento date;

create index if not exists ibk_movimentos_data_idx on ibk_movimentos(data desc);
