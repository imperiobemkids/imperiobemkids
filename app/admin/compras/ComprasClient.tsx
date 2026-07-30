"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Fornecedor = { id: string; nome: string };
type Tipo = "mercadoria" | "insumo" | "capex";
type Item = { tipo: Tipo; descricao: string; categoria: string; tamanho: string; qtd: string; custoUnit: string };

type Lote = {
  id: string;
  data: string;
  descricao: string | null;
  fornecedor: { nome: string } | null;
  ibk_lote_itens: { custo_total: number; tipo: string }[];
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;
const hoje = () => new Date().toISOString().slice(0, 10);
const itemVazio = (): Item => ({ tipo: "mercadoria", descricao: "", categoria: "", tamanho: "", qtd: "", custoUnit: "" });

export function ComprasClient() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  // form
  const [fornecedorId, setFornecedorId] = useState("");
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<Item[]>([itemVazio()]);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: forns }, { data: ls, error }] = await Promise.all([
      supabase.from("ibk_fornecedores").select("id, nome").order("nome"),
      supabase
        .from("ibk_lotes")
        .select("id, data, descricao, fornecedor:ibk_fornecedores(nome), ibk_lote_itens(custo_total, tipo)")
        .order("data", { ascending: false })
        .limit(50),
    ]);
    if (error) setErro(error.message);
    setFornecedores((forns as Fornecedor[]) ?? []);
    setLotes((ls as unknown as Lote[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const setItem = (i: number, patch: Partial<Item>) =>
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItens((arr) => [...arr, itemVazio()]);
  const removeItem = (i: number) => setItens((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const abrir = () => {
    setFornecedorId(""); setData(hoje()); setObs(""); setItens([itemVazio()]); setErro(""); setAberto(true);
  };

  const totalItem = (it: Item) => num(it.qtd) * num(it.custoUnit);
  const totalGeral = itens.reduce((s, it) => s + totalItem(it), 0);

  const salvar = async () => {
    if (!supabase) return;
    const validos = itens.filter((it) => it.descricao.trim() && num(it.qtd) > 0 && num(it.custoUnit) > 0);
    if (validos.length === 0) { setErro("adicione ao menos um item com descrição, qtd e custo"); return; }
    setErro(""); setSalvando(true);

    // 1) lote
    const { data: lote, error: e1 } = await supabase
      .from("ibk_lotes")
      .insert({ data, fornecedor_id: fornecedorId || null, descricao: obs.trim() || "Compra de estoque" })
      .select("id")
      .single();
    if (e1 || !lote) { setErro(e1?.message ?? "erro ao criar a compra"); setSalvando(false); return; }

    // 2) itens do lote
    const { error: e2 } = await supabase.from("ibk_lote_itens").insert(
      validos.map((it) => ({ lote_id: lote.id, tipo: it.tipo, descricao: it.descricao.trim(), qtd: num(it.qtd), custo_total: totalItem(it) })),
    );
    if (e2) { setErro(e2.message); setSalvando(false); return; }

    // 3) mercadoria vira produto no estoque
    const merc = validos.filter((it) => it.tipo === "mercadoria");
    if (merc.length) {
      const { error: e3 } = await supabase.from("ibk_produtos").insert(
        merc.map((it) => ({
          nome: it.descricao.trim(),
          categoria: it.categoria.trim() || null,
          tamanho: it.tamanho.trim() || null,
          custo_unit: num(it.custoUnit),
          qtd_inicial: Math.round(num(it.qtd)),
          qtd_atual: Math.round(num(it.qtd)),
          fornecedor_id: fornecedorId || null,
          lote_id: lote.id,
        })),
      );
      if (e3) { setErro(e3.message); setSalvando(false); return; }
    }

    // 4) insumos entram no estoque de insumos
    const ins = validos.filter((it) => it.tipo === "insumo");
    if (ins.length) {
      await supabase.from("ibk_insumos").insert(
        ins.map((it) => ({ nome: it.descricao.trim(), qtd_atual: num(it.qtd), custo_unit: num(it.custoUnit) })),
      );
    }

    // 5) caixa: uma saida por categoria
    const porCat: Record<Tipo, number> = { mercadoria: 0, insumo: 0, capex: 0 };
    validos.forEach((it) => { porCat[it.tipo] += totalItem(it); });
    const movs = (Object.keys(porCat) as Tipo[])
      .filter((t) => porCat[t] > 0)
      .map((t) => ({ data, tipo: "saida", categoria: t, valor: porCat[t], descricao: `Compra de estoque (${t})`, ref_lote_id: lote.id }));
    if (movs.length) await supabase.from("ibk_movimentos").insert(movs);

    setSalvando(false);
    setAberto(false);
    carregar();
  };

  const totalLote = (l: Lote) => l.ibk_lote_itens.reduce((s, it) => s + it.custo_total, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Compras
          </h1>
          <p className="text-sm text-[var(--ink)]/70">
            Registra uma remessa: joga no estoque e lança a saída no caixa de uma vez.
          </p>
        </div>
        <button onClick={abrir} className="rounded-xl bg-[var(--purple)] px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]">
          + Nova compra
        </button>
      </div>

      {erro && !aberto && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* lista de compras */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Data</th>
              <th className="p-3">Fornecedor</th>
              <th className="p-3">Descrição</th>
              <th className="p-3">Itens</th>
              <th className="p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={5} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
            {!loading && lotes.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-[var(--ink)]/50">nenhuma compra registrada. clique em "+ Nova compra".</td></tr>
            )}
            {lotes.map((l) => (
              <tr key={l.id} className="border-b border-[var(--purple)]/6 last:border-0">
                <td className="p-3">{new Date(l.data).toLocaleDateString("pt-BR")}</td>
                <td className="p-3 text-[var(--ink)]/70">{l.fornecedor?.nome ?? "-"}</td>
                <td className="p-3 text-[var(--ink)]/70">{l.descricao ?? "-"}</td>
                <td className="p-3">{l.ibk_lote_itens.length}</td>
                <td className="p-3 font-bold text-[var(--purple-dark)]">{brl(totalLote(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* modal nova compra */}
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setAberto(false)}>
          <div className="mt-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Nova compra</h2>

            <div className="flex flex-wrap gap-3">
              <Campo label="Fornecedor">
                <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={`${inputCls} min-w-[160px]`}>
                  <option value="">{fornecedores.length ? "sem fornecedor" : "cadastre em Fornecedores"}</option>
                  {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
                </select>
              </Campo>
              <Campo label="Data">
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
              </Campo>
              <Campo label="Descrição (opcional)">
                <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex: remessa verão 2" className={`${inputCls} min-w-[180px]`} />
              </Campo>
            </div>

            <div className="mt-4 space-y-3">
              {itens.map((it, i) => (
                <div key={i} className="rounded-xl border border-[var(--purple)]/15 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <Campo label="Tipo">
                      <select value={it.tipo} onChange={(e) => setItem(i, { tipo: e.target.value as Tipo })} className={inputCls}>
                        <option value="mercadoria">Mercadoria</option>
                        <option value="insumo">Insumo</option>
                        <option value="capex">Capex</option>
                      </select>
                    </Campo>
                    <Campo label={it.tipo === "mercadoria" ? "Nome do produto" : "Descrição"}>
                      <input value={it.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} placeholder={it.tipo === "capex" ? "ex: impressora" : "ex: conjunto moletom"} className={`${inputCls} min-w-[170px]`} />
                    </Campo>
                    {it.tipo === "mercadoria" && (
                      <>
                        <Campo label="Categoria"><input value={it.categoria} onChange={(e) => setItem(i, { categoria: e.target.value })} placeholder="Conjunto" className={`${inputCls} w-28`} /></Campo>
                        <Campo label="Tamanho"><input value={it.tamanho} onChange={(e) => setItem(i, { tamanho: e.target.value })} placeholder="2" className={`${inputCls} w-16`} /></Campo>
                      </>
                    )}
                    <Campo label="Qtd"><input value={it.qtd} onChange={(e) => setItem(i, { qtd: e.target.value })} placeholder="10" className={`${inputCls} w-16`} /></Campo>
                    <Campo label="Custo/un"><input value={it.custoUnit} onChange={(e) => setItem(i, { custoUnit: e.target.value })} placeholder="14,90" className={`${inputCls} w-20`} /></Campo>
                    <div className="pb-1.5 text-sm font-bold text-[var(--purple-dark)]">{brl(totalItem(it))}</div>
                    {itens.length > 1 && (
                      <button onClick={() => removeItem(i)} className="pb-1.5 text-sm font-bold text-red-400 hover:text-red-600">remover</button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">+ adicionar item</button>
            </div>

            {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--purple)]/10 pt-3">
              <div className="text-sm">Total da compra: <strong className="text-[var(--purple-dark)]">{brl(totalGeral)}</strong></div>
              <button onClick={salvar} disabled={salvando} className="ml-auto rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
                {salvando ? "salvando..." : "registrar compra"}
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
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
