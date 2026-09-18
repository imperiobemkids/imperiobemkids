"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Canal } from "../canais/CanaisClient";
import { taxaDoPreco, programaPct } from "@/lib/canais";
import { SetupCard } from "../SetupCard";
import { btnPrimario } from "../ui";
import { num, txt, brl, pct } from "@/lib/formato";

/*
  Precificacao. Tres blocos:
  1) simulador: custo, kit, preco e ads de um produto num canal escolhido. A
     taxa vem do cadastro do canal (comissao ou faixa pelo preco, fixa por
     item, programa), nao de um campo digitado: o que muda em Canais muda aqui.
  2) tabela do estoque: preco sugerido de cada produto pela margem alvo no
     canal escolhido, agrupado por produto (a variacao herda o custo), com o
     botao que grava o preco no produto e nas variacoes.
  3) comparativo: o mesmo produto em cada canal, para a mesma margem.
*/

type SKU = {
  id: string;
  nome: string | null;
  linha: "verao" | "inverno" | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
  qtd_atual: number;
  preco_venda: number | null;
  produto_pai_id: string | null;
  tem_variacoes: boolean;
};

const nome = (s: SKU) => {
  if (s.nome && s.nome.trim()) return s.nome.trim();
  const linha = s.linha === "verao" ? "Verão" : s.linha === "inverno" ? "Inverno" : "";
  return [linha, s.genero].filter(Boolean).join(" ") || "Produto";
};


/* termina o preco em ,90, pratica de varejo */
const termina90 = (v: number) => {
  const base = Math.floor(v);
  return (v <= base + 0.9 ? base : base + 1) + 0.9;
};

/*
  preco a partir da margem: lucro = preco*(1-taxa) - custoFixo, margem = lucro/preco
  logo preco = custoFixo / (1 - taxa - margem). A fixa por item entra no custo
  (nao depende do preco); a comissao entra no divisor. Canal com faixa muda a
  taxa conforme o preco, entao resolve em duas passadas.
*/
function precoPelaMargem(canal: Canal | undefined, custoBase: number, unidades: number, extras: number, margem: number, arredondar: boolean) {
  const porItem = canal?.taxa_fixa_por_item ?? true;
  const calc = (precoEstimado: number) => {
    const t = taxaDoPreco(canal, precoEstimado);
    const fixa = porItem ? t.fixo * unidades : t.fixo;
    const custoFixo = custoBase + extras + fixa;
    const divisor = 1 - t.pct - margem;
    // taxa + margem passam de 100%: nao existe preco que feche; devolve 0 e a tela avisa
    if (divisor <= 0) return { preco: 0, t, fixa, custoFixo, impossivel: true };
    const bruto = custoFixo / divisor;
    const preco = arredondar ? termina90(bruto) : Math.round(bruto * 100) / 100;
    return { preco, t, fixa, custoFixo, impossivel: false };
  };
  let r = calc(custoBase * 1.6);
  if (!r.impossivel) r = calc(r.preco);
  const lucro = r.impossivel ? 0 : r.preco * (1 - r.t.pct) - r.custoFixo;
  return { preco: r.preco, lucro, margem: r.preco > 0 ? lucro / r.preco : 0, taxaPct: r.t.pct, fixa: r.fixa, impossivel: r.impossivel };
}

export function SimuladorClient() {
  const [skus, setSkus] = useState<SKU[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [canalId, setCanalId] = useState("");
  const [salvos, setSalvos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");

  // simulador
  const [produtoId, setProdutoId] = useState("");
  const [custoConj, setCustoConj] = useState("14,90");
  const [qtdKit, setQtdKit] = useState("1");
  const [preco, setPreco] = useState("49,90");
  const [frete, setFrete] = useState("0");
  const [cpa, setCpa] = useState("0");
  const [orcAds, setOrcAds] = useState("50");

  // tabela
  const [margemAlvo, setMargemAlvo] = useState("35");
  const [arredondar, setArredondar] = useState(true);

  const carregar = async () => {
    if (!supabase) return;
    const [p, c] = await Promise.all([
      supabase.from("ibk_produtos").select("id, nome, linha, genero, tamanho, custo_unit, qtd_atual, preco_venda, produto_pai_id, tem_variacoes").eq("ativo", true).order("nome"),
      supabase.from("ibk_canais").select("*").eq("ativo", true).order("ordem"),
    ]);
    setSkus((p.data as SKU[]) ?? []);
    const cs = (c.data as Canal[]) ?? [];
    setCanais(cs);
    setCanalId((atual) => atual || cs.find((x) => /shopee/i.test(x.nome))?.id || cs[0]?.id || "");
  };

  useEffect(() => {
    if (supabaseConfigured) carregar();
  }, []);

  const canal = canais.find((c) => c.id === canalId);
  const porItem = canal?.taxa_fixa_por_item ?? true;

  // produtos da tabela: pai ou avulso; a variacao so herda
  const produtos = useMemo(() => {
    const filhosDe = (id: string) => skus.filter((s) => s.produto_pai_id === id);
    return skus
      .filter((s) => !s.produto_pai_id)
      .map((s) => {
        const filhos = filhosDe(s.id);
        const custo = s.custo_unit || filhos[0]?.custo_unit || 0;
        const estoque = filhos.length ? filhos.reduce((a, f) => a + f.qtd_atual, 0) : s.qtd_atual;
        const precoAtual = s.preco_venda ?? filhos.find((f) => f.preco_venda)?.preco_venda ?? null;
        return { s, filhos, custo, estoque, precoAtual };
      });
  }, [skus]);

  if (!supabaseConfigured) return <SetupCard />;

  // ---------- simulador ----------
  const custoConjN = num(custoConj);
  const qtd = Math.max(1, Math.round(num(qtdKit)));
  const precoN = num(preco);
  const freteN = num(frete);
  const cpaN = num(cpa);
  const orcN = num(orcAds);
  const insumoN = canal?.insumo_custo ?? 0.4;

  const t = taxaDoPreco(canal, precoN);
  const fixaN = porItem ? t.fixo * qtd : t.fixo;
  const comissaoN = precoN * t.pct;
  const custoProduto = custoConjN * qtd;
  const custoPedido = custoProduto + insumoN + freteN + fixaN;
  const liquido = precoN - comissaoN - fixaN;
  const lucroSemAds = precoN - comissaoN - custoPedido;
  const lucroComAds = lucroSemAds - cpaN;
  const margem = precoN > 0 ? lucroComAds / precoN : 0;
  const maxCpa = lucroSemAds;
  const vendasBreakeven = lucroSemAds > 0 ? Math.ceil(orcN / lucroSemAds) : Infinity;
  const extraPrograma = programaPct(canal);

  const escada = [-10, -5, 0, 5, 10].map((d) => {
    const p = precoN + d;
    const tt = taxaDoPreco(canal, p);
    const fx = porItem ? tt.fixo * qtd : tt.fixo;
    const lucro = p * (1 - tt.pct) - fx - custoProduto - insumoN - freteN - cpaN;
    return { p, lucro, margem: p > 0 ? lucro / p : 0 };
  });

  const puxar = (id: string) => {
    setProdutoId(id);
    const p = produtos.find((x) => x.s.id === id);
    if (p) {
      setCustoConj(txt(p.custo));
      if (p.precoAtual) setPreco(txt(p.precoAtual));
    }
  };

  // ---------- tabela ----------
  const margemN = num(margemAlvo) / 100;
  const linhas = produtos.map((p) => {
    const r = precoPelaMargem(canal, p.custo, 1, insumoN + cpaN, margemN, arredondar);
    return { ...p, ...r, potencial: r.lucro * p.estoque, receita: r.preco * p.estoque };
  });
  const totalUnidades = linhas.reduce((s, l) => s + l.estoque, 0);
  const totalCusto = linhas.reduce((s, l) => s + l.estoque * l.custo, 0);
  const totalReceita = linhas.reduce((s, l) => s + l.receita, 0);
  const totalLucro = linhas.reduce((s, l) => s + l.potencial, 0);

  const gravarPreco = async (l: (typeof linhas)[number]) => {
    if (!supabase) return;
    setErro("");
    const ids = [l.s.id, ...l.filhos.map((f) => f.id)];
    const { error } = await supabase.from("ibk_produtos").update({ preco_venda: l.preco }).in("id", ids);
    if (error) return setErro(error.message);
    setSalvos((s) => new Set(s).add(l.s.id));
    setSkus((arr) => arr.map((s) => (ids.includes(s.id) ? { ...s, preco_venda: l.preco } : s)));
    setTimeout(() => setSalvos((s) => { const n = new Set(s); n.delete(l.s.id); return n; }), 2500);
  };

  // ---------- comparativo ----------
  const comparativo = canais.map((c) => ({ canal: c, ...precoPelaMargem(c, custoConjN * qtd, qtd, c.insumo_custo + cpaN + freteN, margemN, arredondar) }));

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">Precificação</h1>
          <p className="text-sm text-[var(--ink)]/65">
            A taxa vem do cadastro do canal (comissão, fixa por item, faixa, programa). O que mudar em Canais muda aqui.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Canal</span>
          <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={inp}>
            {canais.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </label>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* entradas */}
        <div className="card p-4">
          <Campo label="Produto (puxa custo e preço atual)">
            <select value={produtoId} onChange={(e) => puxar(e.target.value)} className={inp}>
              <option value="">digitar à mão...</option>
              {produtos.map((p) => (
                <option key={p.s.id} value={p.s.id}>{nome(p.s)} ({brl(p.custo)}{p.filhos.length ? `, ${p.filhos.length} var.` : ""})</option>
              ))}
            </select>
          </Campo>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo label="Custo por unidade"><input value={custoConj} onChange={(e) => setCustoConj(e.target.value)} inputMode="decimal" className={`${inp} num`} /></Campo>
            <Campo label="Unidades no pedido"><input value={qtdKit} onChange={(e) => setQtdKit(e.target.value)} inputMode="numeric" className={`${inp} num`} /></Campo>
            <Campo label="Preço de venda"><input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" className={`${inp} num text-lg font-extrabold text-[var(--purple-dark)]`} /></Campo>
            <Campo label="Frete pago por você"><input value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" className={`${inp} num`} /></Campo>
            <Campo label="Ads por venda (CPA)"><input value={cpa} onChange={(e) => setCpa(e.target.value)} inputMode="decimal" className={`${inp} num`} /></Campo>
            <Campo label="Orçamento de campanha"><input value={orcAds} onChange={(e) => setOrcAds(e.target.value)} inputMode="decimal" className={`${inp} num`} /></Campo>
          </div>

          {/* o que o canal cobra neste preco */}
          <div className="mt-4 rounded-xl bg-[var(--cream)] p-3 text-xs text-[var(--ink)]/75">
            <div className="mb-1 text-[10px] font-bold uppercase text-[var(--ink)]/70">{canal?.nome ?? "canal"} cobra neste preço</div>
            <div className="num flex flex-wrap gap-x-4 gap-y-1">
              <span>comissão <b>{pct(t.pct - extraPrograma)}</b> = {brl(precoN * (t.pct - extraPrograma))}</span>
              {extraPrograma > 0 && <span>{canal?.programa_nome} <b>+{pct(extraPrograma)}</b> = {brl(precoN * extraPrograma)}</span>}
              {t.fixo > 0 && <span>fixa <b>{brl(t.fixo)}</b> {porItem ? `× ${qtd} item` : "por pedido"} = {brl(fixaN)}</span>}
              <span>embalagem <b>{brl(insumoN)}</b></span>
            </div>
          </div>
        </div>

        {/* resultados */}
        <div className="grid grid-cols-2 gap-3 self-start">
          <Res titulo="Custo do pedido" valor={brl(custoPedido)} sub="produto + embalagem + frete + fixa" />
          <Res titulo="Líquido após taxas" valor={brl(liquido)} sub="o que a plataforma repassa" />
          <Res titulo="Lucro por venda" valor={brl(lucroComAds)} destaque={lucroComAds >= 0} big />
          <Res titulo="Margem" valor={pct(margem)} destaque={margem >= 0} big />
          <Res titulo="Lucro por unidade" valor={brl(lucroComAds / qtd)} destaque={lucroComAds >= 0} />
          <Res titulo="Máx. ads por venda" valor={brl(maxCpa)} destaque={maxCpa >= 0} sub="antes de zerar o lucro" />
          <div className="col-span-2 rounded-2xl bg-[var(--purple)]/8 p-4">
            <div className="text-xs font-bold uppercase text-[var(--ink)]/70">Break-even da campanha</div>
            <div className="mt-1 text-sm text-[var(--ink)]/80">
              Com {brl(orcN)} de anúncio e {brl(lucroSemAds)} de lucro por venda (sem ads), precisa de{" "}
              <strong className="num text-[var(--purple-dark)]">{vendasBreakeven === Infinity ? "∞ (lucro não paga)" : `${vendasBreakeven} vendas`}</strong>{" "}
              só pra empatar o anúncio.
            </div>
          </div>
        </div>
      </div>

      {/* escada */}
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Preço</th><th className="p-3 text-right">Lucro/venda</th><th className="p-3 text-right">Margem</th>
            </tr>
          </thead>
          <tbody className="cascata">
            {escada.map((e, i) => (
              <tr key={i} className={`border-b border-[var(--purple)]/6 last:border-0 ${i === 2 ? "bg-[var(--purple)]/6 font-bold" : ""}`}>
                <td className="num p-3">{brl(e.p)}{i === 2 && <span className="ml-1 text-[11px] font-normal text-[var(--ink)]/70">(atual)</span>}</td>
                <td className={`num p-3 text-right ${e.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(e.lucro)}</td>
                <td className="num p-3 text-right">{pct(e.margem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* tabela do estoque */}
      <div className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Tabela de preços do estoque</h2>
            <p className="text-sm text-[var(--ink)]/65">
              Preço por unidade de cada produto pra fechar a margem alvo no canal <b>{canal?.nome ?? ""}</b>. &quot;Usar&quot; grava no produto e nas variações; é o preço que o caixa puxa.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Campo label="Margem alvo %"><input value={margemAlvo} onChange={(e) => setMargemAlvo(e.target.value)} inputMode="decimal" className={`${inp} num w-20`} /></Campo>
            <label className="flex items-center gap-1.5 pb-2 text-xs font-semibold">
              <input type="checkbox" checked={arredondar} onChange={(e) => setArredondar(e.target.checked)} className="accent-[var(--purple)]" /> terminar em ,90
            </label>
          </div>
        </div>

        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                <th className="p-3">Produto</th>
                <th className="p-3 text-right">Estoque</th>
                <th className="p-3 text-right">Custo</th>
                <th className="p-3 text-right">Taxa</th>
                <th className="p-3 text-right">Preço hoje</th>
                <th className="p-3 text-right">Sugerido</th>
                <th className="p-3 text-right">Lucro/un</th>
                <th className="p-3 text-right">Lucro potencial</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="cascata">
              {linhas.map((l) => {
                const igual = l.precoAtual != null && Math.abs(l.precoAtual - l.preco) < 0.005;
                return (
                  <tr key={l.s.id} className="border-b border-[var(--purple)]/6 last:border-0">
                    <td className="p-3">
                      <div className="font-semibold">{nome(l.s)}</div>
                      {l.filhos.length > 0 && <div className="text-[11px] text-[var(--ink)]/70">{l.filhos.length} variações, mesmo custo</div>}
                    </td>
                    <td className="num p-3 text-right">{l.estoque}</td>
                    <td className="num p-3 text-right">{brl(l.custo)}</td>
                    <td className="num p-3 text-right text-[var(--ink)]/60">{pct(l.taxaPct)}{l.fixa > 0 ? ` + ${brl(l.fixa)}` : ""}</td>
                    <td className="num p-3 text-right text-[var(--ink)]/70">{l.precoAtual != null ? brl(l.precoAtual) : <span className="text-[var(--ink)]/55">-</span>}</td>
                    <td className="num p-3 text-right font-extrabold text-[var(--purple-dark)]">{l.impossivel ? <span className="text-xs font-bold text-red-500">margem impossível</span> : brl(l.preco)}</td>
                    <td className={`num p-3 text-right font-bold ${l.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(l.lucro)} <span className="text-[11px] font-normal text-[var(--ink)]/70">{pct(l.margem)}</span></td>
                    <td className="num p-3 text-right text-emerald-600">{brl(l.potencial)}</td>
                    <td className="p-2 text-right">
                      {l.impossivel ? null : salvos.has(l.s.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><Check size={14} weight="bold" /> salvo</span>
                      ) : igual ? (
                        <span className="text-[11px] text-[var(--ink)]/60">já é</span>
                      ) : (
                        <button onClick={() => gravarPreco(l)} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">usar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {linhas.length > 0 && (
                <tr className="bg-[var(--purple)]/4 font-bold">
                  <td className="p-3">Total</td>
                  <td className="num p-3 text-right">{totalUnidades}</td>
                  <td className="num p-3 text-right">{brl(totalCusto)}</td>
                  <td className="p-3" />
                  <td className="p-3" />
                  <td className="num p-3 text-right text-[var(--purple-dark)]">{brl(totalReceita)}</td>
                  <td className="p-3" />
                  <td className="num p-3 text-right text-emerald-600">{brl(totalLucro)}</td>
                  <td className="p-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--ink)]/70">
          preço = (custo + embalagem + fixa + ads) ÷ (1 − comissão − margem). Em canal por faixa, a comissão é a da faixa do preço encontrado. Kit: use o simulador com as unidades do kit.
        </p>
      </div>

      {/* comparativo */}
      <div className="mt-8">
        <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">O mesmo produto em cada canal</h2>
        <p className="text-sm text-[var(--ink)]/65">
          Custo do simulador ({brl(custoConjN)} × {qtd}) e margem alvo de {margemAlvo}%. Quanto cobrar em cada lugar pra ganhar a mesma coisa.
        </p>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                <th className="p-3">Canal</th><th className="p-3 text-right">Comissão</th><th className="p-3 text-right">Fixa</th><th className="p-3 text-right">Preço pra margem alvo</th><th className="p-3 text-right">Lucro</th><th className="p-3 text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="cascata">
              {comparativo.map((r) => (
                <tr key={r.canal.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${r.canal.id === canalId ? "bg-[var(--purple)]/6" : ""}`}>
                  <td className="p-3 font-semibold">
                    {r.canal.nome}
                    {r.canal.programa_ativo && r.canal.programa_pct > 0 && <span className="ml-1 text-[10px] text-[var(--ink)]/70">+ {r.canal.programa_nome}</span>}
                  </td>
                  <td className="num p-3 text-right">{pct(r.taxaPct)}</td>
                  <td className="num p-3 text-right">{r.fixa > 0 ? brl(r.fixa) : "-"}</td>
                  <td className="num p-3 text-right font-extrabold text-[var(--purple-dark)]">{r.impossivel ? <span className="text-xs font-bold text-red-500">impossível</span> : brl(r.preco)}</td>
                  <td className={`num p-3 text-right font-bold ${r.lucro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(r.lucro)}</td>
                  <td className="num p-3 text-right">{pct(r.margem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--ink)]/70">
          Onde a comissão é menor (WhatsApp, loja física) dá pra vender mais barato ganhando o mesmo, ou manter o preço e ficar com a margem inteira.
        </p>
      </div>
    </div>
  );
}

const inp = "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}

function Res({ titulo, valor, sub, destaque, big }: { titulo: string; valor: string; sub?: string; destaque?: boolean; big?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{titulo}</div>
      <div className={`num mt-1 font-[family-name:var(--font-baloo)] font-extrabold ${big ? "text-2xl" : "text-lg"} ${destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"}`}>{valor}</div>
      {sub && <div className="text-[10px] text-[var(--ink)]/70">{sub}</div>}
    </div>
  );
}
