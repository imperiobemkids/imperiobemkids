"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { ajusteEstoque } from "@/lib/estoque";
import { SetupCard } from "../SetupCard";
import { KardexModal } from "./KardexModal";
import { SkeletonRows } from "../ui";
import { CaretRight } from "@phosphor-icons/react";

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
};

type Fornecedor = { id: string; nome: string };

const INSUMO = 0.4; // etiqueta + saco por pedido

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const nomeExibido = (p: Produto) => {
  if (p.nome && p.nome.trim()) return p.nome.trim();
  const linha = p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "";
  const base = [linha, p.genero].filter(Boolean).join(" ");
  return base || "Produto";
};

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
  const [reposicaoAberta, setReposicaoAberta] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const [{ data, error }, { data: forns }, { data: itens }] = await Promise.all([
      supabase.from("ibk_produtos").select("*").eq("ativo", true).order("created_at", { ascending: false }),
      supabase.from("ibk_fornecedores").select("id, nome").order("nome"),
      // giro: unidades vendidas por produto nos ultimos 30 dias (sem cancelada/devolvida)
      supabase
        .from("ibk_venda_itens")
        .select("produto_id, qtd, venda:ibk_vendas!inner(data, status)")
        .gte("venda.data", desde.toISOString().slice(0, 10))
        .not("venda.status", "in", '("cancelado","devolvido")'),
    ]);
    if (error) setErro(error.message);
    else setRows((data as Produto[]) ?? []);
    setFornecedores((forns as Fornecedor[]) ?? []);
    const m = new Map<string, number>();
    for (const it of (itens as { produto_id: string | null; qtd: number }[]) ?? []) {
      if (it.produto_id) m.set(it.produto_id, (m.get(it.produto_id) ?? 0) + it.qtd);
    }
    setVendidos30(m);
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
    const custo = parseFloat(form.custo.replace(",", ".")) || 0;
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
        saldo_depois: qtdAtual, custo_medio_depois: custo, obs: "cadastro manual",
      });
    }
    setSalvando(false);
    if (res.error) { setErro(res.error.message); return; }
    setAberto(false);
    carregar();
  };

  const [abertos, setAbertos] = useState<Set<string>>(new Set());
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

  /*
    Reposicao: o que esta abaixo do minimo ou zerado, com o giro dos ultimos
    30 dias. Sugestao de compra = o que falta pra cobrir 30 dias de venda com
    folga (1,5x) ou pra voltar ao dobro do minimo, o que for maior.
  */
  const reposicao = rows
    .filter((p) => !p.tem_variacoes)
    .map((p) => {
      // variacao: o minimo do pai e do produto inteiro, entao rateia entre as variacoes
      // (nunca abaixo de 1). O gerador copiou o minimo do pai em cada variacao; valor
      // igual ao do pai conta como herdado, so um valor diferente e proprio da variacao.
      const pai0 = p.produto_pai_id ? rows.find((x) => x.id === p.produto_pai_id) : null;
      const irmas = pai0 ? rows.filter((x) => x.produto_pai_id === pai0.id).length || 1 : 1;
      const proprio = pai0 && p.estoque_minimo != null && p.estoque_minimo !== (pai0.estoque_minimo ?? null);
      const minimo = pai0 ? (proprio ? p.estoque_minimo! : Math.max(1, Math.ceil((pai0.estoque_minimo ?? 0) / irmas))) : (p.estoque_minimo ?? 0);
      const giro = vendidos30.get(p.id) ?? 0;
      const alvo = Math.max(Math.ceil(giro * 1.5), minimo * 2, giro > 0 || minimo > 0 ? 1 : 0);
      const comprar = Math.max(0, alvo - p.qtd_atual);
      const pai = p.produto_pai_id ? rows.find((x) => x.id === p.produto_pai_id) : null;
      const nome = pai ? `${nomeExibido(pai)} · ${[p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ")}` : nomeExibido(p);
      const dias = giro > 0 ? Math.floor(p.qtd_atual / (giro / 30)) : null;
      return { p, nome, minimo, giro, comprar, dias, fornecedor: (pai ?? p).fornecedor_id };
    })
    .filter((r) => r.p.qtd_atual === 0 || r.p.qtd_atual < r.minimo || (r.dias !== null && r.dias < 15))
    .filter((r) => r.comprar > 0 || r.p.qtd_atual === 0)
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999) || a.p.qtd_atual - b.p.qtd_atual);

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
          <button onClick={abrirNovo} className="rounded-xl bg-[var(--purple)] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]">
            + Novo produto
          </button>
        </div>
      </div>

      {erro && !aberto && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

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

      {/* tabela */}
      {/*
        Colunas secundarias somem no celular para a tabela caber sem espremer.
        A informacao completa continua na ficha do produto.
      */}
      <div className="mt-5 overflow-x-auto card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Produto</th>
              <th className="hidden p-3 lg:table-cell">Categoria</th>
              <th className="hidden p-3 xl:table-cell">Fornecedor</th>
              <th className="p-3">Qtd</th>
              <th className="hidden p-3 sm:table-cell">Custo/un</th>
              <th className="hidden p-3 xl:table-cell">Custo posto</th>
              <th className="hidden p-3 md:table-cell">Em estoque</th>
              <th className="hidden p-3 lg:table-cell">Giro</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={9} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-[var(--ink)]/70">nenhum produto. clique em "+ Novo produto".</td></tr>
            )}
            {listaOrdenada.map(({ p, filhos, agregado }) => {
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
                      <td colSpan={9} className="px-3 pb-3 pt-1">
                        <Grade filhos={filhos} minimo={p.estoque_minimo ?? 0} onAjustar={ajustar} onExtrato={setKardex} />
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

const inputCls =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";
/*
  Grade tamanho x tipo (a coluna "cor" guarda o tipo do kit: 2, 4, 6 pecas).
  Cada celula e a variacao: quantidade com mais e menos, vermelho zerada,
  amarelo no minimo. Um so tipo vira uma linha de tamanhos; um so tamanho,
  uma linha de tipos.
*/
function Grade({
  filhos,
  minimo,
  onAjustar,
  onExtrato,
}: {
  filhos: Produto[];
  minimo: number;
  onAjustar: (p: Produto, delta: number) => void;
  onExtrato: (p: Produto) => void;
}) {
  const ordena = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
  const tamanhos = [...new Set(filhos.map((f) => f.tamanho ?? ""))].sort(ordena);
  const tipos = [...new Set(filhos.map((f) => f.cor ?? ""))].sort(ordena);
  const celula = (t: string, c: string) => filhos.find((f) => (f.tamanho ?? "") === t && (f.cor ?? "") === c);
  const umTipo = tipos.length === 1;

  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase text-[var(--ink)]/70">
            <th className="px-2 py-1 text-left">{umTipo ? "" : "tam \\ tipo"}</th>
            {(umTipo ? tamanhos : tipos).map((h) => (
              <th key={h} className="px-2 py-1 text-center">{h || "-"}</th>
            ))}
            <th className="px-2 py-1 text-right text-[var(--ink)]/60">total</th>
          </tr>
        </thead>
        <tbody>
          {(umTipo ? [tipos[0]] : tamanhos).map((linha) => {
            const colunas = umTipo ? tamanhos : tipos;
            const itens = colunas.map((col) => (umTipo ? celula(col, linha) : celula(linha, col)));
            const total = itens.reduce((s, f) => s + (f?.qtd_atual ?? 0), 0);
            return (
              <tr key={linha} className="border-t border-[var(--purple)]/8">
                <td className="whitespace-nowrap px-2 py-1 font-bold text-[var(--purple-dark)]">{umTipo ? (linha || "tamanhos") : `tam ${linha || "-"}`}</td>
                {itens.map((f, i) => (
                  <td key={i} className="px-1 py-1 text-center">
                    {f ? (
                      <div
                        className={`inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5 ${
                          f.qtd_atual === 0 ? "bg-red-100 text-red-700" : f.qtd_atual <= minimo ? "bg-[var(--sun)]/50 text-[var(--ink)]" : "bg-white text-[var(--ink)]"
                        }`}
                      >
                        <button onClick={() => onAjustar(f, -1)} aria-label="menos um" className="h-8 w-8 rounded-md text-base text-[var(--purple)] hover:bg-[var(--purple)]/10">−</button>
                        <button onClick={() => onExtrato(f)} title="extrato desta variação" className="num min-w-[1.6rem] text-center text-sm font-extrabold hover:underline">{f.qtd_atual}</button>
                        <button onClick={() => onAjustar(f, 1)} aria-label="mais um" className="h-8 w-8 rounded-md text-base text-[var(--purple)] hover:bg-[var(--purple)]/10">+</button>
                      </div>
                    ) : (
                      <span className="text-[var(--ink)]/20">·</span>
                    )}
                  </td>
                ))}
                <td className="num px-2 py-1 text-right font-bold text-[var(--ink)]/60">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 text-[11px] text-[var(--ink)]/70">clique no número pra ver o extrato da variação; a ficha de cada uma abre pela ficha do produto.</div>
    </div>
  );
}

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
