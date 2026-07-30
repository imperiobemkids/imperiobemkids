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
  ativo: boolean;
  custo_posto: number;
  valor_estoque: number;
  sell_through: number;
};

type Fornecedor = { id: string; nome: string };
type EditForm = {
  linha: Produto["linha"];
  genero: Produto["genero"];
  tamanho: string;
  custo: string;
  qtdAtual: string;
  qtdInicial: string;
  fornecedorId: string;
};

const INSUMO = 0.4;
const TAXA = 0.2;
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

  // edicao
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm | null>(null);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: forns }] = await Promise.all([
      supabase
        .from("ibk_v_estoque")
        .select("*")
        .eq("ativo", true)
        .order("linha")
        .order("genero")
        .order("tamanho"),
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
      linha, genero, tamanho: tamanho.trim() || null, custo_unit: c,
      qtd_inicial: q, qtd_atual: q, fornecedor_id: fornecedorId || null,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    setTamanho(""); setCusto(""); setQtd("");
    carregar();
  };

  const ajustar = async (p: Produto, delta: number) => {
    if (!supabase) return;
    const novo = Math.max(0, p.qtd_atual + delta);
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, qtd_atual: novo } : x)));
    const { error } = await supabase.from("ibk_produtos").update({ qtd_atual: novo }).eq("id", p.id);
    if (error) { setErro(error.message); carregar(); }
  };

  const abrirEdicao = (p: Produto) => {
    setEditId(p.id);
    setEdit({
      linha: p.linha, genero: p.genero, tamanho: p.tamanho ?? "",
      custo: String(p.custo_unit).replace(".", ","),
      qtdAtual: String(p.qtd_atual), qtdInicial: String(p.qtd_inicial),
      fornecedorId: p.fornecedor_id ?? "",
    });
  };

  const salvarEdicao = async (p: Produto) => {
    if (!supabase || !edit) return;
    setErro("");
    const { error } = await supabase.from("ibk_produtos").update({
      linha: edit.linha, genero: edit.genero, tamanho: edit.tamanho.trim() || null,
      custo_unit: parseFloat(edit.custo.replace(",", ".")) || 0,
      qtd_atual: parseInt(edit.qtdAtual, 10) || 0,
      qtd_inicial: parseInt(edit.qtdInicial, 10) || 0,
      fornecedor_id: edit.fornecedorId || null,
    }).eq("id", p.id);
    if (error) return setErro(error.message);
    setEditId(null); setEdit(null);
    carregar();
  };

  const arquivar = async (p: Produto) => {
    if (!supabase) return;
    if (!confirm(`Arquivar ${label(p)}? Ele sai da lista de estoque.`)) return;
    const { error } = await supabase.from("ibk_produtos").update({ ativo: false }).eq("id", p.id);
    if (error) return setErro(error.message);
    setEditId(null); setEdit(null);
    carregar();
  };

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
          <p className="text-sm text-[var(--ink)]/70">Toque em editar para ajustar um SKU. Insumo/pedido: {brl(INSUMO)}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi titulo="Unidades" valor={String(unidades)} />
          <Kpi titulo="Valor em estoque" valor={brl(valorEstoque)} />
        </div>
      </div>

      {/* novo SKU */}
      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <Campo label="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value as Produto["linha"])} className={inputCls}>
            <option value="verao">Verão</option><option value="inverno">Inverno</option>
          </select>
        </Campo>
        <Campo label="Gênero">
          <select value={genero} onChange={(e) => setGenero(e.target.value as Produto["genero"])} className={inputCls}>
            <option value="menino">Menino</option><option value="menina">Menina</option><option value="unissex">Unissex</option>
          </select>
        </Campo>
        <Campo label="Tamanho">
          <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="2" className={`${inputCls} w-16`} />
        </Campo>
        <Campo label="Custo/un">
          <input value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="14,90" className={`${inputCls} w-20`} />
        </Campo>
        <Campo label="Qtd">
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="10" className={`${inputCls} w-16`} />
        </Campo>
        <Campo label="Fornecedor">
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={`${inputCls} min-w-[130px]`}>
            <option value="">{fornecedores.length ? "sem fornecedor" : "cadastre em Fornecedores"}</option>
            {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
          </select>
        </Campo>
        <button onClick={adicionar} disabled={salvando}
          className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60">
          {salvando ? "salvando..." : "adicionar"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {loading && <p className="text-[var(--ink)]/50">carregando...</p>}
        {!loading && rows.length === 0 && (
          <p className="text-[var(--ink)]/50">nenhum SKU. adicione acima.</p>
        )}
        {rows.map((p) =>
          editId === p.id && edit ? (
            <div key={p.id} className="rounded-2xl border-2 border-[var(--purple)]/40 bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.12)]">
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Linha">
                  <select value={edit.linha} onChange={(e) => setEdit({ ...edit, linha: e.target.value as Produto["linha"] })} className={inputCls}>
                    <option value="verao">Verão</option><option value="inverno">Inverno</option>
                  </select>
                </Campo>
                <Campo label="Gênero">
                  <select value={edit.genero} onChange={(e) => setEdit({ ...edit, genero: e.target.value as Produto["genero"] })} className={inputCls}>
                    <option value="menino">Menino</option><option value="menina">Menina</option><option value="unissex">Unissex</option>
                  </select>
                </Campo>
                <Campo label="Tamanho">
                  <input value={edit.tamanho} onChange={(e) => setEdit({ ...edit, tamanho: e.target.value })} className={inputCls} />
                </Campo>
                <Campo label="Custo/un">
                  <input value={edit.custo} onChange={(e) => setEdit({ ...edit, custo: e.target.value })} className={inputCls} />
                </Campo>
                <Campo label="Qtd atual">
                  <input value={edit.qtdAtual} onChange={(e) => setEdit({ ...edit, qtdAtual: e.target.value })} className={inputCls} />
                </Campo>
                <Campo label="Qtd inicial">
                  <input value={edit.qtdInicial} onChange={(e) => setEdit({ ...edit, qtdInicial: e.target.value })} className={inputCls} />
                </Campo>
                <div className="col-span-2">
                  <Campo label="Fornecedor">
                    <select value={edit.fornecedorId} onChange={(e) => setEdit({ ...edit, fornecedorId: e.target.value })} className={inputCls}>
                      <option value="">sem fornecedor</option>
                      {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                    </select>
                  </Campo>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => salvarEdicao(p)} className="rounded-lg bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)]">salvar</button>
                <button onClick={() => { setEditId(null); setEdit(null); }} className="rounded-lg bg-[var(--purple)]/8 px-4 py-2 text-sm font-bold text-[var(--purple)]">cancelar</button>
                <button onClick={() => arquivar(p)} className="ml-auto rounded-lg px-3 py-2 text-sm font-bold text-red-400 hover:text-red-600">arquivar</button>
              </div>
            </div>
          ) : (
            <div key={p.id} className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-[family-name:var(--font-baloo)] text-base font-bold text-[var(--purple-dark)]">{label(p)}</div>
                  <div className="text-xs text-[var(--ink)]/55">{p.fornecedor_id ? fornMap.get(p.fornecedor_id) ?? "-" : "sem fornecedor"}</div>
                </div>
                <button onClick={() => abrirEdicao(p)} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">editar</button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-[var(--ink)]/40">Qtd</span>
                <button onClick={() => ajustar(p, -1)} className={stepCls}>−</button>
                <span className="min-w-[3rem] text-center font-bold">{p.qtd_atual}<span className="text-[var(--ink)]/40">/{p.qtd_inicial}</span></span>
                <button onClick={() => ajustar(p, 1)} className={stepCls}>+</button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-y-2 text-sm">
                <Stat titulo="Custo/un" valor={brl(p.custo_unit)} />
                <Stat titulo="Custo posto" valor={brl(p.custo_posto)} />
                <Stat titulo="Preço alvo" valor={brl(PRECO_ALVO[p.linha])} />
                <Stat titulo="Lucro/un" valor={brl(PRECO_ALVO[p.linha] * (1 - TAXA) - p.custo_posto)}
                      cor={PRECO_ALVO[p.linha] * (1 - TAXA) - p.custo_posto >= 0 ? "verde" : "vermelho"} />
                <Stat titulo="Em estoque" valor={brl(p.qtd_atual * p.custo_unit)} />
                <Stat titulo="Giro" valor={`${Math.round(p.sell_through * 100)}%`} />
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";
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
function Stat({ titulo, valor, cor }: { titulo: string; valor: string; cor?: "verde" | "vermelho" }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/40">{titulo}</div>
      <div className={`font-bold ${cor === "verde" ? "text-emerald-600" : cor === "vermelho" ? "text-red-500" : "text-[var(--ink)]"}`}>{valor}</div>
    </div>
  );
}
