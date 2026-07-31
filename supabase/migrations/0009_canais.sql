-- Canais de venda com economia propria (comissao, taxa fixa, embalagem).
-- Ate aqui o sistema assumia Shopee com 20% chumbado. Agora cada canal tem a sua regra
-- e a precificacao compara todos lado a lado.
-- Idempotente. Rodar no SQL Editor.

create table if not exists ibk_canais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  taxa_pct numeric not null default 0,      -- comissao sobre o preco (0.20 = 20%)
  taxa_fixa numeric not null default 0,     -- tarifa fixa por pedido, em reais
  insumo_custo numeric not null default 0,  -- embalagem/etiqueta por pedido
  ordem int not null default 0,
  ativo boolean not null default true,
  obs text,
  created_at timestamptz not null default now()
);

alter table ibk_canais enable row level security;
drop policy if exists admin_all on ibk_canais;
create policy admin_all on ibk_canais for all to authenticated using (true) with check (true);

-- Canais iniciais. Percentuais sao ponto de partida: conferir na conta de cada plataforma.
insert into ibk_canais (nome, taxa_pct, taxa_fixa, insumo_custo, ordem, obs)
select * from (values
  ('Shopee',          0.20, 0.00, 0.40, 1, 'comissao + taxa do programa de frete gratis; conferir na tabela vigente'),
  ('Mercado Livre',   0.16, 6.00, 0.40, 2, 'taxa fixa incide em pedidos abaixo do limite da plataforma'),
  ('Site proprio',    0.05, 0.60, 0.40, 3, 'gateway de pagamento; lembrar que o trafego e pago a parte'),
  ('WhatsApp (Pix)',  0.00, 0.00, 0.40, 4, 'sem comissao; a margem inteira fica com a loja'),
  ('Loja fisica',     0.00, 0.00, 0.00, 5, 'sem comissao e sem embalagem de envio')
) as v(nome, taxa_pct, taxa_fixa, insumo_custo, ordem, obs)
where not exists (select 1 from ibk_canais);

-- Vendas passam a apontar para o canal cadastrado (o texto antigo continua valendo)
alter table ibk_vendas add column if not exists canal_id uuid references ibk_canais(id) on delete set null;
alter table ibk_vendas add column if not exists taxa_fixa numeric not null default 0;
alter table ibk_vendas drop constraint if exists ibk_vendas_canal_check;
