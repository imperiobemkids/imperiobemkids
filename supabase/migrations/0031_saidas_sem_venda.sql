-- Saida de estoque sem venda (02/10/2026). Idempotente. Rodar no SQL Editor.
--
-- Peca que sai sem virar venda tinha um caminho so, o ajuste manual, e o custo
-- dela sumia do estoque sem aparecer no resultado. Agora o kardex aceita tres
-- motivos e o DRE e o painel somam o custo de cada um:
--   presente  brinde para cliente, parceira ou familia
--   conteudo  peca usada em video, foto ou live
--   perda     estragou, sumiu ou nao da pra vender
-- Nao entra dinheiro e nao sai dinheiro de novo: a compra ja saiu do caixa.
--
-- Venda fiado (paga depois) nao precisa de coluna nova: e uma venda com
-- forma_pagamento = 'fiado' e a entrada do caixa com pago = false.

alter table ibk_estoque_mov drop constraint if exists ibk_estoque_mov_origem_check;
alter table ibk_estoque_mov add constraint ibk_estoque_mov_origem_check
  check (origem in ('compra','venda','ajuste','devolucao','inicial','presente','conteudo','perda'));

create index if not exists ibk_estoque_mov_origem_data on ibk_estoque_mov (origem, data)
  where origem in ('presente','conteudo','perda');
