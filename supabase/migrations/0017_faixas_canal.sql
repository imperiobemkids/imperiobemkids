-- Faixas de preco por canal.
--
-- Ate aqui cada canal tinha uma comissao unica, mas as plataformas cobram por
-- faixa: o TikTok Shop cobra 10% + R$ 4 abaixo de R$ 50 e 6% + R$ 6 a partir
-- de R$ 50. Como os kits ficam justamente em cima dessa linha, uma taxa unica
-- deixaria a margem errada em toda venda.
--
-- Guardado em jsonb: [{ "ate": 50, "pct": 0.10, "fixo": 4 }, { "ate": null, "pct": 0.06, "fixo": 6 }]
-- "ate" e o limite superior da faixa; null significa "daqui para cima".
-- Canal sem faixas continua usando taxa_pct e taxa_fixa, como antes.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_canais add column if not exists faixas jsonb not null default '[]'::jsonb;

-- TikTok Shop ja entra com as faixas vigentes a partir de 15/07/2026
insert into ibk_canais (nome, taxa_pct, taxa_fixa, insumo_custo, limite_titulo, ordem, faixas, obs)
select 'TikTok Shop', 0.10, 4.00, 0.40, 60, coalesce((select max(ordem) from ibk_canais), 0) + 1,
  '[{"ate": 50, "pct": 0.10, "fixo": 4}, {"ate": null, "pct": 0.06, "fixo": 6}]'::jsonb,
  'comissao por faixa desde 15/07/2026; conferir se ha isencao de novo vendedor'
where not exists (select 1 from ibk_canais where nome ilike '%tiktok%');
