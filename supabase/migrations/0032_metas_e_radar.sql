-- Meta do mes e radar de mercado (02/10/2026). Idempotente. Rodar no SQL Editor,
-- o arquivo inteiro de uma vez.

-- 1) META DO MES: faturamento e lucro das vendas que a loja quer bater no mes.
--    Uma linha por mes ('2026-10'); o painel compara com o que ja foi vendido.
create table if not exists ibk_metas (
  mes text primary key check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  faturamento numeric not null default 0,
  lucro numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) RADAR DE MERCADO: leitura da busca da Shopee com o AvantPro ligado.
--    Cada linha e um formato de anuncio dentro de uma busca, num dia:
--    formato 1 = avulso, 2 = kit com 2, 3 = kit com 3, e assim por diante.
--    Guarda o preco e o custo do dia para a margem nao mudar quando o preco mudar depois.
create table if not exists ibk_mercado (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  termo text not null,
  formato int not null check (formato > 0),
  anuncios int not null default 0,
  vendas30 int not null default 0,
  mediana_top10 numeric,
  menor numeric,
  nosso_preco numeric,
  custo_unit numeric,
  lider_preco numeric,
  lider_vendas int,
  lider_titulo text,
  fonte text not null default 'shopee + avantpro',
  created_at timestamptz not null default now(),
  unique (data, termo, formato)
);
create index if not exists ibk_mercado_termo_data on ibk_mercado (termo, data desc);

-- mesma regra de acesso do resto do ERP (migration 0013): so administrador
do $$
declare t text;
begin
  foreach t in array array['ibk_metas', 'ibk_mercado'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists admin_all on %I;', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());', t
    );
  end loop;
end $$;
