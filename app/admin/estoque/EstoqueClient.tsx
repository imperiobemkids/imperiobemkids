"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Produto = {
  id: string;
  linha: "verao" | "inverno";
  genero: "menino" | "menina" | "unissex";
  tamanho: string | null;
  descricao: string | null;
  custo_unit: number;
  qtd_inicial: number;
  qtd_atual: number;
  fornecedor_id: string | null;
  custo_posto: number;
  valor_estoque: number;
  sell_through: number;
};

type Fornecedor = { id: string; nome: string };

// Insumo por pedido (etiqueta + saco). Deve bater com a view no banco.
const INSUMO = 0.4;
const TAXA = 0.2;
// Preco alvo avulso por linha (ver analise de precificacao)
const PRECO_ALVO: Record<Produto["linha"], number> = { verao: 34.9, inverno: 49.9 };

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const label = (p: Produto) =>
  `${p.linha === "verao" ? "Verão" : "Inverno"} · ${p.genero}${p.tamanho ? " · " + p.tamanho : ""}`;

export function EstoqueClient() {
  const [rows, setRows] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // form de novo SKU
  const [linha, setLinha] = useState<Produto["linha"]>("verao");
  const [genero, setGenero] = useState<Produto["genero"]>("menino");
  const [tamanho, setTamanho] = useState("");
  const [custo, setCusto] = useState("");
  const [qtd, setQtd] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: forns }] = await Promise.all([
      supabase
        .from("ibk_v_estoque")
        .select("*")
        .order("linha", { ascending: true })
        .order("genero", { ascending: true })
        .order("tamanho", { ascending: true }),
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

  const adicionar = async () => {
    if (!supabase) return;
    const c = parseFloat(custo.replace(",", "."));
    const q = parseInt(qtd, 10);
    if (!c || !q) {
      setErro("informe custo e quantidade");
      return;
    }
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("ibk_produtos").insert({
      linha,
      genero,
      tamanho: tamanho.trim() || null,
      custo_unit: c,
      qtd_inicial: q,
      qtd_atual: q,
      fornecedor_id: fornecedorId || null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTamanho("");
    setCusto("");
    setQtd("");
    carregar();
  };

  const ajustar = async (p: Produto, delta: number) => {
    if (!supabase) return;
    const novo = Math.max(0, p.qtd_atual + delta);
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, qtd_atual: novo } : x)));
    const { error } = await supabase
      .from("ibk_produtos")
      .update({ qtd_atual: novo })
      .eq("id", p.id);
    if (error) {
      setErro(error.message);
      carregar();
    }
  };

  // somas gerais
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
          <p className="text-sm text-[var(--ink)]/70">
            SKUs, custo posto e giro. Insumo por pedido: {brl(INSUMO)}.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
            <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">Unidades</div>
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              {unidades}
            </div>
          </div>
          <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
            <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">Valor em estoque</div>
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              {brl(valorEstoque)}
            </div>
          </div>
        </div>
      </div>

      {/* novo SKU */}
      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <Campo label="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value as Produto["linha"])} className={inputCls}>
            <option value="verao">Verão</option>
            <option value="inverno">Inverno</option>
          </select>
        </Campo>
        <Campo label="Gênero">
          <select value={genero} onChange={(e) => setGenero(e.target.value as Produto["genero"])} className={inputCls}>
            <option value="menino">Menino</option>
            <option value="menina">Menina</option>
            <option value="unissex">Unissex</option>
          </select>
        </Campo>
        <Campo label="Tamanho">
          <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="ex: 2" className={`${inputCls} w-20`} />
        </Campo>
        <Campo label="Custo/un">
          <input value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="14,90" className={`${inputCls} w-24`} />
        </Campo>
        <Campo label="Qtd">
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="10" className={`${inputCls} w-20`} />
        </Campo>
        <Campo label="Fornecedor">
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={`${inputCls} min-w-[150px]`}>
            <option value="">{fornecedores.length ? "sem fornecedor" : "cadastre em Fornecedores"}</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </Campo>
        <button
          onClick={adicionar}
          disabled={salvando}
          className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
        >
          {salvando ? "salvando..." : "adicionar SKU"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* tabela */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">SKU</th>
              <th className="p-3">Fornecedor</th>
              <th className="p-3">Qtd</th>
              <th className="p-3">Custo/un</th>
              <th className="p-3">Custo posto</th>
              <th className="p-3">Preço alvo</th>
              <th className="p-3">Lucro/un</th>
              <th className="p-3">Valor estoque</th>
              <th className="p-3">Giro</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[var(--ink)]/50">
                  carregando...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[var(--ink)]/50">
                  nenhum SKU ainda. adicione acima ou rode o seed do 1º lote.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const alvo = PRECO_ALVO[p.linha];
              const lucro = alvo * (1 - TAXA) - p.custo_posto;
              return (
                <tr key={p.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-3 font-semibold text-[var(--ink)]">{label(p)}</td>
                  <td className="p-3 text-[var(--ink)]/70">{p.fornecedor_id ? fornMap.get(p.fornecedor_id) ?? "-" : "-"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => ajustar(p, -1)} className={stepCls}>
                        −
                      </button>
                      <span className="min-w-[2.5rem] text-center font-bold">
                        {p.qtd_atual}
                        <span className="text-[var(--ink)]/40">/{p.qtd_inicial}</span>
                      </span>
                      <button onClick={() => ajustar(p, 1)} className={stepCls}>
                        +
                      </button>
                    </div>
                  </td>
                  <td className="p-3">{brl(p.custo_unit)}</td>
                  <td className="p-3">{brl(p.custo_posto)}</td>
                  <td className="p-3">{brl(alvo)}</td>
                  <td className={`p-3 font-bold ${lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {brl(lucro)}
                  </td>
                  <td className="p-3">{brl(p.qtd_atual * p.custo_unit)}</td>
                  <td className="p-3">{Math.round(p.sell_through * 100)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--ink)]/50">
        Preço alvo é o avulso de referência (Verão {brl(PRECO_ALVO.verao)}, Inverno {brl(PRECO_ALVO.inverno)}), com taxa Shopee
        assumida de {Math.round(TAXA * 100)}%. Lucro/un = preço × (1 − taxa) − custo posto.
      </p>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";
const stepCls =
  "flex h-6 w-6 items-center justify-center rounded-md bg-[var(--purple)]/8 font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
