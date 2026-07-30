-- MODO DEV: libera as tabelas ibk_ para uso local com a anon/publishable key.
-- As tabelas vieram com RLS LIGADO e sem politica, entao a chave nao lia nem gravava.
-- ATENCAO: isso deixa o banco aberto para quem tiver a anon key.
-- NAO publicar o site enquanto nao rodar a Fase 4 (auth + RLS travado).
-- Para reverter: alter table ... enable row level security; e criar politicas.

alter table ibk_fornecedores disable row level security;
alter table ibk_lotes         disable row level security;
alter table ibk_lote_itens    disable row level security;
alter table ibk_produtos      disable row level security;
alter table ibk_insumos       disable row level security;
alter table ibk_vendas        disable row level security;
alter table ibk_venda_itens   disable row level security;
alter table ibk_movimentos    disable row level security;
