"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UploadSimple, Check, Warning, X } from "@phosphor-icons/react";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { SetupCard } from "../../SetupCard";
import { calcularTaxas } from "@/lib/canais";
import { STATUS, registrarVenda, hojeIso } from "@/lib/pedidos";
import {
  CAMPOS,
  agruparPedidos,
  detectarMapa,
  lerArquivo,
  resolverItens,
  type Campo,
  type CodigoCanal,
  type PedidoImportado,
  type ProdutoRef,
} from "@/lib/importacao";
import type { Canal } from "../../canais/CanaisClient";
import { acharOuCriarCliente } from "@/lib/clientes";

/*
  Importar pedidos da planilha do marketplace. Tres passos na mesma tela:
  1) canal + arquivo, 2) conferir colunas (so se algo nao foi reconhecido),
  3) conferir pedidos e importar. Pedido que ja existe (mesmo numero no
  mesmo canal) nao entra de novo: so atualiza status, rastreio e NF.
*/

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type Existente = { id: string; status: string; rastreio: string | null; nf_numero: string | null; pedido_externo: string | null; data: string; preco_venda: number };

// todas as vendas do canal (paginado): com mais de 1000, o corte faria o mesmo pedido entrar duas vezes
const existentesDoCanal = async (canalId: string): Promise<Existente[]> => {
  if (!supabase) return [];
  const { data } = await buscarTodos<Existente>((de, ate) =>
    supabase!.from("ibk_vendas").select("id, pedido_externo, status, rastreio, nf_numero, data, preco_venda").eq("canal_id", canalId).order("id").range(de, ate),
  );
  return data;
};

export function ImportarClient() {
  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalId, setCanalId] = useState("");
  const [produtos, setProdutos] = useState<ProdutoRef[]>([]);
  const [codigos, setCodigos] = useState<CodigoCanal[]>([]);
  const [existentes, setExistentes] = useState<Map<string, Existente>>(new Map());
  const [manuais, setManuais] = useState<Existente[]>([]); // registradas a mao, sem numero de pedido

  const [arquivo, setArquivo] = useState<string>("");
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [mapa, setMapa] = useState<Partial<Record<Campo, string>>>({});
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({}); // `${pedido}|${idx}` -> produto_id manual

  const [lendo, setLendo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ novos: number; atualizados: number; pulados: number } | null>(null);

  const carregarBase = useCallback(async () => {
    if (!supabase) return;
    const [c, p] = await Promise.all([
      supabase.from("ibk_canais").select("*").eq("ativo", true).order("ordem"),
      supabase.from("ibk_produtos").select("id, nome, tamanho, cor, produto_pai_id, tem_variacoes").eq("ativo", true),
    ]);
    const lista = (c.data as Canal[]) ?? [];
    setCanais(lista);
    setProdutos((p.data as ProdutoRef[]) ?? []);
    // canal padrao so na primeira carga; a lista nao depende do canal
    setCanalId((atual) => atual || lista.find((x) => /shopee/i.test(x.nome))?.id || lista[0]?.id || "");
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregarBase();
  }, [carregarBase]);

  // codigos do canal escolhido e pedidos que ja existem nele
  useEffect(() => {
    if (!supabase || !canalId) return;
    (async () => {
      const [cod, todas] = await Promise.all([
        supabase!.from("ibk_produto_canais").select("produto_id, id_anuncio, id_variacao, sku_canal").eq("canal_id", canalId),
        existentesDoCanal(canalId),
      ]);
      setCodigos((cod.data as CodigoCanal[]) ?? []);
      setExistentes(new Map(todas.filter((v) => v.pedido_externo).map((v) => [String(v.pedido_externo), v])));
      setManuais(todas.filter((v) => !v.pedido_externo));
    })();
  }, [canalId]);

  const aoEscolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    setErro("");
    setResultado(null);
    setLendo(true);
    try {
      const { cabecalhos, linhas } = await lerArquivo(file);
      if (!linhas.length) throw new Error("a planilha esta vazia");
      const m = detectarMapa(cabecalhos);
      setArquivo(file.name);
      setCabecalhos(cabecalhos);
      setLinhas(linhas);
      setMapa(m);
      setEscolhas({});
      const faltando = CAMPOS.filter((c) => c.obrigatorio && !m[c.campo]);
      setMostrarMapa(faltando.length > 0);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "nao consegui ler o arquivo");
    }
    setLendo(false);
  };

  const canal = canais.find((c) => c.id === canalId);
  const faltando = CAMPOS.filter((c) => c.obrigatorio && !mapa[c.campo]);

  const pedidos = useMemo<PedidoImportado[]>(() => {
    if (!linhas.length || faltando.length) return [];
    const ps = resolverItens(agruparPedidos(linhas, mapa), codigos, produtos);
    for (const p of ps) {
      p.itens.forEach((it, i) => {
        const manual = escolhas[`${p.pedido}|${i}`];
        if (manual) {
          it.produtoId = manual;
          it.como = "nome";
        }
      });
    }
    return ps;
  }, [linhas, mapa, codigos, produtos, escolhas, faltando.length]);

  const nomeProduto = (id: string | null) => {
    const p = produtos.find((x) => x.id === id);
    if (!p) return "";
    return [p.nome, p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ");
  };

  const totalDe = (p: PedidoImportado) => p.itens.reduce((s, it) => s + it.preco * it.qtd, 0);

  const classificar = (p: PedidoImportado) => {
    if (p.status === "ignorar") return { tipo: "pular" as const, motivo: "não pago" };
    const ex = existentes.get(p.pedido);
    if (ex) {
      if (ex.status === "cancelado" || ex.status === "devolvido") return { tipo: "pular" as const, motivo: `já ${ex.status} aqui, não mexe` };
      return { tipo: "atualizar" as const, motivo: `já existe (${STATUS[ex.status as keyof typeof STATUS]?.rotulo ?? ex.status})`, ex };
    }
    // venda registrada a mao no caixa, sem numero: mesmo dia e mesmo valor = e ela
    const manual = manuais.find((m) => m.data === p.data && Math.abs(m.preco_venda - totalDe(p)) < 0.01);
    if (manual) return { tipo: "vincular" as const, motivo: "venda manual do mesmo dia e valor: só grava o nº do pedido", ex: manual };
    if (p.status === "cancelado" || p.status === "devolvido") return { tipo: "pular" as const, motivo: `${p.status} na origem, nunca entrou aqui` };
    if (p.itens.some((it) => !it.produtoId)) return { tipo: "pular" as const, motivo: "produto não encontrado" };
    if (!p.data) return { tipo: "pular" as const, motivo: "sem data" };
    return { tipo: "novo" as const, motivo: "" };
  };

  const resumo = useMemo(() => {
    const r = { novo: 0, atualizar: 0, vincular: 0, pular: 0 };
    for (const p of pedidos) r[classificar(p).tipo]++;
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, existentes, manuais]);

  const importar = async () => {
    if (!supabase || !canal) return;
    setImportando(true);
    setErro("");
    let novos = 0, atualizados = 0, pulados = 0;

    try {
      for (const p of pedidos) {
        const c = classificar(p);
        if (c.tipo === "pular") { pulados++; continue; }

        if (c.tipo === "vincular") {
          const { error } = await supabase.from("ibk_vendas").update({ pedido_externo: p.pedido, rastreio: p.rastreio || null, nf_numero: p.nf || null }).eq("id", c.ex.id);
          if (error) { setErro(`pedido ${p.pedido}: ${error.message}`); break; }
          atualizados++;
          continue;
        }

        if (c.tipo === "atualizar") {
          // so anda pra frente no ciclo; cancelamento e devolucao ficam manuais
          const ordem = ["aguardando", "enviado", "entregue"];
          const patch: Record<string, unknown> = {};
          if (ordem.includes(p.status) && ordem.includes(c.ex.status) && ordem.indexOf(p.status) > ordem.indexOf(c.ex.status)) {
            patch.status = p.status;
            if (p.status !== "aguardando") patch.enviado_em = p.data;
            if (p.status === "entregue") patch.entregue_em = hojeIso();
          }
          if (p.rastreio && p.rastreio !== c.ex.rastreio) patch.rastreio = p.rastreio;
          if (p.nf && p.nf !== c.ex.nf_numero) patch.nf_numero = p.nf;
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("ibk_vendas").update(patch).eq("id", c.ex.id);
            if (error) { setErro(`pedido ${p.pedido}: ${error.message}`); break; }
            atualizados++;
          } else pulados++;
          continue;
        }

        // novo: a mesma sequencia do caixa, em lib/pedidos
        const itens = p.itens.map((it) => ({ precoUnit: it.preco, qtd: it.qtd }));
        const total = itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0);
        const desconto = p.itens.reduce((s, it) => s + Math.max(0, it.precoOriginal - it.preco) * it.qtd, 0);
        // taxa real da planilha quando existe; senao a tabela do canal
        const calc = calcularTaxas(canal, itens, 0);
        const r = await registrarVenda({
          data: p.data,
          canalNome: canal.nome,
          canalId: canal.id,
          itens: p.itens.map((it) => ({ produtoId: it.produtoId!, qtd: it.qtd, precoUnit: it.preco })),
          total,
          desconto,
          comissao: p.temTaxas ? p.taxas : calc.comissao,
          taxaFixa: p.temTaxas ? 0 : calc.fixa,
          insumo: canal.insumo_custo ?? 0,
          freteCobrado: p.freteComprador,
          cliente: p.comprador || null,
          clienteId: p.comprador ? await acharOuCriarCliente(p.comprador, canal.nome.toLowerCase()) : null,
          pedidoExterno: p.pedido,
          status: p.status as "aguardando" | "enviado" | "entregue",
          formaPagamento: "marketplace",
          rastreio: p.rastreio || null,
          enviadoEm: p.status === "enviado" || p.status === "entregue" ? p.data : null,
          entregueEm: p.status === "entregue" ? p.data : null,
          nfNumero: p.nf || null,
          obs: `importado de ${arquivo}`,
          descricaoCaixa: `Venda ${canal.nome} #${p.pedido}`,
        });
        if ("erro" in r) { setErro(`pedido ${p.pedido}: ${r.erro}`); break; }
        novos++;
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao importar");
    }

    setImportando(false);
    setResultado({ novos, atualizados, pulados });
    // recarrega os existentes pra nao importar duas vezes se clicar de novo
    const todas = await existentesDoCanal(canal.id);
    setExistentes(new Map(todas.filter((v) => v.pedido_externo).map((v) => [String(v.pedido_externo), v])));
    setManuais(todas.filter((v) => !v.pedido_externo));
  };

  if (!supabaseConfigured) return <SetupCard />;

  return (
    <div className="page-in">
      <Link href="/admin/vendas" className="text-sm font-bold text-[var(--purple)] hover:underline">
        <ArrowLeft size={14} weight="bold" className="inline-block align-[-2px]" /> voltar para vendas
      </Link>
      <h1 className="mt-1 font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
        Importar pedidos
      </h1>
      <p className="text-sm text-[var(--ink)]/65">
        Planilha exportada do Seller Center (Meus pedidos, Exportar). Cada pedido novo entra com itens, baixa de estoque e caixa.
      </p>

      {/* passo 1: canal e arquivo */}
      <div className="card mt-5 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Canal</span>
          <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={inp}>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-[var(--purple)]/30 px-4 py-2 text-sm font-bold text-[var(--purple)] hover:border-[var(--purple)]">
          <UploadSimple size={18} weight="bold" />
          {lendo ? "lendo..." : arquivo || "escolher planilha (.xlsx ou .csv)"}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => aoEscolherArquivo(e.target.files?.[0])} />
        </label>
        {linhas.length > 0 && (
          <span className="text-xs text-[var(--ink)]/75">
            {linhas.length} linhas · {pedidos.length} pedidos ·{" "}
            <button onClick={() => setMostrarMapa((v) => !v)} className="font-bold text-[var(--purple)] underline">
              {mostrarMapa ? "esconder colunas" : "conferir colunas"}
            </button>
          </span>
        )}
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* passo 2: mapa de colunas */}
      {mostrarMapa && cabecalhos.length > 0 && (
        <div className="card mt-4 p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Colunas</h2>
            {faltando.length > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-600">
                falta: {faltando.map((f) => f.rotulo).join(", ")}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">reconhecidas</span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS.map((c) => (
              <label key={c.campo} className="flex flex-col gap-1">
                <span className={`text-[10px] font-bold uppercase ${c.obrigatorio && !mapa[c.campo] ? "text-red-500" : "text-[var(--ink)]/70"}`}>
                  {c.rotulo}{c.obrigatorio && " *"}
                </span>
                <select
                  value={mapa[c.campo] ?? ""}
                  onChange={(e) => setMapa((m) => ({ ...m, [c.campo]: e.target.value || undefined }))}
                  className={inp}
                >
                  <option value="">(não usar)</option>
                  {cabecalhos.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* passo 3: pedidos */}
      {pedidos.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-700">{resumo.novo} novos</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-800">{resumo.atualizar} já existem</span>
            {resumo.vincular > 0 && <span className="rounded-full bg-[var(--purple)]/10 px-3 py-1 text-xs font-extrabold text-[var(--purple-dark)]">{resumo.vincular} manuais a vincular</span>}
            <span className="rounded-full bg-[var(--ink)]/8 px-3 py-1 text-xs font-extrabold text-[var(--ink)]/60">{resumo.pular} pulados</span>
            <button
              onClick={importar}
              disabled={importando || (resumo.novo === 0 && resumo.atualizar === 0 && resumo.vincular === 0)}
              className="ml-auto rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-50"
            >
              {importando ? "importando..." : `importar ${resumo.novo} ${resumo.novo === 1 ? "pedido" : "pedidos"}`}
            </button>
          </div>

          {resultado && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              Pronto: {resultado.novos} novos, {resultado.atualizados} atualizados, {resultado.pulados} pulados.{" "}
              <Link href="/admin/vendas" className="underline">ver vendas</Link>
            </p>
          )}

          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                  <th className="p-3 text-left">Pedido</th>
                  <th className="p-3 text-left">Itens</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Taxas</th>
                  <th className="p-3 text-left">Vai fazer</th>
                </tr>
              </thead>
              <tbody className="cascata">
                {pedidos.map((p) => {
                  const c = classificar(p);
                  const total = p.itens.reduce((s, it) => s + it.preco * it.qtd, 0);
                  return (
                    <tr key={p.pedido} className={`border-b border-[var(--purple)]/6 align-top last:border-0 ${c.tipo === "pular" ? "opacity-60" : ""}`}>
                      <td className="whitespace-nowrap p-3">
                        <div className="num font-semibold">#{p.pedido}</div>
                        <div className="text-[11px] text-[var(--ink)]/70">
                          {p.data ? new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR") : "sem data"}
                          {p.comprador && ` · ${p.comprador}`}
                        </div>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${p.status === "ignorar" ? "bg-[var(--ink)]/8 text-[var(--ink)]/70" : STATUS[p.status].cor}`}>
                          {p.status === "ignorar" ? "não pago" : STATUS[p.status].rotulo}
                        </span>
                      </td>
                      <td className="p-3">
                        {p.itens.map((it, i) => (
                          <div key={i} className="mb-1.5 last:mb-0">
                            <div className="text-[var(--ink)]">
                              <span className="num font-semibold">{it.qtd}x</span> {it.produtoNome}
                              {it.variacaoNome && <span className="text-[var(--ink)]/75"> · {it.variacaoNome}</span>}
                            </div>
                            {it.produtoId ? (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                                <Check size={12} weight="bold" /> {nomeProduto(it.produtoId)}
                                <span className="text-[var(--ink)]/65">(por {it.como})</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1 text-[11px] text-red-600">
                                <Warning size={12} weight="bold" /> não achei o produto:
                                <select
                                  value={escolhas[`${p.pedido}|${i}`] ?? ""}
                                  onChange={(e) => setEscolhas((s) => ({ ...s, [`${p.pedido}|${i}`]: e.target.value }))}
                                  className="rounded-md border border-red-300 bg-white px-1.5 py-0.5 text-[11px] text-[var(--ink)]"
                                >
                                  <option value="">escolher...</option>
                                  {produtos.filter((x) => !x.tem_variacoes).map((x) => (
                                    <option key={x.id} value={x.id}>{nomeProduto(x.id)}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="num whitespace-nowrap p-3 text-right font-semibold">{brl(total)}</td>
                      <td className="num whitespace-nowrap p-3 text-right text-[var(--ink)]/60">
                        {p.temTaxas ? brl(p.taxas) : <span className="text-[11px]">pela tabela</span>}
                      </td>
                      <td className="p-3 text-xs">
                        {c.tipo === "novo" && <span className="font-bold text-emerald-700">criar venda</span>}
                        {c.tipo === "atualizar" && <span className="font-bold text-sky-800">atualizar · {c.motivo}</span>}
                        {c.tipo === "vincular" && <span className="font-bold text-[var(--purple-dark)]">vincular · {c.motivo}</span>}
                        {c.tipo === "pular" && (
                          <span className="flex items-center gap-1 font-bold text-[var(--ink)]/70">
                            <X size={12} weight="bold" /> {c.motivo}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const inp =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";
