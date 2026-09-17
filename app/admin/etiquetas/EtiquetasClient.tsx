"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, MagnifyingGlass } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonRows, Vazio, btnPrimario } from "../ui";
import { STATUS, type StatusPedido } from "@/lib/pedidos";
import { imprimirRomaneios, imprimirEtiquetasProduto } from "@/lib/etiquetas";
import { EMPRESA } from "@/lib/empresa";

/*
  Impressao em 100x150 na termica. Duas coisas: o romaneio do pedido (vai no
  pacote: itens pra conferir e o QR do grupo) e a etiqueta de produto (nome,
  tamanho, SKU e codigo de barras, pra organizar o estoque).
*/

type Venda = {
  id: string;
  data: string;
  canal: string;
  cliente: string | null;
  pedido_externo: string | null;
  status: StatusPedido;
  ibk_venda_itens: { qtd: number; produto: { nome: string | null; tamanho: string | null; cor: string | null } | null }[];
};

type Produto = {
  id: string;
  nome: string | null;
  tamanho: string | null;
  cor: string | null;
  sku: string | null;
  qtd_atual: number;
  tem_variacoes: boolean;
  produto_pai_id: string | null;
  pai?: { nome: string | null } | null;
};

const dataBr = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");
const nomeItem = (p: { nome: string | null; tamanho: string | null; cor: string | null } | null) =>
  p ? [p.nome?.trim() || "Produto", p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ") : "produto removido";

export function EtiquetasClient() {
  const [aba, setAba] = useState<"romaneio" | "produto">("romaneio");
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [selV, setSelV] = useState<Set<string>>(new Set());
  const [qtdP, setQtdP] = useState<Record<string, number>>({}); // produto_id -> quantas etiquetas
  const [filtroV, setFiltroV] = useState<"aguardando" | "enviado" | "todas">("aguardando");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [v, p] = await Promise.all([
      supabase
        .from("ibk_vendas")
        .select("id, data, canal, cliente, pedido_externo, status, ibk_venda_itens(qtd, produto:ibk_produtos(nome, tamanho, cor))")
        .order("data", { ascending: false })
        .limit(200),
      supabase
        .from("ibk_produtos")
        .select("id, nome, tamanho, cor, sku, qtd_atual, tem_variacoes, produto_pai_id, pai:produto_pai_id(nome)")
        .eq("ativo", true)
        .order("nome"),
    ]);
    if (v.error) setErro(v.error.message);
    setVendas((v.data as unknown as Venda[]) ?? []);
    setProdutos((p.data as unknown as Produto[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  const vendasVisiveis = useMemo(
    () => (filtroV === "todas" ? vendas : vendas.filter((v) => v.status === filtroV)),
    [vendas, filtroV],
  );

  // etiqueta de produto: so o que tem estoque proprio (variacao ou avulso)
  const produtosVisiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .filter((p) => !p.tem_variacoes)
      .map((p) => ({ ...p, nomeCompleto: (p.nome?.trim() || p.pai?.nome?.trim() || "Produto") }))
      .filter((p) => !q || `${p.nomeCompleto} ${p.tamanho ?? ""} ${p.cor ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(q));
  }, [produtos, busca]);

  if (!supabaseConfigured) return <SetupCard />;

  // so em clique: no prerender nao existe window
  const opts = () => ({ logoUrl: `${window.location.origin}/logo.png`, marca: EMPRESA.nomeFantasia });

  const imprimirRom = async () => {
    setErro("");
    const lista = vendas.filter((v) => selV.has(v.id));
    if (!lista.length) return setErro("marque ao menos um pedido");
    try {
      await imprimirRomaneios(
        lista.map((v) => ({
          pedido: v.pedido_externo ? `#${v.pedido_externo}` : dataBr(v.data),
          canal: v.canal,
          cliente: v.cliente ?? "",
          data: dataBr(v.data),
          itens: v.ibk_venda_itens.map((i) => ({ qtd: i.qtd, nome: nomeItem(i.produto) })),
        })),
        {
          ...opts(),
          qrUrl: EMPRESA.grupoAchadinhos,
          qrTexto: `Escaneia e entra no grupo de achadinhos: as promoções caem lá primeiro. Dúvida ou troca? WhatsApp ${EMPRESA.whatsapp}.`,
        },
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao imprimir");
    }
  };

  const imprimirProd = () => {
    setErro("");
    const lista = produtosVisiveis.filter((p) => (qtdP[p.id] ?? 0) > 0);
    if (!lista.length) return setErro("informe quantas etiquetas de cada produto");
    try {
      imprimirEtiquetasProduto(
        lista.map((p) => ({
          nome: p.nomeCompleto,
          tamanho: p.tamanho ?? "",
          cor: p.cor ?? "",
          sku: p.sku?.trim() || p.id.slice(0, 8).toUpperCase(),
          qtd: qtdP[p.id] ?? 0,
        })),
        opts(),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao imprimir");
    }
  };

  const totalEtiquetas = Object.values(qtdP).reduce((s, n) => s + (n || 0), 0);

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
            Etiquetas
          </h1>
          <p className="text-sm text-[var(--ink)]/65">Impressão em 100x150 mm na térmica. Abre a prévia e manda imprimir.</p>
        </div>
        <div className="flex gap-1">
          {(["romaneio", "produto"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${aba === a ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/8 text-[var(--purple)]"}`}
            >
              {a === "romaneio" ? "Romaneio do pedido" : "Etiqueta de produto"}
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {aba === "romaneio" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(["aguardando", "enviado", "todas"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroV(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${filtroV === f ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"}`}
              >
                {f === "todas" ? "todas" : STATUS[f].rotulo}
              </button>
            ))}
            <span className="text-xs text-[var(--ink)]/50">
              <button onClick={() => setSelV(new Set(vendasVisiveis.map((v) => v.id)))} className="font-bold text-[var(--purple)] underline">
                marcar todas
              </button>{" "}
              ·{" "}
              <button onClick={() => setSelV(new Set())} className="font-bold text-[var(--purple)] underline">
                limpar
              </button>
            </span>
            <button onClick={imprimirRom} disabled={selV.size === 0} className={`ml-auto flex items-center gap-1.5 ${btnPrimario}`}>
              <Printer size={16} weight="bold" /> imprimir {selV.size > 0 && `(${selV.size})`}
            </button>
          </div>

          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                  <th className="w-10 p-3" />
                  <th className="p-3 text-left">Pedido</th>
                  <th className="p-3 text-left">Cliente</th>
                  <th className="p-3 text-left">Itens</th>
                </tr>
              </thead>
              <tbody className="cascata">
                {loading && <SkeletonRows cols={4} />}
                {!loading && vendasVisiveis.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[var(--ink)]/50">nenhum pedido nesse filtro.</td>
                  </tr>
                )}
                {vendasVisiveis.map((v) => {
                  const on = selV.has(v.id);
                  return (
                    <tr
                      key={v.id}
                      onClick={() =>
                        setSelV((s) => {
                          const n = new Set(s);
                          if (on) n.delete(v.id);
                          else n.add(v.id);
                          return n;
                        })
                      }
                      className={`cursor-pointer border-b border-[var(--purple)]/6 last:border-0 ${on ? "bg-[var(--purple)]/5" : "hover:bg-[var(--purple)]/3"}`}
                    >
                      <td className="p-3 text-center">
                        <input type="checkbox" checked={on} readOnly className="h-4 w-4 accent-[var(--purple)]" />
                      </td>
                      <td className="whitespace-nowrap p-3">
                        <div className="num font-semibold">{v.pedido_externo ? `#${v.pedido_externo}` : dataBr(v.data)}</div>
                        <div className="text-[11px] capitalize text-[var(--ink)]/50">{v.canal} · {dataBr(v.data)}</div>
                      </td>
                      <td className="p-3">{v.cliente ?? <span className="text-[var(--ink)]/35">sem nome</span>}</td>
                      <td className="p-3 text-[var(--ink)]/80">
                        {v.ibk_venda_itens.map((i, idx) => (
                          <div key={idx}><span className="num font-bold">{i.qtd}x</span> {nomeItem(i.produto)}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === "produto" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2">
              <MagnifyingGlass size={16} className="text-[var(--ink)]/40" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, tamanho, SKU" className="w-48 bg-transparent text-sm outline-none" />
            </label>
            <span className="text-xs text-[var(--ink)]/50">
              <button
                onClick={() => setQtdP(Object.fromEntries(produtosVisiveis.map((p) => [p.id, Math.max(0, p.qtd_atual)])))}
                className="font-bold text-[var(--purple)] underline"
              >
                uma por unidade em estoque
              </button>{" "}
              ·{" "}
              <button onClick={() => setQtdP({})} className="font-bold text-[var(--purple)] underline">
                zerar
              </button>
            </span>
            <button onClick={imprimirProd} disabled={totalEtiquetas === 0} className={`ml-auto flex items-center gap-1.5 ${btnPrimario}`}>
              <Printer size={16} weight="bold" /> imprimir {totalEtiquetas > 0 && `(${totalEtiquetas})`}
            </button>
          </div>

          {!loading && produtosVisiveis.some((p) => !p.sku) && (
            <p className="mt-2 text-xs text-amber-700">
              produto sem SKU cadastrado sai com um código provisório; cadastre o SKU na ficha pra etiqueta bater com o estoque.
            </p>
          )}

          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-left">SKU</th>
                  <th className="p-3 text-right">Estoque</th>
                  <th className="w-28 p-3 text-right">Etiquetas</th>
                </tr>
              </thead>
              <tbody className="cascata">
                {loading && <SkeletonRows cols={4} />}
                {!loading && produtosVisiveis.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6">
                      <Vazio emoji="🏷️" titulo="Nenhum produto" texto="Cadastre produtos no estoque pra imprimir etiquetas." />
                    </td>
                  </tr>
                )}
                {produtosVisiveis.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--purple)]/6 last:border-0">
                    <td className="p-3">
                      <span className="font-semibold">{p.nomeCompleto}</span>
                      {(p.tamanho || p.cor) && (
                        <span className="text-[var(--ink)]/55"> · {[p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ")}</span>
                      )}
                    </td>
                    <td className="num p-3 font-mono text-xs">{p.sku ?? <span className="text-[var(--ink)]/35">sem SKU</span>}</td>
                    <td className="num p-3 text-right">{p.qtd_atual}</td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min={0}
                        value={qtdP[p.id] ?? ""}
                        onChange={(e) => setQtdP((q) => ({ ...q, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        placeholder="0"
                        className="num w-20 rounded-lg border border-[var(--purple)]/20 px-2 py-1 text-right text-sm outline-none focus:border-[var(--purple)]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
