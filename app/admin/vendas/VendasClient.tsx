"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Produto = {
  id: string;
  linha: "verao" | "inverno";
  genero: "menino" | "menina" | "unissex";
  tamanho: string | null;
  custo_unit: number;
  qtd_atual: number;
};

type ItemVenda = { produto_id: string; qtd: number };

type VendaRow = {
  id: string;
  data: string;
  canal: string;
  tipo: string;
  preco_venda: number;
  taxa_pct: number;
  insumo_custo: number;
  frete: number;
  ibk_venda_itens: { qtd: number; produto: { custo_unit: number } | null }[];
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const labelProduto = (p: Produto) =>
  `${p.linha === "verao" ? "Verão" : "Inverno"} · ${p.genero}${p.tamanho ? " · " + p.tamanho : ""}`;

// lucro = preco liquido - custo dos itens - insumo - frete
const lucroVenda = (v: VendaRow) => {
  const custoItens = v.ibk_venda_itens.reduce(
    (s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd,
    0,
  );
  return v.preco_venda * (1 - v.taxa_pct) - custoItens - v.insumo_custo - v.frete;
};

export function VendasClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // form
  const [tipo, setTipo] = useState<"avulso" | "kit">("avulso");
  const [canal, setCanal] = useState("shopee");
  const [preco, setPreco] = useState("");
  const [taxa, setTaxa] = useState("20");
  const [frete, setFrete] = useState("0");
  const [itens, setItens] = useState<ItemVenda[]>([{ produto_id: "", qtd: 1 }]);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: prod }, { data: vend, error }] = await Promise.all([
      supabase
        .from("ibk_produtos")
        .select("id, linha, genero, tamanho, custo_unit, qtd_atual")
        .eq("ativo", true)
        .order("linha")
        .order("genero"),
      supabase
        .from("ibk_vendas")
        .select("*, ibk_venda_itens(qtd, produto:ibk_produtos(custo_unit))")
        .order("data", { ascending: false })
        .limit(50),
    ]);
    if (error) setErro(error.message);
    setProdutos((prod as Produto[]) ?? []);
    setVendas((vend as VendaRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const setItem = (i: number, patch: Partial<ItemVenda>) =>
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItens((arr) => [...arr, { produto_id: "", qtd: 1 }]);
  const removeItem = (i: number) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const pMap = new Map(produtos.map((p) => [p.id, p]));
  const custoItens = itens.reduce(
    (s, it) => s + (pMap.get(it.produto_id)?.custo_unit ?? 0) * it.qtd,
    0,
  );
  const precoN = parseFloat(preco.replace(",", ".")) || 0;
  const taxaN = (parseFloat(taxa.replace(",", ".")) || 0) / 100;
  const freteN = parseFloat(frete.replace(",", ".")) || 0;
  const insumoN = 0.4;
  const lucroPrevisto = precoN * (1 - taxaN) - custoItens - insumoN - freteN;

  const registrar = async () => {
    if (!supabase) return;
    const itensValidos = itens.filter((it) => it.produto_id && it.qtd > 0);
    if (!precoN || itensValidos.length === 0) {
      setErro("informe o preço e ao menos um item");
      return;
    }
    // checa estoque
    for (const it of itensValidos) {
      const p = pMap.get(it.produto_id);
      if (p && it.qtd > p.qtd_atual) {
        setErro(`estoque insuficiente de ${labelProduto(p)} (tem ${p.qtd_atual})`);
        return;
      }
    }
    setErro("");
    setSalvando(true);

    const { data: venda, error: e1 } = await supabase
      .from("ibk_vendas")
      .insert({
        canal,
        tipo,
        preco_venda: precoN,
        taxa_pct: taxaN,
        insumo_custo: insumoN,
        frete: freteN,
      })
      .select("id")
      .single();
    if (e1 || !venda) {
      setErro(e1?.message ?? "erro ao criar venda");
      setSalvando(false);
      return;
    }

    const { error: e2 } = await supabase.from("ibk_venda_itens").insert(
      itensValidos.map((it) => ({ venda_id: venda.id, produto_id: it.produto_id, qtd: it.qtd })),
    );
    if (e2) {
      setErro(e2.message);
      setSalvando(false);
      return;
    }

    // baixa no estoque
    for (const it of itensValidos) {
      const p = pMap.get(it.produto_id);
      if (!p) continue;
      await supabase
        .from("ibk_produtos")
        .update({ qtd_atual: Math.max(0, p.qtd_atual - it.qtd) })
        .eq("id", it.produto_id);
    }

    // caixa: entrada da venda + saida da taxa
    await supabase.from("ibk_movimentos").insert([
      { tipo: "entrada", categoria: "venda", valor: precoN, descricao: `Venda ${tipo} (${canal})`, ref_venda_id: venda.id },
      { tipo: "saida", categoria: "taxa_shopee", valor: precoN * taxaN, descricao: "Taxa Shopee", ref_venda_id: venda.id },
    ]);

    setSalvando(false);
    setPreco("");
    setFrete("0");
    setItens([{ produto_id: "", qtd: 1 }]);
    carregar();
  };

  // somas gerais
  const totalVendido = vendas.reduce((s, v) => s + v.preco_venda, 0);
  const lucroAcum = vendas.reduce((s, v) => s + lucroVenda(v), 0);
  const DESEMBOLSO = 1621.7; // 1o lote (ver analise de custos)
  const paybackPct = Math.min(100, Math.round((lucroAcum / DESEMBOLSO) * 100));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Vendas
          </h1>
          <p className="text-sm text-[var(--ink)]/70">
            Registra a venda, dá baixa no estoque e lança no caixa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi titulo="Vendido" valor={brl(totalVendido)} />
          <Kpi titulo="Lucro acum." valor={brl(lucroAcum)} />
          <Kpi titulo="Payback" valor={`${paybackPct}%`} />
        </div>
      </div>

      {/* nova venda */}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "avulso" | "kit")} className={inputCls}>
              <option value="avulso">Avulso</option>
              <option value="kit">Kit</option>
            </select>
          </Campo>
          <Campo label="Canal">
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={inputCls}>
              <option value="shopee">Shopee</option>
              <option value="direto">Direto</option>
              <option value="outro">Outro</option>
            </select>
          </Campo>
          <Campo label="Preço venda">
            <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="54,90" className={`${inputCls} w-24`} />
          </Campo>
          <Campo label="Taxa %">
            <input value={taxa} onChange={(e) => setTaxa(e.target.value)} className={`${inputCls} w-16`} />
          </Campo>
          <Campo label="Frete">
            <input value={frete} onChange={(e) => setFrete(e.target.value)} className={`${inputCls} w-20`} />
          </Campo>
        </div>

        {/* itens */}
        <div className="mt-3 space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Campo label={`Item ${i + 1}`}>
                <select
                  value={it.produto_id}
                  onChange={(e) => setItem(i, { produto_id: e.target.value })}
                  className={`${inputCls} min-w-[220px]`}
                >
                  <option value="">selecione o SKU</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {labelProduto(p)} (estoque {p.qtd_atual})
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Qtd">
                <input
                  type="number"
                  min={1}
                  value={it.qtd}
                  onChange={(e) => setItem(i, { qtd: parseInt(e.target.value, 10) || 1 })}
                  className={`${inputCls} w-16`}
                />
              </Campo>
              {itens.length > 1 && (
                <button onClick={() => removeItem(i)} className="mb-0.5 text-sm font-bold text-red-400 hover:text-red-600">
                  remover
                </button>
              )}
            </div>
          ))}
          {tipo === "kit" && (
            <button onClick={addItem} className="text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">
              + adicionar item ao kit
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--purple)]/10 pt-3">
          <div className="text-sm">
            Lucro previsto:{" "}
            <strong className={lucroPrevisto >= 0 ? "text-emerald-600" : "text-red-500"}>
              {brl(lucroPrevisto)}
            </strong>
            <span className="ml-2 text-[var(--ink)]/50">
              (líquido {brl(precoN * (1 - taxaN))} − custo {brl(custoItens)} − insumo {brl(insumoN)} − frete {brl(freteN)})
            </span>
          </div>
          <button
            onClick={registrar}
            disabled={salvando}
            className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
          >
            {salvando ? "registrando..." : "registrar venda"}
          </button>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* payback bar */}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <div className="mb-1 flex justify-between text-xs font-bold text-[var(--ink)]/60">
          <span>Payback do 1º lote ({brl(DESEMBOLSO)})</span>
          <span>{brl(lucroAcum)} de lucro</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--purple)]/10">
          <div className="h-full rounded-full bg-[var(--purple)] transition-all" style={{ width: `${paybackPct}%` }} />
        </div>
      </div>

      {/* lista de vendas */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Data</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Canal</th>
              <th className="p-3">Itens</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[var(--ink)]/50">carregando...</td>
              </tr>
            )}
            {!loading && vendas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[var(--ink)]/50">nenhuma venda registrada ainda.</td>
              </tr>
            )}
            {vendas.map((v) => {
              const l = lucroVenda(v);
              const qtdItens = v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0);
              return (
                <tr key={v.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-3">{new Date(v.data).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 capitalize">{v.tipo}</td>
                  <td className="p-3 capitalize">{v.canal}</td>
                  <td className="p-3">{qtdItens}</td>
                  <td className="p-3">{brl(v.preco_venda)}</td>
                  <td className={`p-3 font-bold ${l >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

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
