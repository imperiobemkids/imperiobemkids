-- Grade de tamanhos: produto pai com um filho por tamanho, cada um com estoque proprio.
--
-- Antes o tamanho era texto livre num registro so ("P e M", "1/8"), entao a venda
-- tirava do monte e nao dava para saber qual tamanho estava acabando, que e
-- justamente o que decide a recompra.
--
-- O filho e um produto normal (mesma tabela), apontando para o pai. Assim vendas,
-- kardex e custo medio continuam funcionando sem mudanca.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_produtos add column if not exists produto_pai_id uuid
  references ibk_produtos(id) on delete set null;

create index if not exists ibk_produtos_pai_idx on ibk_produtos(produto_pai_id);

-- Um produto pai nao guarda estoque proprio: o saldo vive nos tamanhos.
-- Marcamos com a flag para a tela saber que ele e so o agrupador.
alter table ibk_produtos add column if not exists e_grade boolean not null default false;
