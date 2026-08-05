-- Varios textos de anuncio por produto, um para cada canal de venda.
-- Os canais vem da tabela ibk_canais (migration 0009), entao canal novo cadastrado
-- em /admin/canais aparece sozinho na ficha do produto.
-- Idempotente. Rodar no SQL Editor.

-- Limite de titulo e caracteristica do canal, entao mora junto com ele.
alter table ibk_canais add column if not exists limite_titulo int not null default 0; -- 0 = sem limite

update ibk_canais set limite_titulo = 120 where nome ilike '%shopee%'        and limite_titulo = 0;
update ibk_canais set limite_titulo = 60  where nome ilike '%mercado livre%' and limite_titulo = 0;
update ibk_canais set limite_titulo = 70  where nome ilike '%site%'          and limite_titulo = 0;

-- Textos do produto por canal.
-- Formato: [{ "uso": "Shopee", "titulo": "...", "descricao": "..." }]
alter table ibk_produtos add column if not exists anuncios jsonb not null default '[]'::jsonb;

-- Aproveita o que ja foi escrito nos campos antigos, virando o primeiro bloco
update ibk_produtos
set anuncios = jsonb_build_array(
  jsonb_build_object(
    'uso', 'Shopee',
    'titulo', coalesce(titulo_anuncio, ''),
    'descricao', coalesce(descricao_longa, '')
  )
)
where anuncios = '[]'::jsonb
  and (coalesce(titulo_anuncio, '') <> '' or coalesce(descricao_longa, '') <> '');
