-- A venda vira pedido de marketplace: numero do pedido na plataforma, status
-- do ciclo (aguardando envio -> enviado -> entregue, ou cancelado/devolvido),
-- rastreio, datas e nota fiscal.
--
-- `devolvida` continua existindo e espelha status = 'devolvido', para nada
-- que ja le esse campo quebrar. Idempotente. Rodar no SQL Editor.

alter table ibk_vendas add column if not exists pedido_externo text;
alter table ibk_vendas add column if not exists status text not null default 'aguardando';
alter table ibk_vendas add column if not exists rastreio text;
alter table ibk_vendas add column if not exists enviado_em date;
alter table ibk_vendas add column if not exists entregue_em date;
alter table ibk_vendas add column if not exists cancelado_em date;
alter table ibk_vendas add column if not exists nf_numero text;
alter table ibk_vendas add column if not exists nf_chave text;

do $$ begin
  alter table ibk_vendas add constraint ibk_vendas_status_chk
    check (status in ('aguardando', 'enviado', 'entregue', 'cancelado', 'devolvido'));
exception when duplicate_object then null; end $$;

-- Vendas antigas ja foram entregues (ou devolvidas). So as novas nascem aguardando.
update ibk_vendas set status = case when devolvida then 'devolvido' else 'entregue' end
where status = 'aguardando' and created_at < now() - interval '1 hour';

-- O mesmo pedido da plataforma nao entra duas vezes (protege a importacao futura)
create unique index if not exists ibk_vendas_pedido_externo_uq
  on ibk_vendas (canal_id, pedido_externo) where pedido_externo is not null;

create index if not exists ibk_vendas_status on ibk_vendas (status);
