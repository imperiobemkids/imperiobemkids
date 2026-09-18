"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "./SetupCard";
import { GRUPOS } from "./AdminNav";
import { SkeletonCards, Sparkline } from "./ui";
import { Check, Truck } from "@phosphor-icons/react";
import { situacaoDespacho, estornada, lucroDaVenda, type StatusPedido } from "@/lib/pedidos";

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
  taxa_fixa: number;
  insumo_custo: number;
  frete: number;
  devolvida: boolean;
  custo_devolucao: number;
  recebido: number | null;
  status: StatusPedido;
  pedido_externo: string | null;
  ibk_venda_itens: { qtd: number; produto: { custo_unit: number } | null }[];
};

type Rotina = { id: string; area: string; titulo: string; dias: number[] };

const ESTOQUE_BAIXO = 3;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

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


export function PainelClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const hoje = isoLocal(new Date());
  const diaSemana = ((new Date().getDay() + 6) % 7) + 1; // 1 = segunda

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: p }, { data: m }, { data: v }, { data: r }, { data: c }] = await Promise.all([
        supabase!.from("ibk_produtos").select("*").eq("ativo", true),
        supabase!.from("ibk_movimentos").select("tipo, categoria, valor, data, pago"),
        supabase!.from("ibk_vendas").select("*, ibk_venda_itens(qtd, produto:ibk_produtos(custo_unit))"),
        // rotinas de hoje: se a migration 0019 ainda nao rodou, vem erro e o bloco some
        supabase!.from("ibk_rotinas").select("id, area, titulo, dias").eq("ativo", true).contains("dias", [diaSemana]).order("area").order("ordem"),
        supabase!.from("ibk_rotina_checks").select("rotina_id").eq("data", hoje),
      ]);
      setProdutos((p as Produto[]) ?? []);
      setMovs((m as Mov[]) ?? []);
      setVendas((v as unknown as Venda[]) ?? []);
      setRotinas((r as Rotina[]) ?? []);
      setFeitas(new Set(((c as { rotina_id: string }[]) ?? []).map((x) => x.rotina_id)));
      setLoading(false);
    })();
  }, []);

  if (!supabaseConfigured) return <SetupCard />;

  const alternarRotina = async (r: Rotina) => {
    if (!supabase) return;
    const feito = feitas.has(r.id);
    setFeitas((f) => {
      const n = new Set(f);
      if (feito) n.delete(r.id);
      else n.add(r.id);
      return n;
    });
    const { error } = feito
      ? await supabase.from("ibk_rotina_checks").delete().eq("rotina_id", r.id).eq("data", hoje)
      : await supabase.from("ibk_rotina_checks").insert({ rotina_id: r.id, data: hoje });
    if (error)
      setFeitas((f) => {
        const n = new Set(f);
        if (feito) n.add(r.id);
        else n.delete(r.id);
        return n;
      });
  };

  // estoque
  const unidades = produtos.reduce((s, p) => s + p.qtd_atual, 0);
  const valorEstoque = produtos.reduce((s, p) => s + p.qtd_atual * p.custo_unit, 0);
  const baixos = produtos.filter((p) => p.qtd_atual <= ESTOQUE_BAIXO).sort((a, b) => a.qtd_atual - b.qtd_atual);

  // caixa
  const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  // saldo real: conta a pagar ainda nao saiu do caixa (aparece separada, embaixo)
  const saidas = movs.filter((m) => m.tipo === "saida" && m.pago).reduce((s, m) => s + m.valor, 0);
  const caixa = entradas - saidas;
  const aPagar = movs.filter((m) => !m.pago).reduce((s, m) => s + m.valor, 0);

  // investido (o que saiu para montar a operacao)
  const investido = movs
    .filter((m) => m.tipo === "saida" && ["mercadoria", "insumo", "capex"].includes(m.categoria))
    .reduce((s, m) => s + m.valor, 0);

  // ads
  const ads = movs.filter((m) => m.tipo === "saida" && m.categoria === "ads").reduce((s, m) => s + m.valor, 0);

  // lucro das vendas
  const lucroVenda = (v: Venda) => lucroDaVenda(v);
  const lucroBruto = vendas.reduce((s, v) => s + lucroVenda(v), 0);
  // dinheiro ja vendido que a plataforma ainda nao repassou
  const aReceber = vendas
    .filter((v) => !estornada(v.status) && v.recebido === null)
    .reduce((s, v) => s + (v.preco_venda * (1 - v.taxa_pct) - (v.taxa_fixa ?? 0) - v.frete), 0);
  const lucroLiquido = lucroBruto - ads;
  const vendidoMes = vendas.filter((v) => noMes(v.data) && !estornada(v.status)).reduce((s, v) => s + v.preco_venda, 0);
  // expedicao: o que ainda nao foi postado, e o que ja estourou o prazo
  const aguardando = vendas.filter((v) => v.status === "aguardando");
  const atrasados = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "atrasado");
  const vencendo = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "vence");
  // vendido por dia nos ultimos 14 dias, pro sparkline
  const serie14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dia = isoLocal(d);
    return vendas.filter((v) => v.data.slice(0, 10) === dia && !estornada(v.status)).reduce((s, v) => s + v.preco_venda, 0);
  });
  const paybackPct = investido > 0 ? Math.min(100, Math.round((lucroBruto / investido) * 100)) : 0;
  const roas = ads > 0 ? lucroBruto / ads : null;

  if (loading)
    return (
      <div className="page-in">
        <div className="skel h-3 w-20" />
        <div className="skel mt-2 h-8 w-56" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SkeletonCards n={4} />
        </div>
        <div className="skel mt-4 h-16" />
        <div className="skel mt-4 h-40" />
      </div>
    );

  const dataLonga = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const rotinasFeitas = rotinas.filter((r) => feitas.has(r.id)).length;

  return (
    <div className="page-in">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink)]/45">{dataLonga}</p>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
        {saudacao()}, Império 🧸
      </h1>

      {/* KPIs */}
      <div className="cascata mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Valor em estoque" valor={brl(valorEstoque)} sub={`${unidades} unidades`} />
        <Kpi titulo="Saldo de caixa" valor={brl(caixa)} negativo={caixa < 0} sub={aPagar > 0 ? `${brl(aPagar)} a pagar` : "sem contas abertas"} />
        <Kpi titulo="Lucro das vendas" valor={brl(lucroBruto)} negativo={lucroBruto < 0} sub={ads > 0 ? `${brl(lucroLiquido)} após ads` : `${vendas.length} vendas`} />
        <Kpi
          titulo={aReceber > 0 ? "A receber" : "Vendido no mês"}
          valor={brl(aReceber > 0 ? aReceber : vendidoMes)}
          sub={aReceber > 0 ? "repasse ainda não conciliado" : ads > 0 ? `ads: ${brl(ads)}${roas ? ` · ROAS ${roas.toFixed(1)}x` : ""}` : "sem gasto de ads"}
          grafico={serie14.some((v) => v > 0) ? <Sparkline valores={serie14} /> : null}
        />
      </div>

      {/* expedicao: a Shopee cobra postagem em 2 dias uteis; atrasado derruba a loja */}
      {aguardando.length > 0 && (
        <Link
          href="/admin/vendas"
          className={`card card-hover mt-4 flex items-center gap-3 p-4 ${atrasados.length > 0 ? "border-2 border-red-300" : vencendo.length > 0 ? "border-2 border-[var(--sun)]" : ""}`}
        >
          <Truck size={26} weight="duotone" className={atrasados.length > 0 ? "text-red-500" : "text-[var(--purple)]"} />
          <div className="flex-1">
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold leading-tight text-[var(--purple-dark)]">
              <span className="num">{aguardando.length}</span> {aguardando.length === 1 ? "pedido pra postar" : "pedidos pra postar"}
            </div>
            <div className="text-xs text-[var(--ink)]/55">
              {atrasados.length > 0
                ? `${atrasados.length} fora do prazo de 2 dias úteis`
                : vencendo.length > 0
                  ? `${vencendo.length} ${vencendo.length === 1 ? "vence" : "vencem"} hoje`
                  : "tudo dentro do prazo"}
            </div>
          </div>
          <span className="text-sm font-bold text-[var(--purple)]">ver vendas</span>
        </Link>
      )}

      {/* hoje: as rotinas do dia, marcaveis daqui mesmo */}
      {rotinas.length > 0 && (
        <div className="mt-4 card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Hoje
            </h2>
            <span
              className={`num rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                rotinasFeitas === rotinas.length ? "bg-emerald-100 text-emerald-700" : "bg-[var(--purple)]/8 text-[var(--purple)]"
              }`}
            >
              {rotinasFeitas}/{rotinas.length}
            </span>
          </div>
          <ul className="cascata mt-2 grid gap-1 sm:grid-cols-2">
            {rotinas.map((r) => {
              const feito = feitas.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => alternarRotina(r)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold ${
                      feito ? "bg-emerald-50 text-emerald-800" : "bg-[var(--purple)]/5 text-[var(--ink)] hover:bg-[var(--purple)]/10"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-extrabold ${
                        feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--purple)]/30"
                      }`}
                    >
                      {feito && <Check size={10} weight="bold" />}
                    </span>
                    <span className={`flex-1 ${feito ? "line-through opacity-70" : ""}`}>{r.titulo}</span>
                    <span className="text-[10px] font-bold uppercase text-[var(--ink)]/35">{r.area}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/tarefas" className="mt-3 inline-block text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">
            ver a semana
          </Link>
        </div>
      )}

      {/* payback */}
      <div className="mt-4 card p-4">
        <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs font-bold text-[var(--ink)]/60">
          <span>Payback do investimento ({brl(investido)})</span>
          <span>{brl(lucroBruto)} recuperado · {paybackPct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--purple)]/10">
          <div className="h-full rounded-full bg-[var(--purple)] transition-[transform,border-color,box-shadow,background-color]" style={{ width: `${paybackPct}%` }} />
        </div>
        {investido > 0 && lucroBruto < investido && (
          <p className="mt-2 text-xs text-[var(--ink)]/55">
            Faltam {brl(investido - lucroBruto)} de lucro para pagar tudo que foi investido.
          </p>
        )}
      </div>

      {/* alerta de estoque */}
      {baixos.length > 0 && (
        <div className="mt-4 card border-2 border-[var(--sun)] p-4">
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

      {/* atalhos so no celular: no desktop o menu lateral ja faz esse papel */}
      <div className="mt-6 flex flex-col gap-5 lg:hidden">
        {GRUPOS.map((g) => (
          <div key={g.nome}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/40">
              {g.nome}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.itens.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="flex items-center gap-3 card card-hover p-3"
                >
                  <c.icone size={22} weight="duotone" className="text-[var(--purple)]" />
                  <span className="font-[family-name:var(--font-baloo)] font-bold text-[var(--purple-dark)]">{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  sub,
  negativo,
  grafico,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  negativo?: boolean;
  grafico?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className={`num mt-1 font-[family-name:var(--font-baloo)] text-xl font-extrabold ${negativo ? "text-red-500" : "text-[var(--purple-dark)]"}`}>
        {valor}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--ink)]/50">{sub}</div>}
      {grafico}
    </div>
  );
}
