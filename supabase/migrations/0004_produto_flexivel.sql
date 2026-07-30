-- Produto mais abrangente: nome e categoria livres, linha/genero viram opcionais.
-- Idempotente (pode rodar sem medo). Rodar no SQL Editor.

alter table ibk_produtos add column if not exists nome text;
alter table ibk_produtos add column if not exists categoria text;

-- linha e genero deixam de ser obrigatorios (eram presos a verao/inverno + menino/menina)
alter table ibk_produtos alter column linha drop not null;
alter table ibk_produtos alter column genero drop not null;
