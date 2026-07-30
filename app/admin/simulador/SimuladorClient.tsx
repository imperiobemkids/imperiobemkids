"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type SKU = {
  id: string;
  nome: string | null;
  linha: "verao" | "inverno" | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
};

const rotuloSku = (s: SKU) => {
  if (s.nome && s.nome.trim()) return s.nome.trim() + (s.tamanho ? ` · ${s.tamanho}` : "");
  const linha = s.linha === "verao" ? "Verão" : s.linha === "inverno" ? "Inverno" : "";
  return [linha, s.genero, s.tamanho].filter(Boolean).join(" · ") || "Produto";
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v) ? v : 0,
  );
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

export function SimuladorClient() {
  const [skus, setSkus] = useState<SKU[]>([]);

  // entradas
  const [custoConj, setCustoConj] = useState("14,90");
  const [qtdKit, setQtdKit] = useState("2");
  const [preco, setPreco] = useState("54,90");
  const [taxa, setTaxa] = useState("20");
  const [insumo, setInsumo] = useState("0,40");
  const [frete, setFrete] = useState("0");
  const [cpa, setCpa] = useState("0");
  const [orcAds, setOrcAds] = useState("50");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    supabase
      .from("ibk_produtos")
      .select("*")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSkus((data as SKU[]) ?? []));
  }, []);

  // calculos
  const custoConjN = num(custoConj);
  const qtd = Math.max(1, Math.round(num(qtdKit)));
  const precoN = num(preco);
  const taxaN = num(taxa) / 100;
  const insumoN = num(insumo);
  const freteN = num(frete);
  const cpaN = num(cpa);
  const orcN = num(orcAds);

  const custoProduto = custoConjN * qtd;
  const custoPedido = custoProduto + insumoN + freteN;
  const liquido = precoN * (1 - taxaN);
  const lucroSemAds = liquido - custoPedido;
  const lucroComAds = lucroSemAds - cpaN;
  const margem = precoN > 0 ? lucroComAds / precoN : 0;
  const lucroPorConjunto = lucroComAds / qtd;
  // quanto da pra pagar de anuncio por venda antes de zerar o lucro
  const maxCpa = lucroSemAds;
  // vendas necessarias para pagar um orcamento de ads (com o lucro sem ads)
  const vendasBreakeven = lucroSemAds > 0 ? Math.ceil(orcN / lucroSemAds) : Infinity;

  const escada = [-10, -5, 0, 5, 10].map((d) => {
    const p = precoN + d;
    const lucro = p * (1 - taxaN) - custoPedido - cpaN;
    return { p, lucro, margem: p > 0 ? lucro / p : 0 };
  });

  const prefill = (id: string) => {
    const s = skus.find((x) => x.id === id);
    if (s) setCustoConj(String(s.custo_unit).replace(".", ","));
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
        Precificação
      </h1>
      <p className="text-sm text-[var(--ink)]/70">
        Testa preço, kit, taxa e anúncios e vê o lucro na hora. Puxa o custo de um produto do estoque.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* entradas */}
        <div className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          {skus.length > 0 && (
            <Campo label="Puxar custo de um SKU">
              <select onChange={(e) => prefill(e.target.value)} className={inputCls} defaultValue="">
                <option value="">escolher SKU...</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {rotuloSku(s)} ({brl(s.custo_unit)})
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Custo por conjunto">
              <input value={custoConj} onChange={(e) => setCustoConj(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Conjuntos no kit">
              <input value={qtdKit} onChange={(e) => setQtdKit(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Preço de venda">
              <input value={preco} onChange={(e) => setPreco(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Taxa Shopee %">
              <input value={taxa} onChange={(e) => setTaxa(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Insumo / pedido">
              <input value={insumo} onChange={(e) => setInsumo(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Frete pago por você">
              <input value={frete} onChange={(e) => setFrete(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Ads por venda (CPA)">
              <input value={cpa} onChange={(e) => setCpa(e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Orçamento de campanha">
              <input value={orcAds} onChange={(e) => setOrcAds(e.target.value)} className={inputCls} />
            </Campo>
          </div>
        </div>

        {/* resultados */}
        <div className="grid grid-cols-2 gap-3 self-start">
          <Res titulo="Custo do pedido" valor={brl(custoPedido)} />
          <Res titulo="Líquido após taxa" valor={brl(liquido)} />
          <Res titulo="Lucro por venda" valor={brl(lucroComAds)} destaque={lucroComAds >= 0} big />
          <Res titulo="Margem" valor={`${Math.round(margem * 100)}%`} destaque={margem >= 0} big />
          <Res titulo="Lucro por conjunto" valor={brl(lucroPorConjunto)} destaque={lucroPorConjunto >= 0} />
          <Res titulo="Máx. ads por venda" valor={brl(maxCpa)} destaque={maxCpa >= 0} />
          <div className="col-span-2 rounded-2xl bg-[var(--purple)]/8 p-4">
            <div className="text-xs font-bold uppercase text-[var(--ink)]/50">Break-even da campanha</div>
            <div className="mt-1 text-sm text-[var(--ink)]/80">
              Com {brl(orcN)} de anúncio e {brl(lucroSemAds)} de lucro por venda (sem ads), você precisa de{" "}
              <strong className="text-[var(--purple-dark)]">
                {vendasBreakeven === Infinity ? "∞ (lucro não paga)" : `${vendasBreakeven} vendas`}
              </strong>{" "}
              só pra empatar o anúncio.
            </div>
          </div>
        </div>
      </div>

      {/* escada de precos */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Preço</th>
              <th className="p-3">Lucro/venda</th>
              <th className="p-3">Margem</th>
            </tr>
          </thead>
          <tbody>
            {escada.map((e, i) => (
              <tr key={i} className={`border-b border-[var(--purple)]/6 last:border-0 ${e.p === precoN ? "bg-[var(--purple)]/5" : ""}`}>
                <td className="p-3 font-semibold">{brl(e.p)}{e.p === precoN ? " (atual)" : ""}</td>
                <td className={`p-3 font-bold ${e.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(e.lucro)}</td>
                <td className="p-3">{Math.round(e.margem * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}

function Res({ titulo, valor, destaque, big }: { titulo: string; valor: string; destaque?: boolean; big?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div
        className={`mt-1 font-[family-name:var(--font-baloo)] font-extrabold ${big ? "text-2xl" : "text-lg"} ${
          destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"
        }`}
      >
        {valor}
      </div>
    </div>
  );
}
