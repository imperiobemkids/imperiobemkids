-- Ajustes da auditoria antes de publicar (25/09/2026). Idempotente.
-- Rodar no SQL Editor.

-- 1) SEGURANCA: fecha a view antiga de estoque.
--
-- A view ibk_v_estoque (migration 0001) roda com o dono do banco, entao ignora
-- o RLS das tabelas. E o Supabase libera select em toda view do schema public
-- para as chaves anon e authenticated. Resultado: com a chave publica que fica
-- no site, qualquer pessoa conseguia ler o estoque inteiro, com custo de cada
-- produto e quantidade.
--
-- O painel nao usa essa view (calcula tudo na tela), entao ela sai.
-- A ibk_produtos_publicos (0024) continua: ela e publica de proposito e so
-- mostra produto marcado como publicado, sem custo.

drop view if exists ibk_v_estoque;

-- 2) CONCILIACAO: venda de marketplace "conciliada com zero" volta a pendente.
--
-- A 0028 fez isso so para venda com canal vinculado (canal_id). Venda antiga
-- sem canal_id, mas com comissao ou tarifa, ficou com recebido = 0 e aparecia
-- como divergencia falsa (a venda Shopee de 14/08: R$ 26,33 "a menos").

update ibk_vendas
set recebido = null, data_recebimento = null
where recebido = 0
  and obs_conciliacao is null
  and (coalesce(taxa_pct, 0) > 0 or coalesce(taxa_fixa, 0) > 0)
  and status <> 'cancelado';

-- 3) FORNECEDORES: celular que estava no campo antigo "contato" vai pro
-- WhatsApp (os ativos, cadastrados antes da 0029, ficavam sem o botao).
-- So numero de celular (DDD + 9 + 8 digitos); fixo e e-mail ficam onde estao.

update ibk_fornecedores
set whatsapp = regexp_replace(contato, '\D', '', 'g'),
    contato = null
where whatsapp is null
  and contato is not null
  and regexp_replace(contato, '\D', '', 'g') ~ '^(55)?[1-9][0-9]9[0-9]{8}$';

-- 4) CANAIS: Kwai Shop foi criado desativado (0026) e a loja vende la.
-- Ativo, ele aparece no caixa, na importacao e na precificacao.

update ibk_canais set ativo = true where nome ilike '%kwai%' and not ativo;

-- Conferencia:
--   select table_name from information_schema.views
--   where table_schema = 'public' and table_name like 'ibk_%';
--   (deve sobrar so ibk_produtos_publicos)
