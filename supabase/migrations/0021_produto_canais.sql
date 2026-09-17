-- Codigos do produto em cada canal: o id do anuncio na plataforma (item_id
-- da Shopee, product_id do TikTok Shop), o id da variacao (model_id / sku_id)
-- e o SKU digitado no anuncio. E o que permite bater um pedido importado
-- (planilha do Seller Center) com o produto certo aqui dentro.
--
-- Uma linha por produto (pai ou variacao) e canal. Idempotente.

create table if not exists ibk_produto_canais (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references ibk_produtos(id) on delete cascade,
  canal_id uuid not null references ibk_canais(id) on delete cascade,
  id_anuncio text,
  id_variacao text,
  sku_canal text,
  url text,
  updated_at timestamptz not null default now(),
  unique (produto_id, canal_id)
);

-- o mesmo codigo nao pode apontar para dois produtos no mesmo canal
create unique index if not exists ibk_produto_canais_codigo_uq
  on ibk_produto_canais (canal_id, id_anuncio, coalesce(id_variacao, ''))
  where id_anuncio is not null;

create index if not exists ibk_produto_canais_produto on ibk_produto_canais (produto_id);

alter table ibk_produto_canais enable row level security;
drop policy if exists admin_tudo on ibk_produto_canais;
create policy admin_tudo on ibk_produto_canais for all to authenticated
  using (ibk_e_admin()) with check (ibk_e_admin());
