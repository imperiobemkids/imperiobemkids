-- Conciliacao so faz sentido em marketplace (a plataforma repassa depois).
-- Venda direta (loja fisica, WhatsApp/Pix) e recebida no ato e nao pode
-- aparecer como "esperando repasse" nem como divergencia.
--
-- As vendas existentes estavam com recebido = 0 (conciliadas com zero), o
-- que gerava R$ 617,73 de divergencia falsa. Aqui:
--   - venda em canal sem comissao e sem fixa: recebido = preco - frete da
--     loja, recebida na data da venda, obs "recebido no ato";
--   - venda em marketplace com recebido = 0 e sem obs: volta a pendente,
--     pra ser conciliada com o extrato de verdade.
-- Idempotente.

update ibk_vendas v
set recebido = v.preco_venda - coalesce(v.frete, 0),
    data_recebimento = coalesce(v.data_recebimento, v.data),
    obs_conciliacao = coalesce(v.obs_conciliacao, 'recebido no ato')
from ibk_canais c
where c.id = v.canal_id
  and coalesce(c.taxa_pct, 0) = 0 and coalesce(c.taxa_fixa, 0) = 0
  and (c.faixas is null or c.faixas = '[]'::jsonb)
  and (v.recebido is null or v.recebido = 0)
  and v.status <> 'cancelado';

update ibk_vendas v
set recebido = null, data_recebimento = null
from ibk_canais c
where c.id = v.canal_id
  and (coalesce(c.taxa_pct, 0) > 0 or coalesce(c.taxa_fixa, 0) > 0 or (c.faixas is not null and c.faixas <> '[]'::jsonb))
  and v.recebido = 0
  and v.obs_conciliacao is null;
