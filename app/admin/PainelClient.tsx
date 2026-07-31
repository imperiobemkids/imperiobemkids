"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "./SetupCard";

type Produto = {
  id: string;
  nome: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
  qtd_atual: number;
  qtd_inicial: number;
};
type Mov = { tipo: "entrada" | "saida"; categoria: string; valor: number; data: string; pago: boolean };
type Venda = {
  data: string;
  preco_venda: number;
  taxa_pct: number;
  insumo_custo: number;
  frete: number;
  ibk_venda_itens: { qtd: number; produto: { custo_unit: number } | null }[];
};

const ESTOQUE_BAIXO = 3;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const nomeProduto = (p: Produto) => {
  if (p.nome && p.nome.trim()) return p.nome.trim() + (p.tamanho ? ` · ${p.tamanho}` : "");
  const linha = p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "";
  return [linha, p.genero, p.tamanho].filter(Boolean).join(" · ") || "Produto";
};

const noMes = (iso: string) => {
  const d = new Date(iso);
  const h = new Date();
  return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth();
};

const CARDS = [
  { href: "/admin/estoque", emoji: "📦", titulo: "Estoque" },
  { href: "/admin/compras", emoji: "🛍️", titulo: "Compras" },
  { href: "/admin/vendas", emoji: "🧾", titulo: "Vendas" },
  { href: "/admin/financeiro", emoji: "💰", titulo: "Financeiro" },
  { href: "/admin/fornecedores", emoji: "🏭", titulo: "Fornecedores" },
  { href: "/admin/simulador", emoji: "🧮", titulo: "Precificação" },
];

export function PainelClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: p }, { data: m }, { data: v }] = await Promise.all([
        supabase!.from("ibk_produtos").select("*").eq("ativo", true),
        supabase!.from("ibk_movimentos").select("tipo, categoria, valor, data, pago"),
        supabase!.from("ibk_vendas").select("data, preco_venda, taxa_pct, insumo_custo, frete, ibk_venda_itens(qtd, produto:ibk_produtos(custo_unit))"),
      ]);
      setProdutos((p as Produto[]) ?? []);
      setMovs((m as Mov[]) ?? []);
      setVendas((v as unknown as Venda[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (!supabaseConfigured) return <SetupCard />;

  // estoque
  const unidades = produtos.reduce((s, p) => s + p.qtd_atual, 0);
  const valorEstoque = produtos.reduce((s, p) => s + p.qtd_atual * p.custo_unit, 0);
  const baixos = produtos.filter((p) => p.qtd_atual <= ESTOQUE_BAIXO).sort((a, b) => a.qtd_atual - b.qtd_atual);

  // caixa
  const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const saidas = movs.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const caixa = entradas - saidas;
  const aPagar = movs.filter((m) => !m.pago).reduce((s, m) => s + m.valor, 0);

  // investido (o que saiu para montar a operacao)
  const investido = movs
    .filter((m) => m.tipo === "saida" && ["mercadoria", "insumo", "capex"].includes(m.categoria))
    .reduce((s, m) => s + m.valor, 0);

  // ads
  const ads = movs.filter((m) => m.tipo === "saida" && m.categoria === "ads").reduce((s, m) => s + m.valor, 0);

  // lucro das vendas
  const lucroVenda = (v: Venda) => {
    const custo = v.ibk_venda_itens.reduce((s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd, 0);
    return v.preco_venda * (1 - v.taxa_pct) - custo - v.insumo_custo - v.frete;
  };
  const lucroBruto = vendas.reduce((s, v) => s + lucroVenda(v), 0);
  const lucroLiquido = lucroBruto - ads;
  const vendidoMes = vendas.filter((v) => noMes(v.data)).reduce((s, v) => s + v.preco_venda, 0);
  const paybackPct = investido > 0 ? Math.min(100, Math.round((lucroBruto / investido) * 100)) : 0;
  const roas = ads > 0 ? lucroBruto / ads : null;

  if (loading)
    return <p className="p-6 text-center text-[var(--ink)]/50">carregando painel...</p>;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
        Painel do Império
      </h1>
      <p className="text-sm text-[var(--ink)]/70">Visão geral da operação.</p>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Valor em estoque" valor={brl(valorEstoque)} sub={`${unidades} unidades`} />
        <Kpi titulo="Saldo de caixa" valor={brl(caixa)} negativo={caixa < 0} sub={aPagar > 0 ? `${brl(aPagar)} a pagar` : "sem contas abertas"} />
        <Kpi titulo="Lucro das vendas" valor={brl(lucroBruto)} negativo={lucroBruto < 0} sub={ads > 0 ? `${brl(lucroLiquido)} após ads` : `${vendas.length} vendas`} />
        <Kpi titulo="Vendido no mês" valor={brl(vendidoMes)} sub={ads > 0 ? `ads: ${brl(ads)}${roas ? ` · ROAS ${roas.toFixed(1)}x` : ""}` : "sem gasto de ads"} />
      </div>

      {/* payback */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs font-bold text-[var(--ink)]/60">
          <span>Payback do investimento ({brl(investido)})</span>
          <span>{brl(lucroBruto)} recuperado · {paybackPct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--purple)]/10">
          <div className="h-full rounded-full bg-[var(--purple)] transition-all" style={{ width: `${paybackPct}%` }} />
        </div>
        {investido > 0 && lucroBruto < investido && (
          <p className="mt-2 text-xs text-[var(--ink)]/55">
            Faltam {brl(investido - lucroBruto)} de lucro para pagar tudo que foi investido.
          </p>
        )}
      </div>

      {/* alerta de estoque */}
      {baixos.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-[var(--sun)] bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
            Estoque baixo ({baixos.length})
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {baixos.slice(0, 8).map((p) => (
              <span key={p.id} className={`rounded-full px-3 py-1 text-xs font-bold ${p.qtd_atual === 0 ? "bg-red-100 text-red-600" : "bg-[var(--sun)]/30 text-[var(--ink)]"}`}>
                {nomeProduto(p)}: {p.qtd_atual === 0 ? "esgotado" : `${p.qtd_atual} un`}
              </span>
            ))}
          </div>
          <Link href="/admin/compras" className="mt-3 inline-block text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">
            registrar uma compra
          </Link>
        </div>
      )}

      {/* atalhos */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center gap-3 rounded-2xl border-2 border-transparent bg-white p-3 shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-all hover:-translate-y-0.5 hover:border-[var(--purple)]"
          >
            <span className="text-xl">{c.emoji}</span>
            <span className="font-[family-name:var(--font-baloo)] font-bold text-[var(--purple-dark)]">{c.titulo}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, sub, negativo }: { titulo: string; valor: string; sub?: string; negativo?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className={`mt-1 font-[family-name:var(--font-baloo)] text-xl font-extrabold ${negativo ? "text-red-500" : "text-[var(--purple-dark)]"}`}>
        {valor}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--ink)]/50">{sub}</div>}
    </div>
  );
}
