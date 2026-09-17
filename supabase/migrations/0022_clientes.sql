-- Base de clientes. Loja infantil vive de recompra (a crianca cresce a cada
-- estacao) e de indicacao entre maes; ate aqui o cliente era um texto na venda.
--
-- ibk_clientes: quem compra. ibk_criancas: os filhos, com nascimento e tamanho
-- atual, que e o gatilho da proxima venda. A venda passa a apontar para o
-- cliente (cliente_id); o texto antigo continua por compatibilidade.
-- Idempotente. Rodar no SQL Editor.

create table if not exists ibk_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text,
  cidade text,
  origem text,           -- shopee, grupo, indicacao, instagram, tiktok, loja
  obs text,
  created_at timestamptz not null default now()
);

create table if not exists ibk_criancas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references ibk_clientes(id) on delete cascade,
  nome text,
  nascimento date,
  genero text,           -- menino, menina
  tamanho_atual text,
  created_at timestamptz not null default now()
);

create index if not exists ibk_criancas_cliente on ibk_criancas (cliente_id);

alter table ibk_vendas add column if not exists cliente_id uuid references ibk_clientes(id) on delete set null;
create index if not exists ibk_vendas_cliente on ibk_vendas (cliente_id);

alter table ibk_clientes enable row level security;
alter table ibk_criancas enable row level security;
drop policy if exists admin_tudo on ibk_clientes;
create policy admin_tudo on ibk_clientes for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());
drop policy if exists admin_tudo on ibk_criancas;
create policy admin_tudo on ibk_criancas for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());

-- Quem ja aparece como texto nas vendas vira cliente, uma vez por nome
insert into ibk_clientes (nome, origem)
select distinct on (lower(trim(v.cliente))) trim(v.cliente),
  case when v.canal ilike '%shopee%' then 'shopee' when v.canal ilike '%fisica%' then 'loja' else null end
from ibk_vendas v
where coalesce(trim(v.cliente), '') <> ''
  and not exists (select 1 from ibk_clientes c where lower(c.nome) = lower(trim(v.cliente)))
order by lower(trim(v.cliente)), v.data;

update ibk_vendas v
set cliente_id = c.id
from ibk_clientes c
where v.cliente_id is null
  and coalesce(trim(v.cliente), '') <> ''
  and lower(c.nome) = lower(trim(v.cliente));
