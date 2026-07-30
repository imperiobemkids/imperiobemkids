-- Imperio Bem Kids: sistema de gestao (estoque, fornecedores, compras, vendas, financeiro)
-- Rodar no projeto Supabase DEDICADO do Imperio.
-- Convencao: prefixo ibk_ para nao colidir com nada.

-- Fornecedores
create table if not exists ibk_fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  canal text,
  link text,
  obs text,
  created_at timestamptz not null default now()
);

-- Lotes de compra
create table if not exists ibk_lotes (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  fornecedor_id uuid references ibk_fornecedores(id) on delete set null,
  descricao text,
  obs text,
  created_at timestamptz not null default now()
);

-- Itens do lote (mercadoria, insumo ou capex)
create table if not exists ibk_lote_itens (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid references ibk_lotes(id) on delete cascade,
  tipo text not null check (tipo in ('mercadoria','insumo','capex')),
  descricao text not null,
  qtd numeric not null default 1,
  custo_total numeric not null default 0,
  custo_unit numeric generated always as (case when qtd > 0 then custo_total / qtd else 0 end) stored
);

-- Produtos em estoque (SKU)
create table if not exists ibk_produtos (
  id uuid primary key default gen_random_uuid(),
  linha text not null check (linha in ('verao','inverno')),
  genero text not null check (genero in ('menino','menina','unissex')),
  tamanho text,
  descricao text,
  custo_unit numeric not null default 0,
  qtd_inicial int not null default 0,
  qtd_atual int not null default 0,
  foto_url text,
  fornecedor_id uuid references ibk_fornecedores(id) on delete set null,
  lote_id uuid references ibk_lotes(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Insumos (etiquetas, sacos)
create table if not exists ibk_insumos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  qtd_atual numeric not null default 0,
  custo_unit numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Vendas
create table if not exists ibk_vendas (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  canal text not null default 'shopee' check (canal in ('shopee','direto','outro')),
  tipo text not null default 'avulso' check (tipo in ('avulso','kit')),
  preco_venda numeric not null default 0,
  taxa_pct numeric not null default 0.20,
  insumo_custo numeric not null default 0.40,
  frete numeric not null default 0,
  obs text,
  created_at timestamptz not null default now()
);

-- Itens da venda (da baixa no estoque)
create table if not exists ibk_venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references ibk_vendas(id) on delete cascade,
  produto_id uuid references ibk_produtos(id) on delete set null,
  qtd int not null default 1
);

-- Movimentos de caixa (financeiro)
create table if not exists ibk_movimentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  tipo text not null check (tipo in ('entrada','saida')),
  categoria text not null check (categoria in ('mercadoria','insumo','capex','venda','taxa_shopee','frete','outro')),
  valor numeric not null default 0,
  descricao text,
  pago boolean not null default true,
  vencimento date,
  ref_venda_id uuid references ibk_vendas(id) on delete set null,
  ref_lote_id uuid references ibk_lotes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- View de estoque com as somas prontas
-- insumo por pedido fixo em 0.40 (etiqueta + saco); ajustar se mudar.
create or replace view ibk_v_estoque as
select
  p.*,
  (p.custo_unit + 0.40) as custo_posto,
  (p.qtd_atual * p.custo_unit) as valor_estoque,
  case when p.qtd_inicial > 0
       then round((p.qtd_inicial - p.qtd_atual)::numeric / p.qtd_inicial, 4)
       else 0 end as sell_through
from ibk_produtos p;

-- OBS: RLS e Auth entram na fase 4 (login do admin + politicas travadas).
-- Enquanto e so o Richard e o banco e dedicado, seguimos sem RLS no fase 1.
