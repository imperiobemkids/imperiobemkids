-- Registro de venda no formato de caixa.
--
-- Problemas do modelo anterior:
-- 1) o preco ficava so na venda, entao vender dois produtos diferentes nao
--    registrava quanto foi cada um;
-- 2) nao existia forma de pagamento;
-- 3) o campo frete misturava duas coisas: o que o cliente paga (receita) e o
--    que a loja paga (custo).
-- Idempotente. Rodar no SQL Editor.

alter table ibk_venda_itens add column if not exists preco_unit numeric not null default 0;

alter table ibk_vendas add column if not exists desconto numeric not null default 0;
alter table ibk_vendas add column if not exists cliente text;
alter table ibk_vendas add column if not exists forma_pagamento text;
alter table ibk_vendas add column if not exists frete_cobrado numeric not null default 0; -- pago pelo cliente
-- o campo "frete" que ja existia continua sendo o frete PAGO PELA LOJA (custo)

-- Vendas antigas: distribui o preco total entre os itens, para o historico nao zerar
update ibk_venda_itens vi
set preco_unit = sub.unitario
from (
  select vi2.id,
         case when tot.qtd > 0 then v.preco_venda / tot.qtd else 0 end as unitario
  from ibk_venda_itens vi2
  join ibk_vendas v on v.id = vi2.venda_id
  join (select venda_id, sum(qtd) as qtd from ibk_venda_itens group by venda_id) tot
    on tot.venda_id = vi2.venda_id
) sub
where vi.id = sub.id and vi.preco_unit = 0;
