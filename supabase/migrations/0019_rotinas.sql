-- Rotinas diarias por area (board semanal em /admin/tarefas).
--
-- ibk_rotinas: o que se repete e em quais dias da semana (1 = segunda ... 7 = domingo).
-- ibk_rotina_checks: marcacao de "feito" por rotina e por data. Nao apaga historico
-- ao editar a rotina: a linha some da grade, a marcacao passada continua guardada.
-- Idempotente. Rodar no SQL Editor.

create table if not exists ibk_rotinas (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  titulo text not null,
  dias smallint[] not null default '{1,2,3,4,5}',
  ordem int not null default 0,
  ativo boolean not null default true,
  obs text,
  created_at timestamptz not null default now()
);

create table if not exists ibk_rotina_checks (
  rotina_id uuid not null references ibk_rotinas(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now(),
  primary key (rotina_id, data)
);

create index if not exists ibk_rotina_checks_data on ibk_rotina_checks (data);

alter table ibk_rotinas enable row level security;
alter table ibk_rotina_checks enable row level security;

drop policy if exists admin_tudo on ibk_rotinas;
create policy admin_tudo on ibk_rotinas for all to authenticated
  using (ibk_e_admin()) with check (ibk_e_admin());

drop policy if exists admin_tudo on ibk_rotina_checks;
create policy admin_tudo on ibk_rotina_checks for all to authenticated
  using (ibk_e_admin()) with check (ibk_e_admin());

-- Ponto de partida: uma rotina por area para a grade nao nascer vazia.
-- Edite ou apague pelo painel.
insert into ibk_rotinas (area, titulo, dias, ordem)
select * from (values
  ('Marketing',  'Postar no TikTok e Instagram',        '{1,2,3,4,5,6,7}'::smallint[], 1),
  ('Marketing',  'Mandar promo no grupo de achadinhos',  '{2,4,6}'::smallint[],         2),
  ('Estoques',   'Conferir saldo e separar pedidos',     '{1,2,3,4,5,6}'::smallint[],   1),
  ('Vendas',     'Responder chat da Shopee e WhatsApp',  '{1,2,3,4,5,6,7}'::smallint[], 1),
  ('Financeiro', 'Lancar vendas e despesas do dia',      '{1,2,3,4,5,6}'::smallint[],   1)
) as v(area, titulo, dias, ordem)
where not exists (select 1 from ibk_rotinas);
