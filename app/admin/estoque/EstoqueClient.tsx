"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { ajusteEstoque, grupoDoProduto } from "@/lib/estoque";
import { calcularReposicao, calcularParados, nomeExibido } from "@/lib/reposicao";
import { num, hojeIso, diasAtrasIso } from "@/lib/formato";
import { SetupCard } from "../SetupCard";
import { KardexModal } from "./KardexModal";
import { SkeletonRows } from "../ui";
import { CaretRight } from "@phosphor-icons/react";
import { GradeVariacoes } from "./GradeVariacoes";
import { SaidaSemVenda } from "./SaidaSemVenda";

type Produto = {
  id: string;
  nome: string | null;
  categoria: string | null;
  linha: "verao" | "inverno" | null;
  genero: "menino" | "menina" | "unissex" | null;
  tamanho: string | null;
  custo_unit: number;
  preco_venda: number | null;
  qtd_inicial: number;
  qtd_atual: number;
  fornecedor_id: string | null;
  estoque_minimo: number | null;
  produto_pai_id: string | null;
  cor: string | null;
  tem_variacoes: boolean;
  peso_bruto: number | null;
  comprimento_cm: number | null;
  largura_cm: number | null;
  altura_cm: number | null;
  ativo: boolean;
  created_at: string | null;
};

type Fornecedor = { id: string; nome: string };

const INSUMO = 0.4; // etiqueta + saco por pedido

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);


type Form = {
  nome: string;
  categoria: string;
  linha: string;
  genero: string;
  custo: string;
  qtdAtual: string;
  qtdInicial: string;
  fornecedorId: string;
  estoqueMinimo: string;
};
const formVazio: Form = {
  nome: "", categoria: "", linha: "", genero: "",
  custo: "", qtdAtual: "", qtdInicial: "", fornecedorId: "", estoqueMinimo: "3",
};

export function EstoqueClient() {
  const [rows, setRows] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Form>(formVazio);
  const [kardex, setKardex] = useState<Produto | null>(null);
  const [vendidos30, setVendidos30] = useState<Map<string, number>>(new Map()); // produto_id -> unidades nos ultimos 30 dias
  const [ultimaVenda, setUltimaVenda] = useState<Map<string, string>>(new Map()); // produto pai (ou simples) -> data da ultima venda
  const [reposicaoAberta, setReposicaoAberta] = useState(false);
  const [saidaAberta, setSaidaAberta] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set()); // grades abertas
  // filtros da tabela, no mesmo formato da tela de Vendas
  const [filtroSit, setFiltroSit] = useState<"todos" | Situacao>("todos");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroGenero, setFiltroGenero] = useState("todos");
  const [filtroParado, setFiltroParado] = useState(0); // 0 = todos; 30, 60, 90 = sem venda ha pelo menos N dias
  const [legenda, setLegenda] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: forns }, { data: itens }, { data: todas }] = await Promise.all([
      supabase.from("ibk_produtos").select("*").eq("ativo", true).order("created_at", { ascending: false }),
      supabase.from("ibk_fornecedores").select("id, nome").not("status", "in", "(pista,descartado)").order("nome"),
      // giro: unidades vendidas por produto nos ultimos 30 dias (sem cancelada/devolvida)
      supabase
        .from("ibk_venda_itens")
        .select("produto_id, qtd, venda:ibk_vendas!inner(data, status)")
        .gte("venda.data", diasAtrasIso(30))
        .not("venda.status", "in", '("cancelado","devolvido")'),
      // ultima venda de cada produto, de todo o historico, para o estoque parado (paginado: o limite e 1000 linhas)
      buscarTodos((de, ate) =>
        supabase!
          .from("ibk_venda_itens")
          .select("produto_id, produto:ibk_produtos(produto_pai_id), venda:ibk_vendas!inner(data, status)")
          .not("venda.status", "in", '("cancelado","devolvido")')
          .order("id")
          .range(de, ate),
      ),
    ]);
    if (error) setErro(error.message);
    else setRows((data as Produto[]) ?? []);
    setFornecedores((forns as Fornecedor[]) ?? []);
    const m = new Map<string, number>();
    for (const it of (itens as { produto_id: string | null; qtd: number }[]) ?? []) {
      if (it.produto_id) m.set(it.produto_id, (m.get(it.produto_id) ?? 0) + it.qtd);
    }
    setVendidos30(m);
    const u = new Map<string, string>();
    type ItemHist = { produto_id: string | null; produto: { produto_pai_id: string | null } | null; venda: { data: string } | null };
    for (const it of (todas as unknown as ItemHist[]) ?? []) {
      const chave = it.produto?.produto_pai_id ?? it.produto_id;
      const d = it.venda?.data?.slice(0, 10);
      if (chave && d && (u.get(chave) ?? "") < d) u.set(chave, d);
    }
    setUltimaVenda(u);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  // o modal cadastra produto novo; a edicao completa acontece na ficha (/admin/estoque/[id])
  const abrirNovo = () => { setForm(formVazio); setErro(""); setAberto(true); };

  const salvar = async () => {
    if (!supabase) return;
    const custo = num(form.custo);
    const qtdAtual = parseInt(form.qtdAtual, 10) || 0;
    const qtdInicial = form.qtdInicial.trim() ? parseInt(form.qtdInicial, 10) || 0 : qtdAtual;
    if (!form.nome.trim() && !form.linha) {
      setErro("dê um nome ao produto (ou preencha linha/gênero)");
      return;
    }
    if (!custo) { setErro("informe o custo"); return; }
    setErro(""); setSalvando(true);
    const payload = {
      nome: form.nome.trim() || null,
      categoria: form.categoria.trim() || null,
      linha: form.linha || null,
      genero: form.genero || null,
      custo_unit: custo,
      qtd_atual: qtdAtual,
      qtd_inicial: qtdInicial,
      fornecedor_id: form.fornecedorId || null,
      estoque_minimo: parseInt(form.estoqueMinimo, 10) || 0,
    };
    const res = await supabase.from("ibk_produtos").insert(payload).select("id").single();
    // registra o saldo inicial no kardex
    if (!res.error && res.data) {
      await supabase.from("ibk_estoque_mov").insert({
        produto_id: (res.data as { id: string }).id,
        tipo: "entrada", origem: "inicial", qtd: qtdAtual, custo_unit: custo,
        saldo_depois: qtdAtual, custo_medio_depois: custo, obs: "cadastro manual", data: hojeIso(),
      });
    }
    setSalvando(false);
    if (res.error) { setErro(res.error.message); return; }
    setAberto(false);
    carregar();
  };

  const alternarGrade = (id: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ajustar = async (p: Produto, delta: number) => {
    if (!supabase) return;
    const novo = Math.max(0, p.qtd_atual + delta);
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, qtd_atual: novo } : x)));
    try {
      await ajusteEstoque(p.id, novo, delta > 0 ? "ajuste manual (+)" : "ajuste manual (-)");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "erro no ajuste");
      carregar();
    }
  };

  /*
    A lista mostra so o produto pai (ou avulso). Quem tem variacoes soma as
    quantidades das filhas na propria linha e abre uma grade tamanho x tipo
    embaixo, fechada por padrao: 18 linhas de variacao viravam parede.
  */
  const ordenaTam = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "", "pt-BR", { numeric: true });
  const filhosDe = (id: string) => rows.filter((r) => r.produto_pai_id === id).sort((a, b) => ordenaTam(a.tamanho, b.tamanho) || ordenaTam(a.cor, b.cor));
  const listaOrdenada = rows
    .filter((r) => !r.produto_pai_id)
    .map((r) => {
      const filhos = filhosDe(r.id);
      if (filhos.length === 0) return { p: r, filhos, agregado: r };
      const agregado: Produto = {
        ...r,
        qtd_atual: filhos.reduce((s, f) => s + f.qtd_atual, 0),
        qtd_inicial: filhos.reduce((s, f) => s + f.qtd_inicial, 0),
        custo_unit: r.custo_unit || filhos[0].custo_unit,
      };
      return { p: r, filhos, agregado };
    });

  // reposicao: mesma regra do Painel (lib/reposicao)
  const reposicao = calcularReposicao(rows, vendidos30);

  /*
    Situacao de cada linha da tabela, exclusiva como o status da venda:
    esgotado (somou zero), repor (ele ou alguma variacao caiu na Reposicao) ou ok.
  */
  const idsRepor = new Set(reposicao.map((r) => r.p.id));
  const situacaoDe = ({ p, filhos, agregado }: (typeof listaOrdenada)[number]): Situacao =>
    agregado.qtd_atual === 0 ? "esgotado" : idsRepor.has(p.id) || filhos.some((f) => idsRepor.has(f.id)) ? "repor" : "ok";
  // estoque parado: dias sem venda por produto (variacoes somadas), a mesma regra do Painel
  const parados = new Map(calcularParados(rows, ultimaVenda, hojeIso()).map((x) => [x.id, x]));
  const comSituacao = listaOrdenada.map((l) => ({ ...l, situacao: situacaoDe(l), grupo: grupoDoProduto(l.p), parado: parados.get(l.p.id) ?? null }));
  const contar = <K extends "situacao" | "grupo">(k: K, v: string) => comSituacao.filter((l) => l[k] === v).length;
  const grupos = [...new Set(comSituacao.map((l) => l.grupo))].sort((a, b) => contar("grupo", b) - contar("grupo", a));
  const generos = (["menina", "menino", "unissex"] as const).filter((g) => comSituacao.some((l) => l.p.genero === g));
  const visiveis = comSituacao
    .filter((l) => filtroSit === "todos" || l.situacao === filtroSit)
    .filter((l) => filtroGrupo === "todos" || l.grupo === filtroGrupo)
    .filter((l) => filtroGenero === "todos" || l.p.genero === filtroGenero)
    .filter((l) => filtroParado === 0 || (l.parado !== null && l.parado.dias >= filtroParado));
  const filtrando = filtroSit !== "todos" || filtroGrupo !== "todos" || filtroGenero !== "todos" || filtroParado > 0;

  const unidades = rows.reduce((s, p) => s + p.qtd_atual, 0);
  const valorEstoque = rows.reduce((s, p) => s + p.qtd_atual * p.custo_unit, 0);
  const fornMap = new Map(fornecedores.map((f) => [f.id, f.nome]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Estoque
          </h1>
          <p className="text-sm text-[var(--ink)]/70">Custo posto = custo + insumo/pedido ({brl(INSUMO)}). Preços ficam em Precificação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Kpi titulo="Unidades" valor={String(unidades)} />
          <Kpi titulo="Valor em estoque" valor={brl(valorEstoque)} />
          <button onClick={() => setSaidaAberta((v) => !v)} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple-dark)] transition-colors hover:bg-[var(--purple)]/15">
            Saída sem venda
          </button>
          <button onClick={abrirNovo} className="rounded-xl bg-[var(--purple)] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]">
            + Novo produto
          </button>
        </div>
      </div>

      {erro && !aberto && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* presente, uso em video, perda: sai do estoque pelo custo, sem venda; o historico abre junto */}
      {saidaAberta && <SaidaSemVenda produtos={rows} onFeito={carregar} onFechar={() => setSaidaAberta(false)} />}

      {/* reposicao */}
      {!loading && reposicao.length > 0 && (
        <div className={`card mt-5 border-2 ${reposicao.some((r) => r.p.qtd_atual === 0 && r.giro > 0) ? "border-red-300" : "border-[var(--sun)]"}`}>
          <button onClick={() => setReposicaoAberta((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Reposição <span className="num rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-xs text-[var(--purple)]">{reposicao.length}</span>
            </span>
            <span className="text-xs font-bold text-[var(--purple)]">{reposicaoAberta ? "esconder" : "ver o que comprar"}</span>
          </button>
          {reposicaoAberta && (
            <div className="overflow-x-auto border-t border-[var(--purple)]/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-[11px] uppercase text-[var(--ink)]/70">
                    <th className="p-3 text-left">Produto</th>
                    <th className="p-3 text-right">Estoque</th>
                    <th className="p-3 text-right">Mínimo</th>
                    <th className="p-3 text-right">Vendidos 30d</th>
                    <th className="p-3 text-right">Dura</th>
                    <th className="p-3 text-right">Comprar</th>
                    <th className="p-3 text-left">Fornecedor</th>
                  </tr>
                </thead>
                <tbody className="cascata">
                  {reposicao.map((r) => (
                    <tr key={r.p.id} className="border-t border-[var(--purple)]/6">
                      <td className="p-3 font-semibold">{r.nome}</td>
                      <td className={`num p-3 text-right font-bold ${r.p.qtd_atual === 0 ? "text-red-500" : "text-[var(--ink)]"}`}>{r.p.qtd_atual}</td>
                      <td className="num p-3 text-right text-[var(--ink)]/70">{r.minimo || "-"}</td>
                      <td className="num p-3 text-right">{r.giro || "-"}</td>
                      <td className={`num p-3 text-right ${r.dias !== null && r.dias < 7 ? "text-red-500 font-bold" : "text-[var(--ink)]/70"}`}>
                        {r.dias === null ? "-" : r.p.qtd_atual === 0 ? "acabou" : `${r.dias}d`}
                      </td>
                      <td className="num p-3 text-right font-extrabold text-[var(--purple-dark)]">{r.comprar}</td>
                      <td className="p-3 text-[var(--ink)]/70">{r.fornecedor ? fornMap.get(r.fornecedor) ?? "-" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-[var(--ink)]/70">
                <span>entra quem está zerado, abaixo do mínimo ou com menos de 15 dias de estoque pelo giro. Sugestão = cobrir 30 dias de venda com folga (1,5x) ou voltar ao dobro do mínimo. Variação sem mínimo próprio rateia o mínimo do produto.</span>
                <Link href="/admin/compras" className="font-bold text-[var(--purple)] hover:underline">registrar compra</Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* filtros: situacao, linha e genero se combinam, como entrega e pagamento em Vendas */}
      {!loading && rows.length > 0 && (
        <div className="mt-5 flex flex-col gap-1.5">
          <LinhaFiltro rotulo="Situação">
            <Filtro ativo={filtroSit === "todos"} n={comSituacao.length} onClick={() => setFiltroSit("todos")}>todos</Filtro>
            {(["ok", "repor", "esgotado"] as Situacao[]).map((k) => {
              const n = contar("situacao", k);
              if (n === 0 && filtroSit !== k) return null;
              return (
                <Filtro key={k} ativo={filtroSit === k} n={n} onClick={() => setFiltroSit(k)}>
                  {SITUACAO[k].rotulo}
                </Filtro>
              );
            })}
            <button onClick={() => setLegenda((l) => !l)} className="ml-1 text-xs font-bold text-[var(--purple)] underline-offset-2 hover:underline" aria-expanded={legenda}>
              {legenda ? "esconder legenda" : "o que significa?"}
            </button>
          </LinhaFiltro>
          <LinhaFiltro rotulo="Linha">
            <Filtro ativo={filtroGrupo === "todos"} n={comSituacao.length} onClick={() => setFiltroGrupo("todos")}>todas</Filtro>
            {grupos.map((g) => (
              <Filtro key={g} ativo={filtroGrupo === g} n={contar("grupo", g)} onClick={() => setFiltroGrupo(g)}>
                {g}
              </Filtro>
            ))}
          </LinhaFiltro>
          {generos.length > 1 && (
            <LinhaFiltro rotulo="Gênero">
              <Filtro ativo={filtroGenero === "todos"} n={comSituacao.length} onClick={() => setFiltroGenero("todos")}>todos</Filtro>
              {generos.map((g) => (
                <Filtro key={g} ativo={filtroGenero === g} n={comSituacao.filter((l) => l.p.genero === g).length} onClick={() => setFiltroGenero(g)}>
                  {g}
                </Filtro>
              ))}
            </LinhaFiltro>
          )}
          <LinhaFiltro rotulo="Sem venda">
            <Filtro ativo={filtroParado === 0} n={comSituacao.length} onClick={() => setFiltroParado(0)}>todos</Filtro>
            {[30, 60, 90].map((d) => (
              <Filtro key={d} ativo={filtroParado === d} n={comSituacao.filter((l) => l.parado && l.parado.dias >= d).length} onClick={() => setFiltroParado(d)}>
                há {d}+ dias
              </Filtro>
            ))}
          </LinhaFiltro>
          {legenda && (
            <div className="fade-in grid gap-3 rounded-xl bg-white/70 p-3 text-xs sm:grid-cols-2">
              <ul className="space-y-1">
                {(Object.keys(SITUACAO) as Situacao[]).map((k) => (
                  <li key={k}>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${SITUACAO[k].cor}`}>{SITUACAO[k].rotulo}</span>{" "}
                    {SITUACAO[k].explica}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1 text-[var(--ink)]/80">
                <li><b>Qtd 8/11:</b> 8 em estoque agora, de 11 que entraram.</li>
                <li><b>Giro:</b> quanto do que entrou já saiu (vendido, presente, ajuste).</li>
                <li><b>Sem venda:</b> dias desde a última venda do produto; com * conta desde que entrou, porque nunca vendeu. Amarelo a partir de 30 dias, vermelho a partir de 60.</li>
                <li><b>Custo posto:</b> custo da peça mais a embalagem do pedido.</li>
                <li><b>Var.:</b> produto com grade de tamanho e tipo; clique para abrir.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* tabela */}
      {/*
        Colunas secundarias somem no celular para a tabela caber sem espremer.
        A informacao completa continua na ficha do produto.
      */}
      <div className="mt-3 overflow-x-auto card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Produto{filtrando && <span className="ml-1.5 normal-case text-[var(--ink)]/60">({visiveis.length} de {comSituacao.length})</span>}</th>
              <th className="hidden p-3 lg:table-cell">Categoria</th>
              <th className="hidden p-3 xl:table-cell">Fornecedor</th>
              <th className="p-3">Qtd</th>
              <th className="hidden p-3 sm:table-cell">Custo/un</th>
              <th className="hidden p-3 xl:table-cell">Custo posto</th>
              <th className="hidden p-3 md:table-cell">Em estoque</th>
              <th className="hidden p-3 lg:table-cell">Giro</th>
              <th className="hidden p-3 lg:table-cell">Sem venda</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={10} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-[var(--ink)]/70">nenhum produto. clique em "+ Novo produto".</td></tr>
            )}
            {!loading && rows.length > 0 && visiveis.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-[var(--ink)]/70">nada com esses filtros.</td></tr>
            )}
            {visiveis.map(({ p, filhos, agregado, situacao, parado }) => {
              const a = agregado;
              const temGrade = filhos.length > 0;
              const aberta = abertos.has(p.id);
              const giro = a.qtd_inicial > 0 ? Math.round(((a.qtd_inicial - a.qtd_atual) / a.qtd_inicial) * 100) : 0;
              const zeradas = filhos.filter((f) => f.qtd_atual === 0).length;
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-[var(--purple)]/6 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {temGrade && (
                          <button onClick={() => alternarGrade(p.id)} aria-label={aberta ? "fechar grade" : "abrir grade"} className="rounded-md p-0.5 text-[var(--purple)] hover:bg-[var(--purple)]/10">
                            <CaretRight size={14} weight="bold" className={`transition-transform duration-200 ${aberta ? "rotate-90" : ""}`} />
                          </button>
                        )}
                        <Link href={`/admin/estoque/${p.id}`} className="font-semibold text-[var(--ink)] hover:text-[var(--purple)] hover:underline">
                          {nomeExibido(p)}
                        </Link>
                        {temGrade && (
                          <button onClick={() => alternarGrade(p.id)} className="num rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--purple)] hover:bg-[var(--purple)]/20">
                            {filhos.length} var.{zeradas > 0 && <span className="ml-1 text-red-500">{zeradas} zeradas</span>}
                          </button>
                        )}
                        {situacao !== "ok" && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${SITUACAO[situacao].cor}`}>{SITUACAO[situacao].rotulo}</span>
                        )}
                      </div>
                      <div className={`text-xs text-[var(--ink)]/70 ${temGrade ? "pl-5" : ""}`}>
                        {[p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "", p.genero, !temGrade && p.tamanho && `tam ${p.tamanho}`].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="hidden p-3 text-[var(--ink)]/70 lg:table-cell">{p.categoria || "-"}</td>
                    <td className="hidden p-3 text-[var(--ink)]/70 xl:table-cell">{p.fornecedor_id ? fornMap.get(p.fornecedor_id) ?? "-" : "-"}</td>
                    <td className="p-3">
                      {temGrade ? (
                        <button onClick={() => alternarGrade(p.id)} className="num min-w-[2.6rem] text-left font-bold hover:text-[var(--purple)]">
                          {a.qtd_atual}<span className="text-[var(--ink)]/65">/{a.qtd_inicial}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => ajustar(p, -1)} className={stepCls}>−</button>
                          <span className="num min-w-[2.6rem] text-center font-bold">{p.qtd_atual}<span className="text-[var(--ink)]/65">/{p.qtd_inicial}</span></span>
                          <button onClick={() => ajustar(p, 1)} className={stepCls}>+</button>
                        </div>
                      )}
                    </td>
                    <td className="num hidden p-3 sm:table-cell">{brl(a.custo_unit)}</td>
                    <td className="num hidden p-3 xl:table-cell">{brl(a.custo_unit + INSUMO)}</td>
                    <td className="num hidden p-3 md:table-cell">{brl(temGrade ? filhos.reduce((s, f) => s + f.qtd_atual * f.custo_unit, 0) : a.qtd_atual * a.custo_unit)}</td>
                    <td className="num hidden p-3 lg:table-cell">{giro}%</td>
                    <td
                      className={`num hidden whitespace-nowrap p-3 lg:table-cell ${parado && parado.dias >= 60 ? "font-bold text-red-600" : parado && parado.dias >= 30 ? "font-bold text-amber-700" : "text-[var(--ink)]/70"}`}
                      title={parado ? (parado.ultimaVenda ? `última venda em ${parado.ultimaVenda.split("-").reverse().join("/")}` : "nunca vendeu") : "sem peça em estoque"}
                    >
                      {parado ? `${parado.dias} dias${parado.ultimaVenda ? "" : "*"}` : "-"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5">
                        <Link href={`/admin/estoque/${p.id}`} className="whitespace-nowrap rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                          <span className="sm:hidden">ficha</span>
                          <span className="hidden sm:inline">abrir ficha</span>
                        </Link>
                        {!temGrade && (
                          <button onClick={() => setKardex(p)} className="hidden rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/70 hover:text-[var(--purple)] sm:block" title="extrato de movimentações">extrato</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {temGrade && aberta && (
                    <tr className="border-b border-[var(--purple)]/6 bg-[var(--purple)]/[0.03]">
                      <td colSpan={10} className="px-3 pb-3 pt-1">
                        <GradeVariacoes filhos={filhos} minimo={p.estoque_minimo ?? 0} onAjustar={ajustar} onExtrato={setKardex} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {kardex && (
        <KardexModal produtoId={kardex.id} titulo={nomeExibido(kardex)} onClose={() => setKardex(null)} />
      )}

      {/* modal cadastro/edicao */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAberto(false)}>
          <div className="mt-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              Novo produto
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Campo label="Nome do produto">
                  <input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="ex: Conjunto moletom dino" className={inputCls} />
                </Campo>
              </div>
              <Campo label="Categoria">
                <input value={form.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="ex: Conjunto, Body, Calçado" className={inputCls} />
              </Campo>
              <div className="col-span-2 rounded-xl bg-[var(--purple)]/6 p-3 text-xs leading-relaxed text-[var(--ink)]/70">
                Tamanho e cor não entram aqui: depois de salvar, abra a ficha do produto e use a
                aba Variações para criar cada tamanho e cor com estoque próprio.
              </div>
              <Campo label="Linha (opcional)">
                <select value={form.linha} onChange={(e) => set({ linha: e.target.value })} className={inputCls}>
                  <option value="">nenhuma</option>
                  <option value="verao">Verão</option>
                  <option value="inverno">Inverno</option>
                </select>
              </Campo>
              <Campo label="Gênero (opcional)">
                <select value={form.genero} onChange={(e) => set({ genero: e.target.value })} className={inputCls}>
                  <option value="">nenhum</option>
                  <option value="menino">Menino</option>
                  <option value="menina">Menina</option>
                  <option value="unissex">Unissex</option>
                </select>
              </Campo>
              <Campo label="Custo por unidade">
                <input value={form.custo} onChange={(e) => set({ custo: e.target.value })} placeholder="14,90" className={inputCls} />
              </Campo>
              <Campo label="Fornecedor">
                <select value={form.fornecedorId} onChange={(e) => set({ fornecedorId: e.target.value })} className={inputCls}>
                  <option value="">{fornecedores.length ? "sem fornecedor" : "cadastre em Fornecedores"}</option>
                  {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                </select>
              </Campo>
              <Campo label="Qtd atual">
                <input value={form.qtdAtual} onChange={(e) => set({ qtdAtual: e.target.value })} placeholder="10" className={inputCls} />
              </Campo>
              <Campo label="Qtd inicial (comprada)">
                <input value={form.qtdInicial} onChange={(e) => set({ qtdInicial: e.target.value })} placeholder="igual à atual" className={inputCls} />
              </Campo>
              <Campo label="Alertar quando sobrar">
                <input value={form.estoqueMinimo} onChange={(e) => set({ estoqueMinimo: e.target.value })} placeholder="3" className={inputCls} />
              </Campo>
            </div>

            {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={salvar} disabled={salvando} className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
                {salvando ? "salvando..." : "salvar"}
              </button>
              <button onClick={() => setAberto(false)} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)]">cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Situacao = "ok" | "repor" | "esgotado";
const SITUACAO: Record<Situacao, { rotulo: string; cor: string; explica: string }> = {
  ok: { rotulo: "estoque ok", cor: "bg-emerald-100 text-emerald-700", explica: "tem peça e não está acabando" },
  repor: { rotulo: "repor", cor: "bg-amber-100 text-amber-800", explica: "abaixo do mínimo ou acabando pelo giro de 30 dias (a mesma regra da Reposição)" },
  esgotado: { rotulo: "esgotado", cor: "bg-red-100 text-red-600", explica: "zerou: nenhuma peça, somando todas as variações" },
};

function LinhaFiltro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 text-[10px] font-bold uppercase text-[var(--ink)]/70">{rotulo}</span>
      {children}
    </div>
  );
}

function Filtro({ ativo, n, onClick, children }: { ativo: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${ativo ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"}`}
    >
      {children} <span className="num opacity-60">{n}</span>
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";
const stepCls =
  "flex h-7 w-7 items-center justify-center rounded-md bg-[var(--purple)]/8 font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}
function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{titulo}</div>
      <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{valor}</div>
    </div>
  );
}
