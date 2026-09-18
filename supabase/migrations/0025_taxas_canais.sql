-- Correcoes de taxa dos canais, apontadas na verificacao da venda de agosto e
-- ainda pendentes. Guardadas por WHERE: so mexe no que ainda esta errado, nao
-- sobrescreve o que ja foi ajustado em /admin/canais. Idempotente.

-- Shopee: 18% comissao + 2% transacao = 20%, mais R$ 4,00 por item vendido
-- (linha "Taxa por item vendido" do extrato). Conferido na fatura real.
update ibk_canais set taxa_pct = 0.20
where nome ilike '%shopee%' and taxa_pct = 0.18;

update ibk_canais set taxa_fixa = 4.00, taxa_fixa_por_item = true
where nome ilike '%shopee%' and taxa_fixa = 0;

-- TikTok Shop: faixa pelo preco do item (< R$ 50: 10% + R$ 4; >= R$ 50: 6% + R$ 6)
update ibk_canais
set faixas = '[{"ate": 50, "pct": 0.10, "fixo": 4}, {"ate": null, "pct": 0.06, "fixo": 6}]'::jsonb,
    taxa_fixa_por_item = true
where nome ilike '%tiktok%' and (faixas is null or faixas = '[]'::jsonb);

-- Ads por produto: o lancamento de ads no caixa pode apontar para o produto
-- anunciado. Com isso o ROAS deixa de ser da loja inteira e passa a dizer
-- qual kit vale a pena anunciar.
alter table ibk_movimentos add column if not exists produto_id uuid references ibk_produtos(id) on delete set null;
create index if not exists ibk_movimentos_produto on ibk_movimentos (produto_id) where produto_id is not null;
