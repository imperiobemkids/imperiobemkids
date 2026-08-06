-- Preco por item da venda (antes o preco ficava so no total, entao vender dois
-- produtos diferentes na mesma venda nao registrava quanto foi cada um).
-- Idempotente. Rodar no SQL Editor.

alter table ibk_venda_itens add column if not exists preco_unit numeric not null default 0;

alter table ibk_vendas add column if not exists desconto numeric not null default 0;
alter table ibk_vendas add column if not exists cliente text;

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
