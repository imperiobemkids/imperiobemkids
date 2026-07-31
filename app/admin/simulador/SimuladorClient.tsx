"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Canal } from "../canais/CanaisClient";

type SKU = {
  id: string;
  nome: string | null;
  linha: "verao" | "inverno" | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
  qtd_atual: number;
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
  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalTabela, setCanalTabela] = useState<string>("");

  // entradas
  const [custoConj, setCustoConj] = useState("14,90");
  const [qtdKit, setQtdKit] = useState("2");
  const [preco, setPreco] = useState("54,90");
  const [taxa, setTaxa] = useState("20");
  const [insumo, setInsumo] = useState("0,40");
  const [frete, setFrete] = useState("0");
  const [cpa, setCpa] = useState("0");
  const [orcAds, setOrcAds] = useState("50");

  // tabela de precos de todo o estoque
  const [margemAlvo, setMargemAlvo] = useState("35");
  const [arredondar, setArredondar] = useState(true);
  const [kitTabela, setKitTabela] = useState("2");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    supabase
      .from("ibk_produtos")
      .select("*")
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => setSkus((data as SKU[]) ?? []));
    supabase
      .from("ibk_canais")
      .select("*")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        const cs = (data as Canal[]) ?? [];
        setCanais(cs);
        if (cs.length) setCanalTabela((atual) => atual || cs[0].id);
      });
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

  /*
    Preco sugerido a partir da margem desejada:
    lucro = preco*(1-taxa) - custo - ads  e  margem = lucro/preco
    logo  preco = (custo + ads) / (1 - taxa - margem)
    Arredondar termina o preco em ,90 (pratica de varejo).
  */
  const margemAlvoN = num(margemAlvo) / 100;
  const kitN = Math.max(1, Math.round(num(kitTabela)));
  const termina90 = (v: number) => {
    const base = Math.floor(v);
    return (v <= base + 0.9 ? base : base + 1) + 0.9;
  };
  /*
    custoFixo = produto + embalagem + tarifa fixa do canal + ads
    preco = custoFixo / (1 - comissao - margem)
    A tarifa fixa entra no numerador porque nao depende do preco (Mercado Livre
    cobra por pedido, Shopee nao). A comissao entra no divisor porque e percentual.
  */
  const precoPorMargem = (custoFixo: number, taxaPct: number, margem: number) => {
    const divisor = 1 - taxaPct - margem;
    if (divisor <= 0) return 0;
    const bruto = custoFixo / divisor;
    return arredondar ? termina90(bruto) : Math.round(bruto * 100) / 100;
  };
  const precoSugerido = (custoPosto: number) => precoPorMargem(custoPosto + cpaN, taxaN, margemAlvoN);

  // canal escolhido para a tabela de estoque (cai no simulador se nao houver canal)
  const canalSel = canais.find((c) => c.id === canalTabela);
  const taxaTabela = canalSel ? canalSel.taxa_pct : taxaN;
  const fixaTabela = canalSel ? canalSel.taxa_fixa : 0;
  const insumoTabela = canalSel ? canalSel.insumo_custo : insumoN;

  // comparativo: mesmo produto em todos os canais ativos
  const custoBaseComparativo = custoConjN * qtd;
  const comparativo = canais.map((c) => {
    const custoFixo = custoBaseComparativo + c.insumo_custo + c.taxa_fixa + cpaN + freteN;
    const preco = precoPorMargem(custoFixo, c.taxa_pct, margemAlvoN);
    const lucro = preco * (1 - c.taxa_pct) - custoFixo;
    return { canal: c, preco, lucro, margem: preco > 0 ? lucro / preco : 0 };
  });

  const linhasTabela = skus.map((s) => {
    const custoPostoAvulso = s.custo_unit + insumoTabela + fixaTabela;
    const pAvulso = precoPorMargem(custoPostoAvulso + cpaN, taxaTabela, margemAlvoN);
    const lucroAvulso = pAvulso * (1 - taxaTabela) - custoPostoAvulso - cpaN;

    const custoPostoKit = s.custo_unit * kitN + insumoTabela + fixaTabela;
    const pKit = precoPorMargem(custoPostoKit + cpaN, taxaTabela, margemAlvoN);
    const lucroKit = pKit * (1 - taxaTabela) - custoPostoKit - cpaN;

    return {
      sku: s,
      custoPostoAvulso,
      pAvulso,
      lucroAvulso,
      margemAvulso: pAvulso > 0 ? lucroAvulso / pAvulso : 0,
      pKit,
      lucroKit,
      potencial: lucroAvulso * s.qtd_atual,
      receitaPotencial: pAvulso * s.qtd_atual,
    };
  });

  const totalUnidades = skus.reduce((s, x) => s + x.qtd_atual, 0);
  const totalCusto = skus.reduce((s, x) => s + x.qtd_atual * x.custo_unit, 0);
  const totalReceita = linhasTabela.reduce((s, l) => s + l.receitaPotencial, 0);
  const totalLucro = linhasTabela.reduce((s, l) => s + l.potencial, 0);

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

      {/* ── Tabela de precos de todo o estoque ── */}
      <div className="mt-8 border-t border-[var(--purple)]/15 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              Tabela de preços do estoque
            </h2>
            <p className="text-sm text-[var(--ink)]/70">
              Preço sugerido de cada produto para a margem desejada
              {canalSel
                ? `, no canal ${canalSel.nome} (${Math.round(canalSel.taxa_pct * 1000) / 10}%${canalSel.taxa_fixa ? ` + ${brl(canalSel.taxa_fixa)} fixo` : ""})`
                : `, usando a taxa de ${Math.round(taxaN * 100)}%`}
              {cpaN > 0 && ` e ads de ${brl(cpaN)}`}.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {canais.length > 0 && (
              <Campo label="Canal">
                <select value={canalTabela} onChange={(e) => setCanalTabela(e.target.value)} className={`${inputCls} w-40`}>
                  {canais.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </select>
              </Campo>
            )}
            <Campo label="Margem alvo %">
              <input value={margemAlvo} onChange={(e) => setMargemAlvo(e.target.value)} className={`${inputCls} w-20`} />
            </Campo>
            <Campo label="Kit de">
              <input value={kitTabela} onChange={(e) => setKitTabela(e.target.value)} className={`${inputCls} w-16`} />
            </Campo>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]/70">
              <input type="checkbox" checked={arredondar} onChange={(e) => setArredondar(e.target.checked)} className="h-4 w-4 accent-[var(--purple)]" />
              terminar em ,90
            </label>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                <th className="p-3">Produto</th>
                <th className="p-3">Estoque</th>
                <th className="p-3">Custo un.</th>
                <th className="p-3">Custo posto</th>
                <th className="p-3">Preço avulso</th>
                <th className="p-3">Lucro/un</th>
                <th className="p-3">Margem</th>
                <th className="p-3">Kit {kitN}un</th>
                <th className="p-3">Lucro kit</th>
                <th className="p-3">Lucro potencial</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-[var(--ink)]/50">nenhum produto no estoque.</td></tr>
              )}
              {linhasTabela.map((l) => (
                <tr key={l.sku.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-3 font-semibold text-[var(--ink)]">{rotuloSku(l.sku)}</td>
                  <td className="p-3">{l.sku.qtd_atual}</td>
                  <td className="p-3">{brl(l.sku.custo_unit)}</td>
                  <td className="p-3">{brl(l.custoPostoAvulso)}</td>
                  <td className="p-3 font-bold text-[var(--purple-dark)]">{brl(l.pAvulso)}</td>
                  <td className={`p-3 font-bold ${l.lucroAvulso >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l.lucroAvulso)}</td>
                  <td className="p-3">{Math.round(l.margemAvulso * 100)}%</td>
                  <td className="p-3 font-semibold">{brl(l.pKit)}</td>
                  <td className={`p-3 ${l.lucroKit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l.lucroKit)}</td>
                  <td className="p-3 font-bold text-[var(--purple-dark)]">{brl(l.potencial)}</td>
                </tr>
              ))}
            </tbody>
            {linhasTabela.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--purple)]/15 bg-[var(--purple)]/5 font-bold">
                  <td className="p-3">Total</td>
                  <td className="p-3">{totalUnidades}</td>
                  <td className="p-3" colSpan={2}>{brl(totalCusto)} em custo</td>
                  <td className="p-3 text-[var(--purple-dark)]" colSpan={4}>{brl(totalReceita)} de receita se vender tudo</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-emerald-600">{brl(totalLucro)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="mt-2 text-xs text-[var(--ink)]/50">
          Preço sugerido = (custo posto + ads) ÷ (1 − taxa − margem alvo). O kit usa {kitN} unidades do mesmo produto,
          com o insumo contado uma vez só por pedido.
        </p>
      </div>

      {/* ── Mesmo produto, todos os canais ── */}
      {comparativo.length > 0 && (
        <div className="mt-8 border-t border-[var(--purple)]/15 pt-6">
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
            O mesmo produto em cada canal
          </h2>
          <p className="text-sm text-[var(--ink)]/70">
            Usa o custo do simulador ({brl(custoConjN)} × {qtd}) e a margem alvo de {margemAlvo}%.
            Mostra quanto cobrar em cada lugar para ganhar a mesma coisa.
          </p>

          <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                  <th className="p-3">Canal</th>
                  <th className="p-3">Comissão</th>
                  <th className="p-3">Tarifa fixa</th>
                  <th className="p-3">Preço para a margem alvo</th>
                  <th className="p-3">Lucro</th>
                  <th className="p-3">Margem</th>
                </tr>
              </thead>
              <tbody>
                {comparativo.map((l) => (
                  <tr key={l.canal.id} className="border-b border-[var(--purple)]/6 last:border-0">
                    <td className="p-3 font-semibold text-[var(--ink)]">{l.canal.nome}</td>
                    <td className="p-3">{Math.round(l.canal.taxa_pct * 1000) / 10}%</td>
                    <td className="p-3">{l.canal.taxa_fixa ? brl(l.canal.taxa_fixa) : "-"}</td>
                    <td className="p-3 font-bold text-[var(--purple-dark)]">{brl(l.preco)}</td>
                    <td className={`p-3 font-bold ${l.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l.lucro)}</td>
                    <td className="p-3">{Math.round(l.margem * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-[var(--ink)]/50">
            Onde a comissão é menor (WhatsApp no Pix, loja física) dá para vender mais barato ganhando o mesmo,
            ou manter o preço e ficar com a margem inteira. Ajuste as taxas reais em Canais.
          </p>
        </div>
      )}
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
