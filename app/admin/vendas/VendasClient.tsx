"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { STATUS, PAGAMENTO, estornada, situacaoDespacho, situacaoPagamento, valorAReceber, hojeIso, lucroDaVenda, type StatusPedido, type SituacaoPagamento } from "@/lib/pedidos";
import { diasAtrasIso } from "@/lib/formato";
import { NovaVenda, type ProdutoVenda } from "./NovaVenda";
import { DetalheVenda, type VendaDetalhe, type ProdutoTroca } from "./DetalheVenda";
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
  cliente_id: string | null;
  recebido: number | null;
  ibk_venda_itens: {
    qtd: number;
    preco_unit: number;
    produto_id: string | null;
    produto: { nome: string | null; tamanho: string | null; cor: string | null; custo_unit: number; produto_pai_id: string | null } | null;
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
const lucroVenda = (v: VendaRow) => lucroDaVenda(v);

export function VendasClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [investido, setInvestido] = useState(0);
  const [ads, setAds] = useState<{ valor: number; data: string; produto_id: string | null }[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
  const [filtro, setFiltro] = useState<"todos" | StatusPedido>("todos");
  const [filtroPag, setFiltroPag] = useState<"todos" | SituacaoPagamento>("todos");
  const [legenda, setLegenda] = useState(false);
  // as somas usam todas as vendas; a tabela mostra aos poucos
  const [mostrar, setMostrar] = useState(50);
  // ?cliente=<id> vem do card em /admin/clientes
  const clienteFiltro = useSearchParams().get("cliente");


  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data: prod }, { data: vend, error }, { data: movs }, { data: cans }] = await Promise.all([
      supabase
        .from("ibk_produtos")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      buscarTodos<VendaRow>((de, ate) =>
        supabase!
          .from("ibk_vendas")
          .select("*, ibk_venda_itens(id, qtd, preco_unit, produto_id, produto:ibk_produtos(nome, tamanho, cor, custo_unit, produto_pai_id, tem_variacoes))")
          .order("data", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id")
          .range(de, ate),
      ),
      buscarTodos<{ valor: number; categoria: string; data: string; produto_id: string | null }>((de, ate) =>
        supabase!
          .from("ibk_movimentos")
          .select("valor, categoria, tipo, data, produto_id")
          .eq("tipo", "saida")
          .in("categoria", ["mercadoria", "insumo", "capex", "ads"])
          .order("id")
          .range(de, ate),
      ),
      supabase.from("ibk_canais").select("*").eq("ativo", true).order("ordem"),
    ]);
    if (error) setErro(error);
    setProdutos((prod as Produto[]) ?? []);
    setVendas(vend);
    const lista = movs;
    setInvestido(lista.filter((m) => m.categoria !== "ads").reduce((s, m) => s + m.valor, 0));
    setAds(lista.filter((m) => m.categoria === "ads"));
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
  /*
    Ads por produto, ultimos 30 dias: gasto lancado no caixa apontando pro
    produto x o que esse produto (e suas variacoes) vendeu no periodo.
    ROAS = vendido / gasto. ACOS = gasto / vendido. So aparece se houver ads
    ligado a produto.
  */
  const adsPorProduto = (() => {
    const desdeIso = diasAtrasIso(30);
    const gasto = new Map<string, number>();
    for (const a of ads) if (a.produto_id && a.data >= desdeIso) gasto.set(a.produto_id, (gasto.get(a.produto_id) ?? 0) + a.valor);
    if (gasto.size === 0) return [];
    const vendido = new Map<string, { valor: number; pedidos: Set<string> }>();
    for (const v of vendas) {
      if (estornada(v.status) || v.data < desdeIso) continue;
      for (const it of v.ibk_venda_itens) {
        const pai = it.produto?.produto_pai_id ?? it.produto_id;
        if (!pai || !gasto.has(pai)) continue;
        const r = vendido.get(pai) ?? { valor: 0, pedidos: new Set<string>() };
        r.valor += it.preco_unit * it.qtd;
        r.pedidos.add(v.id);
        vendido.set(pai, r);
      }
    }
    return [...gasto.entries()]
      .map(([id, g]) => {
        const p = produtos.find((x) => x.id === id);
        const v = vendido.get(id);
        return { id, nome: p ? (p.nome?.trim() || "Produto") : "produto", gasto: g, vendido: v?.valor ?? 0, pedidos: v?.pedidos.size ?? 0 };
      })
      .sort((x, y) => y.gasto - x.gasto);
  })();

  // somas gerais (venda devolvida sai do faturamento)
  const totalVendido = vendas.filter((v) => !estornada(v.status)).reduce((s, v) => s + v.preco_venda, 0);
  const devolvidas = vendas.filter((v) => v.status === "devolvido");
  const aguardando = vendas.filter((v) => v.status === "aguardando");
  const atrasadas = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "atrasado");
  const contagem = (s: StatusPedido) => vendas.filter((v) => v.status === s).length;
  const contagemPag = (s: SituacaoPagamento) => vendas.filter((v) => situacaoPagamento(v) === s).length;
  const doCliente = clienteFiltro ? vendas.filter((v) => v.cliente_id === clienteFiltro) : vendas;
  // entrega e pagamento filtram juntos: "entregue" + "a receber" = fiado que ja foi levado
  const visiveis = doCliente
    .filter((v) => filtro === "todos" || v.status === filtro)
    .filter((v) => filtroPag === "todos" || situacaoPagamento(v) === filtroPag);
  const pendentesPag = vendas.filter((v) => ["a_receber", "repasse"].includes(situacaoPagamento(v)));
  const totalAReceber = pendentesPag.reduce((s, v) => s + valorAReceber(v), 0);
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
          {pendentesPag.length > 0 && <Kpi titulo={`A receber (${pendentesPag.length})`} valor={brl(totalAReceber)} />}
          {devolvidas.length > 0 && (
            <Kpi
              titulo="Devoluções"
              valor={`${devolvidas.length} (${Math.round((devolvidas.length / vendas.length) * 100)}%)`}
            />
          )}
          <Link
            href="/admin/vendas/importar"
            className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)] transition-colors hover:bg-[var(--purple)]/16"
          >
            importar planilha
          </Link>
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
          produtos={produtos as unknown as ProdutoTroca[]}
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
      {/* ads por produto (30 dias) */}
      {adsPorProduto.length > 0 && (
        <div className="card mt-5 overflow-x-auto">
          <div className="flex items-center justify-between px-4 pt-3">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Ads por produto</h2>
            <span className="text-[11px] text-[var(--ink)]/70">últimos 30 dias · gasto lançado no caixa com o produto</span>
          </div>
          <table className="mt-2 w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-right">Gasto</th>
                <th className="p-3 text-right">Vendido</th>
                <th className="p-3 text-right">Pedidos</th>
                <th className="p-3 text-right">ROAS</th>
                <th className="p-3 text-right">ACOS</th>
              </tr>
            </thead>
            <tbody className="cascata">
              {adsPorProduto.map((r) => {
                const roas = r.gasto > 0 ? r.vendido / r.gasto : 0;
                const acos = r.vendido > 0 ? r.gasto / r.vendido : 1;
                // abaixo de 3x o anuncio come a margem de um kit a R$ 49,90 com 20% de taxa
                const cor = roas >= 5 ? "text-emerald-600" : roas >= 3 ? "text-amber-600" : "text-red-500";
                return (
                  <tr key={r.id} className="border-b border-[var(--purple)]/6 last:border-0">
                    <td className="p-3 font-semibold">{r.nome}</td>
                    <td className="num p-3 text-right text-red-500">{brl(r.gasto)}</td>
                    <td className="num p-3 text-right">{brl(r.vendido)}</td>
                    <td className="num p-3 text-right">{r.pedidos}</td>
                    <td className={`num p-3 text-right font-extrabold ${cor}`}>{roas.toFixed(1).replace(".", ",")}x</td>
                    <td className={`num p-3 text-right ${cor}`}>{Math.round(acos * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* filtros: entrega e pagamento sao coisas diferentes; atrasado e o que mais importa ver primeiro */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5">
        <span className="w-20 text-[10px] font-bold uppercase text-[var(--ink)]/70">Entrega</span>
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
        {clienteFiltro && (
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--purple)]/10 px-3 py-1 text-xs font-bold text-[var(--purple-dark)]">
            só deste cliente ({doCliente.length})
            <Link href="/admin/vendas" aria-label="tirar filtro" className="hover:text-red-500"><X size={12} weight="bold" /></Link>
          </span>
        )}
        {atrasadas.length > 0 && (
          <span className="ml-auto rounded-full bg-red-100 px-3 py-1 text-xs font-extrabold text-red-600">
            {atrasadas.length} {atrasadas.length === 1 ? "pedido atrasado" : "pedidos atrasados"}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="w-20 text-[10px] font-bold uppercase text-[var(--ink)]/70">Pagamento</span>
        {(["todos", "a_receber", "repasse", "pago", "estornado"] as const).map((f) => {
          const n = f === "todos" ? vendas.length : contagemPag(f);
          if (f !== "todos" && n === 0 && filtroPag !== f) return null;
          const ativo = filtroPag === f;
          return (
            <button
              key={f}
              onClick={() => setFiltroPag(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                ativo ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"
              }`}
            >
              {f === "todos" ? "todos" : PAGAMENTO[f].rotulo} <span className="num opacity-60">{n}</span>
            </button>
          );
        })}
        <button onClick={() => setLegenda((l) => !l)} className="ml-1 text-xs font-bold text-[var(--purple)] underline-offset-2 hover:underline" aria-expanded={legenda}>
          {legenda ? "esconder legenda" : "o que significa?"}
        </button>
      </div>
      {legenda && (
        <div className="fade-in mt-2 grid gap-3 rounded-xl bg-white/70 p-3 text-xs sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase text-[var(--ink)]/70">Entrega: onde o pedido está</div>
            <ul className="space-y-1">
              <li><Chip cor={STATUS.aguardando.cor}>{STATUS.aguardando.rotulo}</Chip> vendeu e ainda não postou (marketplace cobra em até 2 dias úteis)</li>
              <li><Chip cor={STATUS.enviado.cor}>{STATUS.enviado.rotulo}</Chip> postado, com rastreio, a caminho</li>
              <li><Chip cor={STATUS.entregue.cor}>{STATUS.entregue.rotulo}</Chip> chegou ou saiu na mão (loja física)</li>
              <li><Chip cor={STATUS.cancelado.cor}>{STATUS.cancelado.rotulo}</Chip> desistiu antes de receber: peça e dinheiro voltaram</li>
              <li><Chip cor={STATUS.devolvido.cor}>{STATUS.devolvido.rotulo}</Chip> voltou depois de entregue: fica o custo da devolução</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase text-[var(--ink)]/70">Pagamento: o dinheiro</div>
            <ul className="space-y-1">
              {(Object.keys(PAGAMENTO) as SituacaoPagamento[]).map((k) => (
                <li key={k}><Chip cor={PAGAMENTO[k].cor}>{PAGAMENTO[k].rotulo}</Chip> {PAGAMENTO[k].explica}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Data</th>
              <th className="p-3">Produtos</th>
              <th className="hidden p-3 sm:table-cell">Canal</th>
              <th className="p-3">Entrega</th>
              <th className="p-3">Pagamento</th>
              <th className="hidden p-3 xl:table-cell">Taxas</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Lucro</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={9} />}
            {!loading && visiveis.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[var(--ink)]/70">
                  {vendas.length === 0 ? "nenhuma venda registrada ainda." : "nada nesse status."}
                </td>
              </tr>
            )}
            {visiveis.slice(0, mostrar).map((v) => {
              const l = lucroVenda(v);
              const qtdItens = v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0);
              const st = STATUS[v.status] ?? STATUS.entregue;
              const desp = situacaoDespacho(v.data, v.status);
              const pag = situacaoPagamento(v);
              return (
                <tr key={v.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${estornada(v.status) ? "bg-red-50/40" : ""}`}>
                  <td className="whitespace-nowrap p-3">
                    <div>{new Date(v.data + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                    {v.pedido_externo && <div className="num text-[11px] text-[var(--ink)]/70">#{v.pedido_externo}</div>}
                  </td>
                  <td className="p-3">
                    <button onClick={() => setDetalhe(v as unknown as VendaDetalhe)} className="text-left font-semibold text-[var(--ink)] hover:text-[var(--purple)] hover:underline">
                      {resumoProdutos(v)}
                    </button>
                    <div className="text-[11px] text-[var(--ink)]/70">
                      {qtdItens} {qtdItens === 1 ? "item" : "itens"}
                      {v.cliente ? ` · ${v.cliente}` : ""}
                      {v.forma_pagamento ? ` · ${v.forma_pagamento}` : ""}
                    </div>
                  </td>
                  <td className="hidden p-3 capitalize sm:table-cell">{v.canal}</td>
                  <td className="p-3">
                    <Chip cor={desp?.nivel === "atrasado" ? "bg-red-100 text-red-600" : st.cor}>
                      {desp?.nivel === "atrasado" ? `atrasado ${desp.dias}d` : st.rotulo}
                    </Chip>
                  </td>
                  <td className="p-3">
                    <Chip cor={PAGAMENTO[pag].cor}>{PAGAMENTO[pag].rotulo}</Chip>
                    {(pag === "a_receber" || pag === "repasse") && (
                      <div className="num mt-0.5 text-[11px] text-[var(--ink)]/70">falta {brl(valorAReceber(v))}</div>
                    )}
                  </td>
                  <td className="hidden p-3 text-[var(--ink)]/60 xl:table-cell">
                    {brl(v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0))}
                  </td>
                  <td className={`whitespace-nowrap p-3 text-right font-semibold ${estornada(v.status) ? "text-[var(--ink)]/65 line-through" : ""}`}>{brl(v.preco_venda)}</td>
                  <td className={`whitespace-nowrap p-3 text-right font-bold ${l >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l)}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => setDetalhe(v as unknown as VendaDetalhe)} className="whitespace-nowrap rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                        detalhes
                      </button>
                      {v.status === "entregue" && (
                        <button onClick={() => setDetalhe(v as unknown as VendaDetalhe)} className="hidden rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/70 hover:text-red-600 lg:block" title="registrar devolução no detalhe">
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
        {visiveis.length > mostrar && (
          <button
            onClick={() => setMostrar((n) => n + 50)}
            className="w-full border-t border-[var(--purple)]/10 p-3 text-sm font-bold text-[var(--purple)] hover:bg-[var(--purple)]/5"
          >
            mostrar mais vendas (faltam {visiveis.length - mostrar})
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}

function Chip({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${cor}`}>{children}</span>;
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{titulo}</div>
      <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{valor}</div>
    </div>
  );
}
