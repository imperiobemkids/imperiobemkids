"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { ajusteEstoque } from "@/lib/estoque";
import { SetupCard } from "../SetupCard";
import { KardexModal } from "./KardexModal";
import { DesdobrarGrade } from "./DesdobrarGrade";

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
  e_grade: boolean;
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
  tamanho: string;
  custo: string;
  qtdAtual: string;
  qtdInicial: string;
  fornecedorId: string;
  estoqueMinimo: string;
};
const formVazio: Form = {
  nome: "", categoria: "", linha: "", genero: "", tamanho: "",
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
  const [desdobrar, setDesdobrar] = useState<Produto | null>(null);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: forns }] = await Promise.all([
      supabase.from("ibk_produtos").select("*").eq("ativo", true).order("created_at", { ascending: false }),
      supabase.from("ibk_fornecedores").select("id, nome").order("nome"),
    ]);
    if (error) setErro(error.message);
    else setRows((data as Produto[]) ?? []);
    setFornecedores((forns as Fornecedor[]) ?? []);
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
      tamanho: form.tamanho.trim() || null,
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
    Ordena para a grade aparecer junta: o pai e, logo abaixo, os tamanhos dele.
    Produtos sem grade seguem soltos na lista.
  */
  const filhosDe = (id: string) => rows.filter((r) => r.produto_pai_id === id);
  const listaOrdenada: { p: Produto; filho: boolean }[] = [];
  for (const r of rows) {
    if (r.produto_pai_id) continue; // entra junto do pai
    listaOrdenada.push({ p: r, filho: false });
    for (const f of filhosDe(r.id).sort((a, b) => (a.tamanho ?? "").localeCompare(b.tamanho ?? "", "pt-BR", { numeric: true }))) {
      listaOrdenada.push({ p: f, filho: true });
    }
  }

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

      {/* tabela */}
      {/*
        Colunas secundarias somem no celular para a tabela caber sem espremer.
        A informacao completa continua na ficha do produto.
      */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
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
          <tbody>
            {loading && (<tr><td colSpan={9} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-[var(--ink)]/50">nenhum produto. clique em "+ Novo produto".</td></tr>
            )}
            {listaOrdenada.map(({ p, filho }) => {
              const giro = p.qtd_inicial > 0 ? Math.round(((p.qtd_inicial - p.qtd_atual) / p.qtd_inicial) * 100) : 0;
              return (
                <tr key={p.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${filho ? "bg-[var(--purple)]/[0.03]" : ""}`}>
                  <td className={`p-3 ${filho ? "pl-8" : ""}`}>
                    <Link href={`/admin/estoque/${p.id}`} className="font-semibold text-[var(--ink)] hover:text-[var(--purple)] hover:underline">
                      {filho ? `tam ${p.tamanho ?? "?"}` : nomeExibido(p)}
                    </Link>
                    {p.e_grade && (
                      <span className="ml-2 rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--purple)]">
                        grade
                      </span>
                    )}
                    <div className="text-xs text-[var(--ink)]/45">
                      {[p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "", p.genero, p.tamanho && `tam ${p.tamanho}`].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="hidden p-3 text-[var(--ink)]/70 lg:table-cell">{p.categoria || "-"}</td>
                  <td className="hidden p-3 text-[var(--ink)]/70 xl:table-cell">{p.fornecedor_id ? fornMap.get(p.fornecedor_id) ?? "-" : "-"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => ajustar(p, -1)} className={stepCls}>−</button>
                      <span className="min-w-[2.6rem] text-center font-bold">{p.qtd_atual}<span className="text-[var(--ink)]/40">/{p.qtd_inicial}</span></span>
                      <button onClick={() => ajustar(p, 1)} className={stepCls}>+</button>
                    </div>
                  </td>
                  <td className="hidden p-3 sm:table-cell">{brl(p.custo_unit)}</td>
                  <td className="hidden p-3 xl:table-cell">{brl(p.custo_unit + INSUMO)}</td>
                  <td className="hidden p-3 md:table-cell">{brl(p.qtd_atual * p.custo_unit)}</td>
                  <td className="hidden p-3 lg:table-cell">{giro}%</td>
                  <td className="p-3">
                    <div className="flex gap-1.5">
                      <Link href={`/admin/estoque/${p.id}`} className="whitespace-nowrap rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                        <span className="sm:hidden">ficha</span>
                        <span className="hidden sm:inline">abrir ficha</span>
                      </Link>
                      {!filho && !p.e_grade && p.qtd_atual > 0 && (
                        <button onClick={() => setDesdobrar(p)} className="hidden whitespace-nowrap rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/50 hover:text-[var(--purple)] lg:block" title="separar por tamanho">
                          tamanhos
                        </button>
                      )}
                      <button onClick={() => setKardex(p)} className="hidden rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/50 hover:text-[var(--purple)] sm:block" title="extrato de movimentações">extrato</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {kardex && (
        <KardexModal produtoId={kardex.id} titulo={nomeExibido(kardex)} onClose={() => setKardex(null)} />
      )}

      {desdobrar && (
        <DesdobrarGrade
          produto={desdobrar}
          onFechar={() => setDesdobrar(null)}
          onPronto={() => { setDesdobrar(null); carregar(); }}
        />
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
              <Campo label="Tamanho">
                <input value={form.tamanho} onChange={(e) => set({ tamanho: e.target.value })} placeholder="ex: 2, P, 6-9m" className={inputCls} />
              </Campo>
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
const stepCls =
  "flex h-7 w-7 items-center justify-center rounded-md bg-[var(--purple)]/8 font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{valor}</div>
    </div>
  );
}
