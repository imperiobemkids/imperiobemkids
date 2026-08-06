"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { devolucaoEstoque } from "@/lib/estoque";
import { NovaVenda, type ProdutoVenda } from "./NovaVenda";
import type { Canal } from "../canais/CanaisClient";
import { SetupCard } from "../SetupCard";

type Produto = {
  id: string;
  nome: string | null;
  categoria: string | null;
  linha: "verao" | "inverno" | null;
  genero: "menino" | "menina" | "unissex" | null;
  tamanho: string | null;
  custo_unit: number;
  preco_venda: number | null;
  qtd_atual: number;
};

type VendaRow = {
  id: string;
  data: string;
  canal: string;
  tipo: string;
  preco_venda: number;
  taxa_pct: number;
  insumo_custo: number;
  frete: number;
  taxa_fixa: number;
  devolvida: boolean;
  data_devolucao: string | null;
  custo_devolucao: number;
  ibk_venda_itens: { qtd: number; produto_id: string | null; produto: { custo_unit: number } | null }[];
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/*
  lucro = preco liquido - custo dos itens - insumo - frete
  Venda devolvida nao gera lucro: o produto volta ao estoque e sobra o
  prejuizo da devolucao (frete reverso + parte da comissao que nao volta).
*/
const lucroVenda = (v: VendaRow) => {
  if (v.devolvida) return -(v.custo_devolucao ?? 0);
  const custoItens = v.ibk_venda_itens.reduce(
    (s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd,
    0,
  );
  return (
    v.preco_venda * (1 - v.taxa_pct) -
    custoItens -
    v.insumo_custo -
    (v.taxa_fixa ?? 0) -
    v.frete
  );
};

export function VendasClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [investido, setInvestido] = useState(0);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");


  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: prod }, { data: vend, error }, { data: movs }, { data: cans }] = await Promise.all([
      supabase
        .from("ibk_produtos")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("ibk_vendas")
        .select("*, ibk_venda_itens(qtd, produto_id, produto:ibk_produtos(custo_unit))")
        .order("data", { ascending: false })
        .limit(50),
      supabase
        .from("ibk_movimentos")
        .select("valor, categoria, tipo")
        .eq("tipo", "saida")
        .in("categoria", ["mercadoria", "insumo", "capex"]),
      supabase.from("ibk_canais").select("*").eq("ativo", true).order("ordem"),
    ]);
    if (error) setErro(error.message);
    setProdutos((prod as Produto[]) ?? []);
    setVendas((vend as VendaRow[]) ?? []);
    setInvestido(((movs as { valor: number }[]) ?? []).reduce((s, m) => s + m.valor, 0));
    setCanais((cans as Canal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;


  /*
    Devolucao: devolve a peca ao estoque, estorna a venda e a taxa no caixa e
    lanca o custo da devolucao (frete reverso + parte da comissao que nao volta).
  */
  const devolver = async (v: VendaRow) => {
    if (!supabase) return;
    const resposta = prompt(
      `Devolver a venda de ${brl(v.preco_venda)}?\n\nQuanto essa devolução vai custar (frete reverso + comissão que a Shopee não devolve)?`,
      "0",
    );
    if (resposta === null) return;
    const custoDev = parseFloat(resposta.replace(",", ".")) || 0;
    const dataDev = new Date().toISOString().slice(0, 10);
    setErro("");

    // 1) peca volta ao estoque (custo medio nao muda)
    for (const it of v.ibk_venda_itens) {
      if (it.produto_id) await devolucaoEstoque(it.produto_id, it.qtd, { vendaId: v.id, data: dataDev });
    }

    // 2) caixa: estorna a entrada da venda e devolve a taxa que havia saido
    const movs: Record<string, unknown>[] = [
      { data: dataDev, tipo: "saida", categoria: "venda", valor: v.preco_venda, descricao: "Estorno de venda devolvida", ref_venda_id: v.id },
      { data: dataDev, tipo: "entrada", categoria: "taxa_shopee", valor: v.preco_venda * v.taxa_pct, descricao: "Estorno da taxa (venda devolvida)", ref_venda_id: v.id },
    ];
    // 3) custo da devolucao
    if (custoDev > 0) {
      movs.push({ data: dataDev, tipo: "saida", categoria: "frete", valor: custoDev, descricao: "Custo da devolução (frete reverso e taxa retida)", ref_venda_id: v.id });
    }
    await supabase.from("ibk_movimentos").insert(movs);

    // 4) marca a venda
    const { error } = await supabase
      .from("ibk_vendas")
      .update({ devolvida: true, data_devolucao: dataDev, custo_devolucao: custoDev })
      .eq("id", v.id);
    if (error) setErro(error.message);
    carregar();
  };

  // somas gerais (venda devolvida sai do faturamento)
  const totalVendido = vendas.filter((v) => !v.devolvida).reduce((s, v) => s + v.preco_venda, 0);
  const devolvidas = vendas.filter((v) => v.devolvida);
  const lucroAcum = vendas.reduce((s, v) => s + lucroVenda(v), 0);
  // investido = tudo que saiu em mercadoria, insumo e capex (nao fixar no codigo)
  const paybackPct = investido > 0 ? Math.min(100, Math.round((lucroAcum / investido) * 100)) : 0;

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
          {devolvidas.length > 0 && (
            <Kpi
              titulo="Devoluções"
              valor={`${devolvidas.length} (${Math.round((devolvidas.length / vendas.length) * 100)}%)`}
            />
          )}
        </div>
      </div>

      {/* nova venda, no formato de caixa */}
      <div className="mt-5">
        <NovaVenda produtos={produtos as unknown as ProdutoVenda[]} canais={canais} aoRegistrar={carregar} />
      </div>


      {/* payback bar */}
      <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <div className="mb-1 flex justify-between text-xs font-bold text-[var(--ink)]/60">
          <span>Payback do investido ({brl(investido)})</span>
          <span>{brl(lucroAcum)} de lucro</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--purple)]/10">
          <div className="h-full rounded-full bg-[var(--purple)] transition-all" style={{ width: `${paybackPct}%` }} />
        </div>
      </div>

      {/* lista de vendas */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Data</th>
              <th className="p-3">Tipo</th>
              <th className="hidden p-3 sm:table-cell">Canal</th>
              <th className="hidden p-3 md:table-cell">Itens</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Lucro</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">carregando...</td>
              </tr>
            )}
            {!loading && vendas.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">nenhuma venda registrada ainda.</td>
              </tr>
            )}
            {vendas.map((v) => {
              const l = lucroVenda(v);
              const qtdItens = v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0);
              return (
                <tr key={v.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${v.devolvida ? "bg-red-50/60" : ""}`}>
                  <td className="p-3">{new Date(v.data).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 capitalize">
                    {v.tipo}
                    {v.devolvida && (
                      <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-600">
                        devolvida
                      </span>
                    )}
                  </td>
                  <td className="hidden p-3 capitalize sm:table-cell">{v.canal}</td>
                  <td className="hidden p-3 md:table-cell">{qtdItens}</td>
                  <td className={`p-3 ${v.devolvida ? "text-[var(--ink)]/40 line-through" : ""}`}>{brl(v.preco_venda)}</td>
                  <td className={`p-3 font-bold ${l >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l)}</td>
                  <td className="p-3">
                    {!v.devolvida && (
                      <button onClick={() => devolver(v)} className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/50 hover:text-red-600" title="registrar devolução">
                        devolver
                      </button>
                    )}
                  </td>
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
