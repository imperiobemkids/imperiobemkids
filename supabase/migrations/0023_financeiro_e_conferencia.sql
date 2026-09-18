-- Duas coisas numa migration so, como combinado.
--
-- 1) Financeiro: categorias que faltavam no caixa de uma loja com CNPJ
--    (imposto, pro-labore, servico/ferramenta) e contas recorrentes: o que
--    vence todo mes (DAS, pro-labore, assinatura) vira um modelo que gera o
--    lancamento do mes com um clique, ja como "a pagar" com vencimento.
-- 2) Compras: conferencia do lote no recebimento (quantidade que chegou,
--    etiqueta textil, cordoes, avarias), que e a defesa de quem revende
--    roupa infantil.
-- Idempotente. Rodar no SQL Editor.

-- 1) categorias
alter table ibk_movimentos drop constraint if exists ibk_movimentos_categoria_check;
alter table ibk_movimentos add constraint ibk_movimentos_categoria_check
  check (categoria in ('mercadoria','insumo','capex','venda','taxa_shopee','frete','ads','imposto','pro_labore','servico','outro'));

-- 1) recorrencias
create table if not exists ibk_recorrencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'saida' check (tipo in ('entrada','saida')),
  categoria text not null,
  valor numeric not null default 0,
  descricao text not null,
  dia_vencimento smallint not null default 10 check (dia_vencimento between 1 and 28),
  forma_pagamento text,
  proximo_em date not null,       -- proxima competencia ainda nao lancada
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table ibk_movimentos add column if not exists recorrencia_id uuid references ibk_recorrencias(id) on delete set null;
create index if not exists ibk_movimentos_vencimento on ibk_movimentos (vencimento) where pago = false;

alter table ibk_recorrencias enable row level security;
drop policy if exists admin_tudo on ibk_recorrencias;
create policy admin_tudo on ibk_recorrencias for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());

-- ponto de partida: o DAS do Simples, que todo CNPJ paga ate o dia 20
insert into ibk_recorrencias (tipo, categoria, valor, descricao, dia_vencimento, proximo_em)
select 'saida', 'imposto', 0, 'DAS Simples Nacional', 20,
  (date_trunc('month', current_date) + interval '19 days')::date
where not exists (select 1 from ibk_recorrencias);

-- 2) conferencia do lote
alter table ibk_lotes add column if not exists conferido_em date;
alter table ibk_lotes add column if not exists conferencia jsonb;
-- formato: { "qtd_pedida": 50, "qtd_recebida": 50, "etiqueta_ok": true,
--            "cordoes_ok": true, "avarias": 0, "obs": "..." }
