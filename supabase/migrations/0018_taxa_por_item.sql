-- Tarifa fixa cobrada POR ITEM do pedido, nao uma vez por pedido.
--
-- Confirmado no extrato da Shopee: a linha se chama "Taxa por item vendido".
-- Item aqui e a linha do pedido (a quantidade pedida), nao a peca fisica: um
-- produto que ja vem com 3 pecas dentro conta como 1 item e paga uma tarifa.
-- Um pedido com 3 produtos diferentes paga 3 tarifas.
--
-- Como o sistema cobrava uma vez por pedido, o lucro de venda de marketplace
-- com mais de um item saia inflado.
-- Idempotente. Rodar no SQL Editor.

alter table ibk_canais add column if not exists taxa_fixa_por_item boolean not null default true;

-- venda direta (WhatsApp, loja fisica) nao tem tarifa fixa, entao nao se aplica
update ibk_canais set taxa_fixa_por_item = false where taxa_fixa = 0;

-- guarda quantas unidades a venda teve, para conferir a tarifa depois
alter table ibk_vendas add column if not exists qtd_itens int not null default 1;
