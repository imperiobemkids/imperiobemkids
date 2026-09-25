-- Fornecedores viram funil de prospeccao: status (pista, contatado, cotado,
-- aprovado, ativo, descartado), tipo (fabrica, atacado de revenda, ponta de
-- estoque, dropshipping), polo, contatos e os dados da cotacao (pedido minimo,
-- aceita CPF, emite NF, permite marketplace, preco de referencia).
--
-- E cadastra as pistas levantadas na pesquisa de 25/09/2026 (nota "Fornecedores
-- com Pouco Caixa" no vault). Nenhuma foi contatada: entram como "pista".
-- Quem ja existe (True Way, Lambari) fica "ativo" e so ganha o que faltava.
-- Idempotente: nao duplica por nome.

alter table ibk_fornecedores add column if not exists status text not null default 'ativo';
alter table ibk_fornecedores add column if not exists tipo text;
alter table ibk_fornecedores add column if not exists polo text;
alter table ibk_fornecedores add column if not exists cidade_uf text;
alter table ibk_fornecedores add column if not exists whatsapp text;
alter table ibk_fornecedores add column if not exists instagram text;
alter table ibk_fornecedores add column if not exists produtos text;
alter table ibk_fornecedores add column if not exists pedido_minimo numeric;
alter table ibk_fornecedores add column if not exists aceita_cpf boolean;
alter table ibk_fornecedores add column if not exists emite_nf boolean;
alter table ibk_fornecedores add column if not exists permite_marketplace boolean;
alter table ibk_fornecedores add column if not exists preco_ref text;
alter table ibk_fornecedores add column if not exists ultimo_contato date;

do $$ begin
  alter table ibk_fornecedores add constraint ibk_fornecedores_status_chk
    check (status in ('pista', 'contatado', 'cotado', 'aprovado', 'ativo', 'descartado'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table ibk_fornecedores add constraint ibk_fornecedores_tipo_chk
    check (tipo is null or tipo in ('fabrica', 'atacado', 'ponta_estoque', 'dropshipping', 'polo'));
exception when duplicate_object then null; end $$;

-- Lambari (fornecedor atual do inverno): completa com o que a pesquisa trouxe
update ibk_fornecedores
set tipo = coalesce(tipo, 'atacado'),
    polo = coalesce(polo, 'Brás'),
    cidade_uf = coalesce(cidade_uf, 'São Paulo/SP'),
    link = coalesce(link, 'https://www.lambariatacado.com.br/'),
    preco_ref = coalesce(preco_ref, 'site 25/09: conjunto menino R$ 24,90; body R$ 15,90; pijama juvenil R$ 36,90; moletom R$ 64,90 (kits de 3, 6 e 9)'),
    produtos = coalesce(produtos, 'conjunto verão e inverno, body, pijama')
where nome ilike '%lambari%';

-- Pistas novas
insert into ibk_fornecedores (nome, status, tipo, polo, cidade_uf, link, whatsapp, instagram, contato, produtos, pedido_minimo, aceita_cpf, preco_ref, obs)
select v.* from (values
  -- Brás, São Paulo
  ('Rugido Kids', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://loja.menu/rugidokids', null, null, null, 'infantil', 0::numeric, true, null, 'sem pedido mínimo, segundo guia 2026'),
  ('Kiki & Mily', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://kikimily.com.br', null, null, null, 'infantil', 300, true, null, null),
  ('Luizinho Baby', 'pista', 'atacado', 'Brás', 'São Paulo/SP', null, null, '@luizinhobabyoficial', null, 'bebê', 300, true, null, 'candidato para body e kit RN'),
  ('Yora Atacado', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://www.yoraatacado.com.br/', null, null, null, 'infantil, pijama', 450, true, 'site 25/09: conjunto R$ 39,99', 'preço de revenda: não fecha conta em marketplace. Sem grade fechada, 5x sem juros, 5% no Pix'),
  ('Diana Kids', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://dianakids.com.br', null, null, null, 'infantil', 500, true, null, 'mínimo de 8 peças'),
  ('MercoBrás Kids', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://mercobrasmalhas.com.br', null, null, null, 'infantil', null, true, null, 'a partir de 1 kit'),
  ('Paravati Atacado', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://www.paravatiatacado.com.br/', '11934554993', null, 'contato@paravatiatacado.com.br', 'infantil e juvenil (linhas popular a premium)', null, true, null, 'showroom: Rua Dr. Virgílio do Nascimento, 141, Brás. A partir de 1 kit'),
  ('Brascol', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://brascol.com.br/', null, null, null, 'bebê e infantil, marcas', 500, false, null, 'exige CNPJ (a loja tem)'),
  ('Paulimar', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://paulimar.com.br', null, null, null, 'infantil', 600, false, null, 'exige CNPJ'),
  ('Ascona', 'pista', 'atacado', 'Brás', 'São Paulo/SP', 'https://ascona.com.br', null, null, null, 'infantil', 600, true, null, 'R$ 600 com CNPJ, R$ 1.000 com CPF'),
  ('Fadinha Kids Atacado', 'pista', 'atacado', null, null, 'https://fadinhakidsatacado.com.br/', null, null, null, 'infantil', 300, null, null, 'envia para todo o Brasil'),
  ('Mundo Kids Jeans', 'pista', 'fabrica', null, null, null, null, '@mundokidsjeans', null, 'jeans infantil', 300, null, null, 'se apresenta como fábrica, pronta entrega'),
  -- Goiânia, Rua 44
  ('Railander Kids', 'pista', 'fabrica', 'Goiânia Rua 44', 'Goiânia/GO', 'https://www.lojavirtual44.com.br/lojas/railander-confeccoes-rua-44-goiania/', '62999795114', '@railanderconf', null, 'conjunto infantil, vestido, short', null, null, null, 'fábrica de conjunto; varejo e atacado para todo o Brasil'),
  -- Santa Catarina
  ('Atacado Ponta de Estoque', 'pista', 'ponta_estoque', 'Santa Catarina', 'Brusque/SC', 'https://atacadopontadeestoque.com.br/', null, null, '(47) 3224-2094', 'infantil e juvenil de marca (Brandili, Colorittá, Fakini, Lanfel)', null, false, null, 'ponta de estoque de marca: perguntar se permite marketplace'),
  ('Confecções Santa Catarina', 'pista', 'ponta_estoque', 'Santa Catarina', null, 'https://confeccoessantacatarina.com.br/saldos-ponta-de-estoque/', null, null, null, 'saldos infantil, juvenil e adulto', null, null, null, 'saldo e ponta de estoque'),
  -- Terra Roxa (moda bebê)
  ('APL Moda Bebê (Terra Roxa)', 'pista', 'polo', 'Terra Roxa', 'Terra Roxa/PR', 'https://aplmodabebe.com.br/', null, '@aplmodabebe', null, 'bebê 0 a 12 anos: body, kit RN, macacão', null, null, null, '27 fábricas associadas. Feira Moda Bebê 12 a 14/11/2026, preço de fábrica'),
  -- Pijama
  ('Infantil Atacado', 'pista', 'atacado', null, null, 'https://www.infantilatacado.com.br/pijama-infantil-no-atacado', null, null, null, 'pijama infantil', null, false, null, 'cadastro com CNPJ'),
  ('Oficina do Pijama', 'pista', 'atacado', null, null, 'https://loja.oficinadopijama.com.br/', null, null, null, 'pijama', null, null, null, null),
  ('Atacadão da Roupa', 'pista', 'fabrica', null, null, 'https://www.atacadaodaroupa.com/pijamas', null, null, null, 'pijama infantil', null, null, null, 'anuncia direto de fábrica'),
  ('Amme Brand', 'pista', 'atacado', null, 'Aquiraz/CE', 'https://www.ammebrand.com.br/', null, null, null, 'pijama e baby-doll', 150, null, 'site 25/09: baby-doll infantil R$ 27,08', 'preço acima da meta de pijama (R$ 6,59)'),
  -- Dropshipping
  ('Bigolê Kids', 'pista', 'dropshipping', null, 'Andradina/SP', 'https://bigolekids.com.br/', null, null, null, 'infantil menino e menina', 0, true, null, 'dropshipping sem estoque e sem CNPJ (programa VIP com vagas em ciclos). Para testar categoria, não como motor')
) as v(nome, status, tipo, polo, cidade_uf, link, whatsapp, instagram, contato, produtos, pedido_minimo, aceita_cpf, preco_ref, obs)
where not exists (select 1 from ibk_fornecedores f where lower(f.nome) = lower(v.nome));
