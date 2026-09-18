-- Taxas dos canais mudam com o tempo e precisam ser editaveis na tela, com
-- tudo que as plataformas cobram hoje:
--   - comissao e fixa por faixa de preco (ja existia, mas nao era editavel)
--   - programa opcional em cima (Programa Frete Gratis do TikTok e da Shopee,
--     +6% sobre o produto), que a loja liga ou desliga
--   - data em que a tabela foi conferida e a fonte, pra saber quando envelheceu
-- Idempotente. Rodar no SQL Editor.

alter table ibk_canais add column if not exists programa_nome text;
alter table ibk_canais add column if not exists programa_pct numeric not null default 0;
alter table ibk_canais add column if not exists programa_ativo boolean not null default false;
alter table ibk_canais add column if not exists taxas_conferidas_em date;
alter table ibk_canais add column if not exists taxas_fonte text;

-- Programa Frete Gratis: cadastrado desligado; a loja liga se aderir
update ibk_canais set programa_nome = 'Programa Frete Grátis', programa_pct = 0.06
where nome ilike '%tiktok%' and programa_nome is null;
update ibk_canais set programa_nome = 'Programa Frete Grátis', programa_pct = 0.06
where nome ilike '%shopee%' and programa_nome is null;

-- Mercado Livre (anuncio classico): comissao de 10% a 14% conforme a categoria,
-- e fixa por unidade vendida conforme o preco. Ate R$ 12,49 a "fixa" e 50% do
-- valor, entao entra como percentual. So preenche se ainda nao tem faixas.
update ibk_canais
set faixas = '[
  {"ate": 12.5,  "pct": 0.62, "fixo": 0},
  {"ate": 30,    "pct": 0.12, "fixo": 6.25},
  {"ate": 50,    "pct": 0.12, "fixo": 6.50},
  {"ate": 79,    "pct": 0.12, "fixo": 6.75},
  {"ate": null,  "pct": 0.12, "fixo": 0}
]'::jsonb,
    taxa_fixa_por_item = true,
    obs = coalesce(obs, '') || ' | classico: comissao 10% a 14% por categoria (12% como ponto de partida); premium e outra tabela'
where nome ilike '%mercado livre%' and (faixas is null or faixas = '[]'::jsonb);

-- Kwai Shop: 20% e sem fixa
insert into ibk_canais (nome, taxa_pct, taxa_fixa, insumo_custo, limite_titulo, ordem, ativo, obs)
select 'Kwai Shop', 0.20, 0, 0.40, 0, coalesce((select max(ordem) from ibk_canais), 0) + 1, false,
  'comissao unica de 20%, sem taxa fixa por item'
where not exists (select 1 from ibk_canais where nome ilike '%kwai%');

-- data de conferencia: as tabelas destas migrations valem para setembro de 2026
update ibk_canais set taxas_conferidas_em = '2026-09-18'
where taxas_conferidas_em is null
  and (nome ilike '%shopee%' or nome ilike '%tiktok%' or nome ilike '%kwai%' or nome ilike '%mercado livre%');
