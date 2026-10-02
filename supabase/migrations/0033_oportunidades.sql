-- Oportunidades de mercado (02/10/2026). Idempotente. Rodar no SQL Editor, o
-- arquivo inteiro de uma vez. Depende da 0032 (tabela ibk_mercado).
--
-- Traz para o ERP o estudo "Oportunidades no Nicho Infantil" de 25/09/2026
-- (19 buscas na Shopee com o AvantPro) e cria o plano de cada oportunidade,
-- com prioridade e status, para acompanhar o que virou cotacao e compra.

-- 1) RADAR: duas medidas a mais por leitura
--    novos_pct: fatia das vendas que vem de anuncio com menos de 6 meses (alto = mercado aberto)
--    lider_pct: fatia da maior loja (alto = mercado dominado)
--    formato 0 = a busca inteira, sem separar avulso e kit (como no estudo de 25/09)
alter table ibk_mercado add column if not exists novos_pct numeric;
alter table ibk_mercado add column if not exists lider_pct numeric;
alter table ibk_mercado drop constraint if exists ibk_mercado_formato_check;
alter table ibk_mercado add constraint ibk_mercado_formato_check check (formato >= 0);

-- 2) PLANO: uma linha por busca de oportunidade
--    prioridade A fazer agora, B temporada que comeca, C acrescimo de ticket,
--    D planejar a compra, E evitar por enquanto
create table if not exists ibk_oportunidades (
  termo text primary key,
  grupo text not null check (grupo in ('essencial', 'opcional')),
  prioridade text not null check (prioridade in ('A', 'B', 'C', 'D', 'E')),
  janela text,
  acao text,
  meta_custo numeric,
  status text not null default 'ideia' check (status in ('ideia', 'cotando', 'comprado', 'descartado')),
  updated_at timestamptz not null default now()
);

do $$
begin
  execute 'alter table ibk_oportunidades enable row level security;';
  execute 'drop policy if exists admin_all on ibk_oportunidades;';
  execute 'create policy admin_all on ibk_oportunidades for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());';
end $$;

-- 3) LEITURA DE 25/09 (primeira pagina de cada busca, 60 anuncios; preco = mediana dos 10 que mais vendem)
insert into ibk_mercado (data, termo, formato, anuncios, vendas30, mediana_top10, novos_pct, lider_pct, fonte) values
  ('2026-09-25', 'kit roupa bebê recém nascido', 0, 60, 22438, 69.89, 0.16, 0.13, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'kit cueca infantil',           0, 60, 46086, 33.89, 0.13, 0.16, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'kit calcinha infantil',        0, 60, 51666, 21.79, 0.21, 0.15, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'body bebê',                    0, 60, 27408, 39.68, 0.32, 0.16, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'short infantil',               0, 60, 28016, 38.68, 0.08, 0.36, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'kit meia infantil',            0, 60, 37444, 19.99, 0.13, 0.13, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'legging infantil',             0, 60, 15275, 39.50, 0.36, 0.12, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'camiseta infantil básica',     0, 60, 12673, 32.99, 0.41, 0.18, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'pijama infantil',              0, 60, 10134, 33.89, 0.19, 0.25, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'fantasia infantil',            0, 60, 19452, 39.99, 0.12, 0.21, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'camisa uv infantil',           0, 60, 18124, 41.99, 0.12, 0.37, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'chinelo infantil',             0, 60, 31107, 22.99, 0.16, 0.31, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'sunga infantil',               0, 60, 17369, 39.99, 0.13, 0.44, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'vestido infantil festa',       0, 60, 11433, 60.70, 0.05, 0.22, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'biquíni infantil',             0, 60, 12958, 36.99, 0.18, 0.30, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'mochila infantil',             0, 60, 13441, 29.99, 0.21, 0.11, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'acessório cabelo infantil',    0, 60, 29351, 10.50, 0.33, 0.12, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'fantasia halloween infantil',  0, 60, 1266,  59.99, 0.20, 0.16, 'estudo 25/09 (shopee + avantpro)'),
  ('2026-09-25', 'roupa natal infantil',         0, 60, 554,   42.90, 0.00, 0.19, 'estudo 25/09 (shopee + avantpro)')
on conflict (data, termo, formato) do nothing;

-- 4) PLANO DE CADA UMA (o "Prioridade sugerida" do estudo)
insert into ibk_oportunidades (termo, grupo, prioridade, janela, acao, meta_custo) values
  ('pijama infantil',              'essencial', 'A', 'ano todo; manga longa no inverno', 'Recomprar P, M, G e tamanhos maiores. O pijama atual custa R$ 4,50: avulso a R$ 19,99 e kit de 2 a R$ 33,89.', 14.24),
  ('body bebê',                    'essencial', 'A', 'ano todo (chá de bebê e maternidade)', 'Pedir cotação ao fornecedor de conjunto. Meta: kit body 3 peças até R$ 17.', 17.00),
  ('kit roupa bebê recém nascido', 'essencial', 'A', 'ano todo (chá de bebê e maternidade)', 'Pedir cotação junto com o body. Meta: kit RN até R$ 34.', 34.00),
  ('biquíni infantil',             'opcional',  'B', 'outubro a março', 'Conjunto de praia menina (biquíni + camisa UV), menos concentrado que sunga e camisa UV.', 16.00),
  ('camisa uv infantil',           'opcional',  'B', 'outubro a março', 'Entra no conjunto de praia (com biquíni ou sunga); sozinha tem uma loja com 37%.', 19.00),
  ('sunga infantil',               'opcional',  'B', 'outubro a março', 'Só no combo camisa UV + sunga menino; sozinha tem uma loja com 44%.', 19.00),
  ('roupa natal infantil',         'opcional',  'B', 'explode em novembro e dezembro', 'Anunciar até meados de outubro (vestido vermelho, conjunto e body temático) para ter histórico quando a busca subir.', 19.20),
  ('kit meia infantil',            'essencial', 'C', 'ano todo; meia escolar em janeiro', 'Item de acréscimo: comprar em quantidade para combo e brinde, não como vitrine.', 6.59),
  ('acessório cabelo infantil',    'opcional',  'C', 'ano todo', 'Sobe o ticket: "conjunto + laço" no WhatsApp e brinde para pedir avaliação. Comprar no Brás ou 25 de Março.', 1.38),
  ('legging infantil',             'essencial', 'D', 'volta às aulas (janeiro e fevereiro)', 'Kit legging escolar (3 a 5 peças). Mercado aberto: 36% das vendas em anúncio novo. Comprar em dezembro.', 17.33),
  ('camiseta infantil básica',     'essencial', 'D', 'volta às aulas (janeiro e fevereiro)', 'Kit 5 camisetas básicas. O mais aberto da lista: 41% das vendas em anúncio novo. Comprar em dezembro.', 13.74),
  ('mochila infantil',             'opcional',  'D', 'volta às aulas', 'Entra no pacote de volta às aulas; comprar em dezembro.', 12.09),
  ('fantasia infantil',            'opcional',  'D', 'ano todo; pico no Carnaval', 'Carnaval 2027 (fevereiro): já vende R$ 0,78 mi por mês fora de temporada.', 17.59),
  ('kit cueca infantil',           'essencial', 'E', 'ano todo', 'Só com fornecedor de fábrica: kit de 10 a R$ 34,89 pede R$ 1,40 por peça.', 14.24),
  ('kit calcinha infantil',        'essencial', 'E', 'ano todo', 'Só com fornecedor de fábrica; preço de kit muito baixo.', 7.58),
  ('short infantil',               'essencial', 'E', 'ano todo', 'Fechado: líder de fábrica com 36% das vendas.', 16.87),
  ('chinelo infantil',             'opcional',  'E', 'verão', 'Fechado: líder com 31% e preço de R$ 22,99.', 8.24),
  ('vestido infantil festa',       'opcional',  'E', 'Natal e Réveillon', 'Mercado fechado: só 5% das vendas em anúncio novo.', 28.99),
  ('fantasia halloween infantil',  'opcional',  'E', 'outubro', 'Pequeno no Brasil (1.266 por mês): não compensa estoque próprio.', 28.59)
on conflict (termo) do nothing;
