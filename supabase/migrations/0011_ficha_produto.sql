-- Ficha completa do produto: anuncio, especificacoes, logistica e fiscal.
-- Ate aqui o produto tinha so nome, custo e quantidade. Estes campos sao os que
-- os marketplaces e a nota fiscal pedem.
-- Idempotente. Rodar no SQL Editor.

-- Anuncio (o que vai para Shopee, Mercado Livre e site)
alter table ibk_produtos add column if not exists titulo_anuncio text;
alter table ibk_produtos add column if not exists descricao_longa text;
alter table ibk_produtos add column if not exists palavras_chave text;

-- Especificacoes
alter table ibk_produtos add column if not exists marca text;
alter table ibk_produtos add column if not exists modelo text;
alter table ibk_produtos add column if not exists cor text;
alter table ibk_produtos add column if not exists material text;
alter table ibk_produtos add column if not exists composicao text;
alter table ibk_produtos add column if not exists faixa_etaria text;
alter table ibk_produtos add column if not exists pecas_por_kit int;

-- Logistica (peso em kg, dimensoes do pacote em cm)
alter table ibk_produtos add column if not exists peso_bruto numeric;
alter table ibk_produtos add column if not exists peso_liquido numeric;
alter table ibk_produtos add column if not exists comprimento_cm numeric;
alter table ibk_produtos add column if not exists largura_cm numeric;
alter table ibk_produtos add column if not exists altura_cm numeric;
alter table ibk_produtos add column if not exists gtin text;          -- codigo de barras EAN/GTIN

-- Fiscal
alter table ibk_produtos add column if not exists ncm text;           -- Nomenclatura Comum do Mercosul
alter table ibk_produtos add column if not exists cest text;          -- Codigo Especificador da Substituicao Tributaria
alter table ibk_produtos add column if not exists cfop text;          -- Codigo Fiscal de Operacoes
alter table ibk_produtos add column if not exists origem text;        -- 0 nacional, 1 importado direto, 2 mercado interno...
alter table ibk_produtos add column if not exists cst_csosn text;     -- CST (regime normal) ou CSOSN (Simples)
alter table ibk_produtos add column if not exists unidade text default 'UN';
alter table ibk_produtos add column if not exists preco_venda numeric; -- preco de tabela do produto

-- Preco de venda tambem ajuda a precificacao a lembrar o valor praticado
create index if not exists ibk_produtos_sku_idx on ibk_produtos(sku);
