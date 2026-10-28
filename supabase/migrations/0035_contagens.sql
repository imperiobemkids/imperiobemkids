-- Contagem de estoque (28/10/2026). Idempotente. Rodar no SQL Editor, o arquivo
-- inteiro de uma vez.
--
-- Cada folha de contagem impressa vira uma linha aqui, com a foto do estoque
-- naquela hora: o que e cada linha numerada da folha (produto ou insumo) e
-- quanto o sistema tinha. A tela Contagem lanca o que foi contado no papel,
-- digitado ou lido da foto da folha, e aplica so a DIFERENCA da contagem sobre
-- o saldo atual, para nao desfazer venda feita entre imprimir e lancar.
--
-- linhas:  [{ n, tipo: "produto"|"insumo", id, grupo, produto, tamanho, cor, sistema }]
-- contado: { "<n>": quantidade } rascunho salvo enquanto lanca (celular e PC veem o mesmo)
create table if not exists ibk_contagens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  criada_em timestamptz not null default now(),
  recorte text not null default 'todo o estoque',
  mostrar_sistema boolean not null default true,
  linhas jsonb not null,
  contado jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta', 'aplicada', 'descartada')),
  aplicada_em timestamptz,
  ajustes int
);
create index if not exists ibk_contagens_status on ibk_contagens (status, criada_em desc);

-- mesma regra de acesso do resto do ERP (migration 0013): so administrador
alter table ibk_contagens enable row level security;
drop policy if exists admin_all on ibk_contagens;
create policy admin_all on ibk_contagens for all to authenticated using (ibk_e_admin()) with check (ibk_e_admin());
