-- Variacoes de produto (tamanho, cor, estampa).
--
-- Roupa infantil se vende por variacao: com tudo num registro so, a venda tirava
-- do monte e nao dava para saber qual tamanho ou cor estava acabando, que e o que
-- decide a recompra.
--
-- A variacao e um produto normal (mesma tabela) apontando para o pai. Assim ela ja
-- herda tudo o que o produto tem: preco, custo, peso, dimensoes, GTIN, NCM. E
-- vendas, kardex e custo medio continuam funcionando sem nenhuma mudanca, porque
-- para o resto do sistema ela e so mais um produto.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_produtos add column if not exists produto_pai_id uuid
  references ibk_produtos(id) on delete set null;

-- marca o produto que virou agrupador: o saldo dele vive nas variacoes
alter table ibk_produtos add column if not exists tem_variacoes boolean not null default false;

create index if not exists ibk_produtos_pai_idx on ibk_produtos(produto_pai_id);
