-- Integracoes por API com os marketplaces (03/10/2026). Idempotente. Rodar no
-- SQL Editor, o arquivo inteiro de uma vez. Comeca pela Shopee; Mercado Livre,
-- TikTok Shop e Kwai entram nas mesmas tabelas quando tiverem app aprovado.
--
-- 1) INTEGRACOES: a autorizacao de cada loja, uma linha por canal do ERP (cada
--    loja de marketplace ja e um canal em ibk_canais). "plataforma" diz qual API
--    fala com ela. Os tokens vao em "cofre", cifrados no servidor com a chave do
--    app de cada plataforma; o navegador so ve texto cifrado. "extra" guarda
--    dado da plataforma que nao e segredo (ex.: shop_cipher do TikTok, apelido
--    do vendedor no Mercado Livre).
create table if not exists ibk_integracoes (
  canal_id uuid primary key references ibk_canais(id) on delete cascade,
  plataforma text not null check (plataforma in ('shopee', 'mercadolivre', 'tiktok', 'kwai')),
  ambiente text not null default 'teste' check (ambiente in ('teste', 'producao')),
  loja_id text,
  extra jsonb not null default '{}'::jsonb,
  cofre text,
  access_expira_em timestamptz,
  refresh_expira_em timestamptz,
  conectado_em timestamptz,
  ultima_sync timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists ibk_integracoes_plataforma on ibk_integracoes (plataforma);

-- 2) VINCULOS: cada variacao de anuncio, em qualquer canal, aponta para um
--    produto do estoque e diz quantos conjuntos fisicos sai em cada unidade
--    vendida (avulso 1, kit 2, kit 3). E o que faz o mesmo conjunto aparecer em
--    varios anuncios sem vender duas vezes a mesma peca: o estoque de cada
--    anuncio e saldo / conjuntos. Os codigos sao texto porque cada plataforma
--    usa um formato (Shopee item_id/model_id, ML MLB.../variation_id, TikTok
--    product_id/sku_id). id_variacao vazio = anuncio sem variacao.
create table if not exists ibk_anuncio_vinculos (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid not null references ibk_canais(id) on delete cascade,
  id_anuncio text not null,
  id_variacao text not null default '',
  produto_id uuid not null references ibk_produtos(id) on delete cascade,
  conjuntos int not null default 1 check (conjuntos between 1 and 50),
  titulo text,
  variacao text,
  sku text,
  estoque_enviado int,
  enviado_em timestamptz,
  updated_at timestamptz not null default now(),
  unique (canal_id, id_anuncio, id_variacao)
);
create index if not exists ibk_anuncio_vinculos_produto on ibk_anuncio_vinculos (produto_id);

-- mesma regra de acesso do resto do ERP (migration 0013): so administrador
do $$
declare t text;
begin
  foreach t in array array['ibk_integracoes', 'ibk_anuncio_vinculos'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists admin_all on %I;', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());', t
    );
  end loop;
end $$;
