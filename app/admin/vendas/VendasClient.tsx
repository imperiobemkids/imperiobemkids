"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { STATUS, estornada, estornarVenda, situacaoDespacho, type StatusPedido } from "@/lib/pedidos";
import { NovaVenda, type ProdutoVenda } from "./NovaVenda";
import { DetalheVenda, type VendaDetalhe } from "./DetalheVenda";
import type { Canal } from "../canais/CanaisClient";
import { SetupCard } from "../SetupCard";
import { SkeletonRows } from "../ui";

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
  canal_id: string | null;
  cliente: string | null;
  forma_pagamento: string | null;
  desconto: number;
  frete_cobrado: number;
  qtd_itens: number;
  devolvida: boolean;
  data_devolucao: string | null;
  custo_devolucao: number;
  status: StatusPedido;
  pedido_externo: string | null;
  rastreio: string | null;
  ibk_venda_itens: {
    qtd: number;
    preco_unit: number;
    produto_id: string | null;
    produto: { nome: string | null; tamanho: string | null; cor: string | null; custo_unit: number } | null;
  }[];
};

// primeiro produto da venda, com "+N" quando ha mais de um
const resumoProdutos = (v: VendaRow) => {
  const itens = v.ibk_venda_itens ?? [];
  if (itens.length === 0) return "venda sem itens";
  const p = itens[0].produto;
  const nome = [p?.nome?.trim() || "Produto", p?.tamanho && `tam ${p.tamanho}`, p?.cor].filter(Boolean).join(" · ");
  return itens.length > 1 ? `${nome} +${itens.length - 1}` : nome;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/*
  lucro = preco liquido - custo dos itens - insumo - frete
  Venda devolvida nao gera lucro: o produto volta ao estoque e sobra o
  prejuizo da devolucao (frete reverso + parte da comissao que nao volta).
*/
const lucroVenda = (v: VendaRow) => {
  if (v.status === "cancelado") return 0;
  if (v.devolvida || v.status === "devolvido") return -(v.custo_devolucao ?? 0);
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
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
  const [filtro, setFiltro] = useState<"todos" | StatusPedido>("todos");


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
        .select("*, ibk_venda_itens(qtd, preco_unit, produto_id, produto:ibk_produtos(nome, tamanho, cor, custo_unit))")
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
    const resposta = prompt(
      `Devolver a venda de ${brl(v.preco_venda)}?\n\nQuanto essa devolução vai custar (frete reverso + comissão que a Shopee não devolve)?`,
      "0",
    );
    if (resposta === null) return;
    const custoDev = parseFloat(resposta.replace(",", ".")) || 0;
    setErro("");
    const erro = await estornarVenda(v, "devolvido", custoDev);
    if (erro) setErro(erro);
    carregar();
  };

  // somas gerais (venda devolvida sai do faturamento)
  const totalVendido = vendas.filter((v) => !estornada(v.status)).reduce((s, v) => s + v.preco_venda, 0);
  const devolvidas = vendas.filter((v) => v.status === "devolvido");
  const aguardando = vendas.filter((v) => v.status === "aguardando");
  const atrasadas = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "atrasado");
  const contagem = (s: StatusPedido) => vendas.filter((v) => v.status === s).length;
  const visiveis = filtro === "todos" ? vendas : vendas.filter((v) => v.status === filtro);
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
          <button
            onClick={() => setCaixaAberto((v) => !v)}
            className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]"
          >
            {caixaAberto ? "fechar caixa" : "+ Nova venda"}
          </button>
        </div>
      </div>

      {/* o caixa abre pelo botao, para nao ocupar a tela o tempo todo */}
      {caixaAberto && (
        <div className="mt-5">
          <NovaVenda
            produtos={produtos as unknown as ProdutoVenda[]}
            canais={canais}
            aoRegistrar={() => { carregar(); setCaixaAberto(false); }}
          />
        </div>
      )}


      {detalhe && (
        <DetalheVenda
          venda={detalhe}
          canais={canais}
          onFechar={() => setDetalhe(null)}
          onSalvo={() => { setDetalhe(null); carregar(); }}
        />
      )}

      {/* payback bar */}
      <div className="mt-5 card p-4">
        <div className="mb-1 flex justify-between text-xs font-bold text-[var(--ink)]/60">
          <span>Payback do investido ({brl(investido)})</span>
          <span>{brl(lucroAcum)} de lucro</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--purple)]/10">
          <div className="h-full rounded-full bg-[var(--purple)] transition-[transform,border-color,box-shadow,background-color]" style={{ width: `${paybackPct}%` }} />
        </div>
      </div>

      {/* lista de vendas */}
      {/* filtro por status; atrasado e o que mais importa ver primeiro */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        {(["todos", "aguardando", "enviado", "entregue", "cancelado", "devolvido"] as const).map((f) => {
          const n = f === "todos" ? vendas.length : contagem(f);
          if (f !== "todos" && n === 0 && filtro !== f) return null;
          const ativo = filtro === f;
          return (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                ativo ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"
              }`}
            >
              {f === "todos" ? "todos" : STATUS[f].rotulo} <span className="num opacity-60">{n}</span>
            </button>
          );
        })}
        {atrasadas.length > 0 && (
          <span className="ml-auto rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-600">
            {atrasadas.length} {atrasadas.length === 1 ? "pedido atrasado" : "pedidos atrasados"}
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Pedido</th>
              <th className="p-3">Produtos</th>
              <th className="hidden p-3 sm:table-cell">Canal</th>
              <th className="hidden p-3 lg:table-cell">Taxas</th>
              <th className="p-3">Total</th>
              <th className="p-3">Lucro</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={7} />}
            {!loading && visiveis.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">
                  {vendas.length === 0 ? "nenhuma venda registrada ainda." : "nada nesse status."}
                </td>
              </tr>
            )}
            {visiveis.map((v) => {
              const l = lucroVenda(v);
              const qtdItens = v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0);
              const st = STATUS[v.status] ?? STATUS.entregue;
              const desp = situacaoDespacho(v.data, v.status);
              return (
                <tr key={v.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${estornada(v.status) ? "bg-red-50/40" : ""}`}>
                  <td className="whitespace-nowrap p-3">
                    <div>{new Date(v.data + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                    {v.pedido_externo && <div className="num text-[11px] text-[var(--ink)]/45">#{v.pedido_externo}</div>}
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${desp?.nivel === "atrasado" ? "bg-red-100 text-red-600" : st.cor}`}>
                      {desp?.nivel === "atrasado" ? `atrasado ${desp.dias}d` : st.rotulo}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => setDetalhe(v as unknown as VendaDetalhe)} className="text-left font-semibold text-[var(--ink)] hover:text-[var(--purple)] hover:underline">
                      {resumoProdutos(v)}
                    </button>
                    <div className="text-[11px] text-[var(--ink)]/45">
                      {qtdItens} {qtdItens === 1 ? "item" : "itens"}
                      {v.cliente ? ` · ${v.cliente}` : ""}
                      {v.forma_pagamento ? ` · ${v.forma_pagamento}` : ""}
                    </div>
                  </td>
                  <td className="hidden p-3 capitalize sm:table-cell">{v.canal}</td>
                  <td className="hidden p-3 text-[var(--ink)]/60 lg:table-cell">
                    {brl(v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0))}
                  </td>
                  <td className={`whitespace-nowrap p-3 font-semibold ${estornada(v.status) ? "text-[var(--ink)]/40 line-through" : ""}`}>{brl(v.preco_venda)}</td>
                  <td className={`whitespace-nowrap p-3 font-bold ${l >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setDetalhe(v as unknown as VendaDetalhe)} className="whitespace-nowrap rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                        detalhes
                      </button>
                      {v.status === "entregue" && (
                        <button onClick={() => devolver(v)} className="hidden rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/50 hover:text-red-600 lg:block" title="registrar devolução">
                          devolver
                        </button>
                      )}
                    </div>
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
