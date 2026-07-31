-- Kardex (extrato de movimentacao de estoque) + campos de controle.
-- Padrao de ERP: toda entrada/saida vira uma linha rastreavel, com custo e saldo.
-- Idempotente. Rodar no SQL Editor.

create table if not exists ibk_estoque_mov (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references ibk_produtos(id) on delete cascade,
  data date not null default current_date,
  tipo text not null check (tipo in ('entrada','saida','ajuste','devolucao')),
  origem text not null check (origem in ('compra','venda','ajuste','devolucao','inicial')),
  qtd numeric not null,                -- positivo entra, negativo sai
  custo_unit numeric not null default 0,
  saldo_depois numeric not null default 0,
  custo_medio_depois numeric not null default 0,
  ref_lote_id uuid references ibk_lotes(id) on delete set null,
  ref_venda_id uuid references ibk_vendas(id) on delete set null,
  obs text,
  created_at timestamptz not null default now()
);

create index if not exists ibk_estoque_mov_produto_idx on ibk_estoque_mov(produto_id, created_at desc);

-- Codigo do produto e ponto de reposicao por item (hoje o alerta e fixo em 3)
alter table ibk_produtos add column if not exists sku text;
alter table ibk_produtos add column if not exists estoque_minimo int not null default 3;

-- Semente do kardex: para os produtos que ja existem sem historico, cria a linha inicial
insert into ibk_estoque_mov (produto_id, data, tipo, origem, qtd, custo_unit, saldo_depois, custo_medio_depois, obs)
select p.id, coalesce(p.created_at::date, current_date), 'entrada', 'inicial',
       p.qtd_inicial, p.custo_unit, p.qtd_inicial, p.custo_unit, 'saldo inicial do produto'
from ibk_produtos p
where not exists (select 1 from ibk_estoque_mov m where m.produto_id = p.id);
