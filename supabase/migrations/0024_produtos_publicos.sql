-- Pagina de produto no site proprio, gerada da ficha do ERP.
--
-- O site le com a chave anonima, e as tabelas do ERP exigem admin (RLS).
-- Entao a saida e uma view so com o que e publico (titulo, descricao,
-- preco, foto, especificacoes, tamanhos com estoque, link da Shopee) e so
-- dos produtos marcados como publicados. A view roda com o dono (postgres),
-- por isso enxerga as tabelas; quem le a view so ve as colunas dela.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_produtos add column if not exists publicado boolean not null default false;
alter table ibk_produtos add column if not exists slug text;
alter table ibk_produtos add column if not exists foto_url text;   -- "/produtos/kit-verao-menina.jpg" ou URL completa

create unique index if not exists ibk_produtos_slug_uq on ibk_produtos (slug) where slug is not null;

-- slug a partir do nome, sem acento, so para produto pai ou avulso que ainda nao tem
update ibk_produtos
set slug = regexp_replace(
  regexp_replace(lower(translate(coalesce(nome, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'),
  '(^-|-$)', '', 'g')
where slug is null and produto_pai_id is null and coalesce(nome, '') <> '';

create or replace view ibk_produtos_publicos as
select
  p.id,
  p.slug,
  p.nome,
  coalesce(
    (select a->>'titulo' from jsonb_array_elements(p.anuncios) a where a->>'uso' ilike '%site%' and coalesce(a->>'titulo','') <> '' limit 1),
    nullif(p.titulo_anuncio, ''),
    (select a->>'titulo' from jsonb_array_elements(p.anuncios) a where coalesce(a->>'titulo','') <> '' limit 1),
    p.nome
  ) as titulo,
  coalesce(
    (select a->>'descricao' from jsonb_array_elements(p.anuncios) a where a->>'uso' ilike '%site%' and coalesce(a->>'descricao','') <> '' limit 1),
    nullif(p.descricao_longa, ''),
    (select a->>'descricao' from jsonb_array_elements(p.anuncios) a where coalesce(a->>'descricao','') <> '' limit 1)
  ) as descricao,
  p.preco_venda,
  p.foto_url,
  p.categoria,
  p.linha,
  p.genero,
  p.marca,
  p.material,
  p.composicao,
  p.faixa_etaria,
  p.pecas_por_kit,
  p.palavras_chave,
  -- tamanhos com estoque, na ordem em que foram cadastrados
  coalesce((
    select array_agg(distinct v.tamanho order by v.tamanho)
    from ibk_produtos v where v.produto_pai_id = p.id and v.ativo and v.qtd_atual > 0 and v.tamanho is not null
  ), case when p.tamanho is not null and p.qtd_atual > 0 then array[p.tamanho] else array[]::text[] end) as tamanhos,
  (p.qtd_atual > 0 or exists (select 1 from ibk_produtos v where v.produto_pai_id = p.id and v.ativo and v.qtd_atual > 0)) as em_estoque,
  (select pc.url from ibk_produto_canais pc join ibk_canais c on c.id = pc.canal_id
     where pc.produto_id = p.id and c.nome ilike '%shopee%' and pc.url is not null limit 1) as url_shopee,
  p.created_at
from ibk_produtos p
where p.ativo and p.publicado and p.produto_pai_id is null and p.slug is not null;

grant select on ibk_produtos_publicos to anon, authenticated;
