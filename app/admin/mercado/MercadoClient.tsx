"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { calcularTaxas, type CanalTaxas } from "@/lib/canais";
import { brl, dataBr } from "@/lib/formato";
import { SetupCard } from "../SetupCard";
import { PageHeader, SkeletonRows, Sparkline, Vazio } from "../ui";

/*
  Radar de mercado: a busca da Shopee lida com o AvantPro ligado, guardada a
  cada leitura (tabela ibk_mercado, migration 0032). Por busca e formato:
  quantos anuncios, quanto o mercado vendeu no mes e o preco mediano dos 10
  que mais vendem, com o nosso preco ao lado e o lucro nos dois precos, pela
  taxa da Shopee cadastrada em Canais. A leitura nao mexe em preco nenhum.

  Oportunidades saem da leitura mais recente de cada busca, por regra fixa
  (nada de palpite): onde puxar, que formato falta, quanto o custo precisa
  cair para vender no preco do mercado e onde o preco esta abaixo. Busca sem
  nenhum preco nosso e prospeccao: produto que a loja ainda nao vende, com o
  plano de cada uma (tabela ibk_oportunidades, migration 0033): prioridade do
  estudo de 25/09 e o status que a loja vai mudando (cotando, comprado).
*/

type Leitura = {
  id: string;
  data: string;
  termo: string;
  formato: number;
  anuncios: number;
  vendas30: number;
  mediana_top10: number | null;
  menor: number | null;
  nosso_preco: number | null;
  custo_unit: number | null;
  lider_preco: number | null;
  lider_vendas: number | null;
  lider_titulo: string | null;
  novos_pct: number | null; // fatia das vendas em anuncio com menos de 6 meses
  lider_pct: number | null; // fatia da maior loja
};
type Plano = {
  termo: string;
  grupo: "essencial" | "opcional";
  prioridade: Prioridade;
  janela: string | null;
  acao: string | null;
  meta_custo: number | null;
  status: StatusPlano;
};
type Prioridade = "A" | "B" | "C" | "D" | "E";
type StatusPlano = "ideia" | "cotando" | "comprado" | "descartado";
const PRIORIDADE: Record<Prioridade, { rotulo: string; cor: string }> = {
  A: { rotulo: "Fazer agora", cor: "bg-emerald-100 text-emerald-700" },
  B: { rotulo: "Temporada que começa", cor: "bg-sky-100 text-sky-800" },
  C: { rotulo: "Acréscimo de ticket", cor: "bg-[var(--purple)]/10 text-[var(--purple-dark)]" },
  D: { rotulo: "Planejar a compra", cor: "bg-amber-100 text-amber-800" },
  E: { rotulo: "Evitar por enquanto", cor: "bg-[var(--ink)]/8 text-[var(--ink)]/70" },
};
const STATUS_PLANO: Record<StatusPlano, string> = { ideia: "ideia", cotando: "cotando", comprado: "comprado", descartado: "descartado" };

/* calendario do nicho infantil (estudo de 25/09): o que precisa estar anunciado em cada mes */
const CALENDARIO: { meses: number[]; quando: string; janela: string; anunciar: string }[] = [
  { meses: [10], quando: "outubro", janela: "Dia das Crianças (12/10), começo do verão", anunciar: "conjunto verão, praia, pijama; Natal já no ar" },
  { meses: [11], quando: "novembro", janela: "11.11 e Black Friday", anunciar: "kits com desconto, combos" },
  { meses: [12], quando: "dezembro", janela: "Natal e Réveillon", anunciar: "look de Natal, vestido branco" },
  { meses: [1, 2], quando: "janeiro e fevereiro", janela: "volta às aulas, Carnaval", anunciar: "legging, camiseta básica, meia, mochila, fantasia" },
  { meses: [3], quando: "março", janela: "compra de inverno", anunciar: "pedido de moletom" },
  { meses: [4, 5, 6, 7], quando: "abril a julho", janela: "inverno", anunciar: "moletom, pijama manga longa" },
];
type Canal = CanalTaxas & { nome: string; insumo_custo: number | null };

const nomeFormato = (f: number) => (f === 0 ? "busca inteira" : f === 1 ? "avulso" : `kit ${f}`);
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const MARGEM_ALVO = 0.25; // margem do estudo de 25/09: abaixo disso nao chama de oportunidade

type TipoOport = "foco" | "formato" | "custo" | "abaixo";
const TIPO: Record<TipoOport, { rotulo: string; cor: string; ordem: number }> = {
  foco: { rotulo: "Puxar", cor: "bg-emerald-100 text-emerald-700", ordem: 1 },
  formato: { rotulo: "Formato novo", cor: "bg-[var(--purple)]/10 text-[var(--purple-dark)]", ordem: 2 },
  custo: { rotulo: "Comprar melhor", cor: "bg-amber-100 text-amber-800", ordem: 3 },
  abaixo: { rotulo: "Preço abaixo", cor: "bg-sky-100 text-sky-800", ordem: 4 },
};
type Oportunidade = { tipo: TipoOport; chave: string; titulo: string; texto: string; vendas30: number };
// tamanho do mercado no mes: milhao em "mi", milhar em "mil", o resto em reais
const tamanhoMercado = (v: number) =>
  v >= 1e6
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
    : v >= 1000
      ? `R$ ${Math.round(v / 1000).toLocaleString("pt-BR")} mil`
      : brl(v);
const pctTxt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v * 100))}%`;

export function MercadoClient() {
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [canal, setCanal] = useState<Canal | null>(null);
  const [loading, setLoading] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [semPlano, setSemPlano] = useState(false);
  const [filtroPrio, setFiltroPrio] = useState<"todas" | Prioridade>("todas");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const [l, { data: c }, pl] = await Promise.all([
        buscarTodos<Leitura>((de, ate) => supabase!.from("ibk_mercado").select("*").order("data", { ascending: false }).order("id").range(de, ate)),
        supabase!.from("ibk_canais").select("nome, taxa_pct, taxa_fixa, faixas, taxa_fixa_por_item, programa_pct, programa_ativo, insumo_custo").ilike("nome", "%shopee%").limit(1),
        supabase!.from("ibk_oportunidades").select("*"),
      ]);
      // sem a 0033 a tabela do plano nao existe: a tela avisa em vez de quebrar
      if (pl.error) setSemPlano(true);
      else setPlanos((pl.data as Plano[]) ?? []);
      if (l.error) setSemTabela(true);
      setLeituras(l.data);
      setCanal(((c as Canal[]) ?? [])[0] ?? null);
      setLoading(false);
    })();
  }, []);

  if (!supabaseConfigured) return <SetupCard />;

  // lucro de um anuncio da Shopee a esse preco, com o custo das unidades que vao nele
  const lucro = (preco: number | null, custoUnit: number | null, formato: number) => {
    if (preco == null || custoUnit == null || !canal) return null;
    const t = calcularTaxas(canal, [{ precoUnit: preco, qtd: 1 }]);
    return preco - t.total - (canal.insumo_custo ?? 0.52) - custoUnit * Math.max(1, formato);
  };

  /* custo maximo por unidade para ter a margem alvo vendendo pelo preco do mercado (formato 0 = o anuncio inteiro) */
  const custoMaximo = (preco: number | null, formato: number) => {
    if (preco == null || !canal) return null;
    const t = calcularTaxas(canal, [{ precoUnit: preco, qtd: 1 }]);
    return (preco - t.total - (canal.insumo_custo ?? 0.52) - MARGEM_ALVO * preco) / Math.max(1, formato);
  };

  const mudarStatus = async (termo: string, status: StatusPlano) => {
    if (!supabase) return;
    setPlanos((ps) => ps.map((p) => (p.termo === termo ? { ...p, status } : p)));
    await supabase.from("ibk_oportunidades").update({ status, updated_at: new Date().toISOString() }).eq("termo", termo);
  };

  // leitura mais recente de cada busca
  const recentes = (() => {
    const out: Leitura[] = [];
    for (const t of new Set(leituras.map((l) => l.termo))) {
      const doTermo = leituras.filter((l) => l.termo === t);
      const d = doTermo.reduce((m, l) => (l.data > m ? l.data : m), "");
      out.push(...doTermo.filter((l) => l.data === d));
    }
    return out;
  })();
  // prospeccao: busca em que a loja nao tem preco em formato nenhum
  const ehProspeccao = (termo: string) => recentes.filter((l) => l.termo === termo).every((l) => l.nosso_preco == null);

  const oportunidades: Oportunidade[] = [];
  for (const l of recentes) {
    if (ehProspeccao(l.termo)) continue;
    const nome = `${capital(l.termo)} · ${nomeFormato(l.formato)}`;
    const vendas = `${l.vendas30.toLocaleString("pt-BR")} vendas/mês`;
    const lMerc = lucro(l.mediana_top10, l.custo_unit, l.formato);
    const dif = l.nosso_preco != null && l.mediana_top10 ? (l.nosso_preco - l.mediana_top10) / l.mediana_top10 : null;
    const cMax = custoMaximo(l.mediana_top10, l.formato);
    if (l.nosso_preco != null && dif != null && Math.abs(dif) <= 0.1 && lMerc != null && lMerc > 0 && l.vendas30 >= 1000) {
      oportunidades.push({ tipo: "foco", chave: l.id, titulo: nome, vendas30: l.vendas30, texto: `${vendas}, seu preço está ${pctTxt(dif)} da mediana e no preço do mercado ainda sobram ${brl(lMerc)}. É o formato para puxar na live e no anúncio.` });
    } else if (l.nosso_preco == null && lMerc != null && lMerc > 0 && l.vendas30 >= 100) {
      oportunidades.push({ tipo: "formato", chave: l.id, titulo: nome, vendas30: l.vendas30, texto: `${vendas} e você não vende esse formato. No preço do mercado (${brl(l.mediana_top10 ?? 0)}) daria ${brl(lMerc)} de lucro com o custo de hoje.` });
    } else if (lMerc != null && lMerc <= 0 && l.vendas30 >= 1000 && cMax != null && cMax > 0) {
      oportunidades.push({ tipo: "custo", chave: l.id, titulo: nome, vendas30: l.vendas30, texto: `${vendas}, mas no preço do mercado (${brl(l.mediana_top10 ?? 0)}) o custo de hoje (${brl(l.custo_unit ?? 0)} por unidade) dá prejuízo. Com até ${brl(cMax)} por unidade você vende nesse preço com ${Math.round(MARGEM_ALVO * 100)}% de margem.` });
    }
    if (l.nosso_preco != null && dif != null && dif < -0.1) {
      oportunidades.push({ tipo: "abaixo", chave: l.id + "-abaixo", titulo: nome, vendas30: l.vendas30, texto: `Seu preço está ${pctTxt(dif)} da mediana (${brl(l.mediana_top10 ?? 0)}). Mercado de ${vendas}${lMerc != null ? `; no preço do mercado o lucro seria ${brl(lMerc)}` : ""}.` });
    }
  }
  oportunidades.sort((a, b) => TIPO[a.tipo].ordem - TIPO[b.tipo].ordem || b.vendas30 - a.vendas30);
  // prospeccao: uma linha por busca (a leitura mais recente), com o plano ao lado
  const planoDe = new Map(planos.map((p) => [p.termo, p]));
  const faturamentoMes = (l: Leitura) => l.vendas30 * (l.mediana_top10 ?? 0);
  const ordemPrio = (t: string) => "ABCDE".indexOf(planoDe.get(t)?.prioridade ?? "Z") + 1 || 9;
  const prospeccaoTodas = [...new Map(recentes.filter((l) => ehProspeccao(l.termo)).map((l) => [l.termo, l])).values()]
    .sort((a, b) => ordemPrio(a.termo) - ordemPrio(b.termo) || faturamentoMes(b) - faturamentoMes(a));
  const prospeccao = prospeccaoTodas.filter((l) => filtroPrio === "todas" || planoDe.get(l.termo)?.prioridade === filtroPrio);
  const mesAtual = new Date().getMonth() + 1;

  // por busca: datas da mais nova para a mais antiga (so as que a loja vende; prospeccao tem tabela propria)
  const termos = [...new Set(leituras.map((l) => l.termo))].filter((t) => !ehProspeccao(t)).sort((a, b) => {
    const va = leituras.filter((l) => l.termo === a && l.data === leituras.find((x) => x.termo === a)?.data).reduce((s, l) => s + l.vendas30, 0);
    const vb = leituras.filter((l) => l.termo === b && l.data === leituras.find((x) => x.termo === b)?.data).reduce((s, l) => s + l.vendas30, 0);
    return vb - va;
  });
  const visiveis = filtro === "todos" ? termos : termos.filter((t) => t === filtro);
  const ultima = leituras[0]?.data ?? null;

  return (
    <div className="page-in">
      <PageHeader
        titulo="Mercado"
        sub="Busca da Shopee com o AvantPro: o preço dos 10 que mais vendem, quanto o mercado vende e o seu preço ao lado."
        acoes={ultima ? <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--ink)]/75 shadow-[0_3px_0_rgba(109,40,184,0.1)]">última leitura {dataBr(ultima)}</span> : undefined}
      />

      {semTabela && (
        <div className="card mt-5 border-2 border-[var(--sun)] p-4 text-sm text-[var(--ink)]">
          Para guardar as leituras, rode a migration <b>0032</b> no SQL Editor do Supabase.
        </div>
      )}

      {!loading && termos.length > 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <span className="w-20 text-[10px] font-bold uppercase text-[var(--ink)]/70">Busca</span>
          {["todos", ...termos].map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              aria-pressed={filtro === t}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${filtro === t ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="card mt-5 overflow-hidden">
          <table className="w-full"><tbody><SkeletonRows cols={6} linhas={5} /></tbody></table>
        </div>
      )}

      {!loading && !semTabela && termos.length === 0 && (
        <div className="mt-6">
          <Vazio emoji="🔭" titulo="Nenhuma leitura ainda" texto="A primeira leitura entra aqui quando a pesquisa da Shopee rodar." />
        </div>
      )}

      {/* oportunidades: leitura automatica da ultima pesquisa */}
      {!loading && oportunidades.length > 0 && (
        <section className="mt-5">
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Oportunidades</h2>
          <p className="text-xs text-[var(--ink)]/70">o que a última leitura mostra, do maior mercado para o menor dentro de cada tipo</p>
          <div className="cascata mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {oportunidades.map((o) => (
              <div key={o.chave} className="card p-4">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${TIPO[o.tipo].cor}`}>{TIPO[o.tipo].rotulo}</span>
                <div className="mt-1.5 font-bold leading-snug text-[var(--ink)]">{o.titulo}</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ink)]/80">{o.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* prospeccao: produtos que a loja ainda nao vende, com o plano de cada um */}
      {!loading && prospeccaoTodas.length > 0 && (
        <section className="mt-6">
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Produtos novos para vender</h2>
          <p className="text-xs text-[var(--ink)]/70">
            demanda e preço de mercado de produtos que a loja ainda não vende. Custo máximo é quanto pagar no anúncio inteiro para vender no preço de referência com {Math.round(MARGEM_ALVO * 100)}% de margem.
          </p>
          {semPlano && <p className="mt-2 text-sm text-[var(--ink)]/75">Para ver a prioridade e marcar o status de cada uma, rode a migration 0033 no SQL Editor.</p>}
          {!semPlano && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="w-20 text-[10px] font-bold uppercase text-[var(--ink)]/70">Prioridade</span>
              {(["todas", "A", "B", "C", "D", "E"] as const).map((k) => {
                const n = k === "todas" ? prospeccaoTodas.length : prospeccaoTodas.filter((l) => planoDe.get(l.termo)?.prioridade === k).length;
                if (k !== "todas" && n === 0) return null;
                return (
                  <button
                    key={k}
                    onClick={() => setFiltroPrio(k)}
                    aria-pressed={filtroPrio === k}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${filtroPrio === k ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/65 hover:bg-[var(--purple)]/8"}`}
                  >
                    {k === "todas" ? "todas" : `${k} · ${PRIORIDADE[k].rotulo}`} <span className="num opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                  <th className="p-3">Produto e o que fazer</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3 text-right">Vendas/mês</th>
                  <th className="p-3 text-right">Preço ref.</th>
                  <th className="p-3 text-right">Mercado/mês</th>
                  <th className="p-3 text-right">Novos</th>
                  <th className="p-3 text-right">Líder</th>
                  <th className="p-3 text-right">Custo máx.</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {prospeccao.map((l) => {
                  const pl = planoDe.get(l.termo);
                  const cMax = custoMaximo(l.mediana_top10, l.formato);
                  return (
                    <tr key={l.termo} className={`border-b border-[var(--purple)]/6 align-top last:border-0 ${pl?.status === "descartado" ? "opacity-55" : ""}`}>
                      <td className="max-w-[340px] p-3">
                        <div className="font-semibold text-[var(--ink)]">{capital(l.termo)}</div>
                        {pl?.acao && <div className="mt-0.5 text-[11px] leading-snug text-[var(--ink)]/75">{pl.acao}</div>}
                        <div className="mt-0.5 text-[11px] text-[var(--ink)]/60">
                          {[pl?.grupo, pl?.janela, `leitura de ${dataBr(l.data)}`].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="p-3">
                        {pl ? (
                          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${PRIORIDADE[pl.prioridade].cor}`}>
                            {pl.prioridade} · {PRIORIDADE[pl.prioridade].rotulo}
                          </span>
                        ) : (
                          <span className="text-[var(--ink)]/50">-</span>
                        )}
                      </td>
                      <td className="num p-3 text-right font-bold">{l.vendas30.toLocaleString("pt-BR")}</td>
                      <td className="num p-3 text-right">{l.mediana_top10 != null ? brl(l.mediana_top10) : "-"}</td>
                      <td className="num p-3 text-right">{tamanhoMercado(faturamentoMes(l))}</td>
                      <td className="num p-3 text-right">
                        {l.novos_pct != null ? `${Math.round(l.novos_pct * 100)}%` : "-"}
                        {l.novos_pct != null && l.novos_pct >= 0.3 && <div className="text-[10px] font-bold uppercase text-emerald-700">aberto</div>}
                      </td>
                      <td className="num p-3 text-right">
                        {l.lider_pct != null ? `${Math.round(l.lider_pct * 100)}%` : "-"}
                        {l.lider_pct != null && l.lider_pct >= 0.3 && <div className="text-[10px] font-bold uppercase text-amber-700">dominado</div>}
                      </td>
                      <td className={`num p-3 text-right font-extrabold ${cMax != null && cMax <= 0 ? "text-red-600" : "text-[var(--purple-dark)]"}`}>
                        {cMax == null ? "-" : cMax <= 0 ? "não fecha" : brl(cMax)}
                        {pl?.meta_custo != null && <div className="text-[10px] font-semibold text-[var(--ink)]/60">meta {brl(pl.meta_custo)}</div>}
                      </td>
                      <td className="p-3">
                        {pl ? (
                          <select
                            value={pl.status}
                            onChange={(e) => mudarStatus(pl.termo, e.target.value as StatusPlano)}
                            className="rounded-lg border border-[var(--purple)]/20 bg-white px-2 py-1 text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                            aria-label={`status de ${l.termo}`}
                          >
                            {(Object.keys(STATUS_PLANO) as StatusPlano[]).map((st) => (
                              <option key={st} value={st}>{STATUS_PLANO[st]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[var(--ink)]/50">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Calendário do nicho</h3>
          <div className="card mt-2 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                  <th className="p-3">Mês</th>
                  <th className="p-3">Janela</th>
                  <th className="p-3">O que precisa estar anunciado</th>
                </tr>
              </thead>
              <tbody>
                {CALENDARIO.map((c) => {
                  const agora = c.meses.includes(mesAtual);
                  return (
                    <tr key={c.quando} className={`border-b border-[var(--purple)]/6 last:border-0 ${agora ? "bg-[var(--purple)]/[0.06]" : ""}`}>
                      <td className="whitespace-nowrap p-3 font-semibold text-[var(--ink)]">
                        {c.quando}
                        {agora && <span className="ml-2 rounded-full bg-[var(--purple)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">agora</span>}
                      </td>
                      <td className="p-3 text-[var(--ink)]/80">{c.janela}</td>
                      <td className="p-3 text-[var(--ink)]">{c.anunciar}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && termos.length > 0 && (
        <h2 className="mt-6 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Seus produtos no mercado</h2>
      )}
      <div className="cascata mt-3 flex flex-col gap-4">
        {visiveis.map((termo) => {
          const doTermo = leituras.filter((l) => l.termo === termo);
          const datas = [...new Set(doTermo.map((l) => l.data))].sort().reverse();
          const atual = doTermo.filter((l) => l.data === datas[0]).sort((a, b) => a.formato - b.formato);
          const anterior = datas[1] ? doTermo.filter((l) => l.data === datas[1]) : [];
          const vendasAtual = atual.reduce((s, l) => s + l.vendas30, 0);
          const vendasAntes = anterior.reduce((s, l) => s + l.vendas30, 0);
          return (
            <div key={termo} className="card overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-4">
                <div>
                  <h3 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{capital(termo)}</h3>
                  <p className="text-xs text-[var(--ink)]/70">
                    leitura de {dataBr(datas[0])} · {atual.reduce((s, l) => s + l.anuncios, 0)} anúncios · {vendasAtual.toLocaleString("pt-BR")} vendas no mês
                    {anterior.length > 0 && vendasAntes > 0 && ` (${pctTxt((vendasAtual - vendasAntes) / vendasAntes)} desde ${dataBr(datas[1])})`}
                    {datas.length === 1 && " · primeira leitura"}
                  </p>
                </div>
                {datas.length > 1 && (
                  <div className="w-32" title="vendas do mês nas leituras">
                    <Sparkline valores={[...datas].reverse().map((d) => doTermo.filter((l) => l.data === d).reduce((s, l) => s + l.vendas30, 0))} />
                  </div>
                )}
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                      <th className="p-3">Formato</th>
                      <th className="p-3 text-right">Anúncios</th>
                      <th className="p-3 text-right">Vendas/mês</th>
                      <th className="p-3 text-right">Mercado</th>
                      <th className="p-3 text-right">Menor</th>
                      <th className="p-3 text-right">Nosso</th>
                      <th className="p-3 text-right">Diferença</th>
                      <th className="p-3 text-right">Lucro no nosso</th>
                      <th className="p-3 text-right">Lucro no mercado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atual.map((l) => {
                      const antes = anterior.find((x) => x.formato === l.formato);
                      const dif = l.nosso_preco != null && l.mediana_top10 ? (l.nosso_preco - l.mediana_top10) / l.mediana_top10 : null;
                      const lNosso = lucro(l.nosso_preco, l.custo_unit, l.formato);
                      const lMerc = lucro(l.mediana_top10, l.custo_unit, l.formato);
                      return (
                        <tr key={l.id} className="border-b border-[var(--purple)]/6 last:border-0">
                          <td className="p-3 font-semibold text-[var(--ink)]">
                            {nomeFormato(l.formato)}
                            {l.lider_titulo && <div className="max-w-[260px] truncate text-[11px] font-normal text-[var(--ink)]/65" title={l.lider_titulo}>líder: {l.lider_titulo}</div>}
                          </td>
                          <td className="num p-3 text-right">{l.anuncios}</td>
                          <td className="num p-3 text-right">
                            {l.vendas30.toLocaleString("pt-BR")}
                            {antes && antes.vendas30 > 0 && <div className="text-[11px] text-[var(--ink)]/65">{pctTxt((l.vendas30 - antes.vendas30) / antes.vendas30)}</div>}
                          </td>
                          <td className="num p-3 text-right font-bold text-[var(--ink)]">
                            {l.mediana_top10 != null ? brl(l.mediana_top10) : "-"}
                            {antes?.mediana_top10 && l.mediana_top10 != null && <div className="text-[11px] font-normal text-[var(--ink)]/65">{pctTxt((l.mediana_top10 - antes.mediana_top10) / antes.mediana_top10)}</div>}
                          </td>
                          <td className="num p-3 text-right text-[var(--ink)]/75">{l.menor != null ? brl(l.menor) : "-"}</td>
                          <td className="num p-3 text-right">{l.nosso_preco != null ? brl(l.nosso_preco) : <span className="text-[var(--ink)]/50">não vende</span>}</td>
                          <td className={`num p-3 text-right font-bold ${dif == null ? "" : dif > 0.15 ? "text-amber-700" : dif < -0.1 ? "text-emerald-700" : "text-[var(--ink)]"}`}>
                            {dif == null ? "-" : `${pctTxt(dif)} ${dif > 0.005 ? "acima" : dif < -0.005 ? "abaixo" : ""}`}
                          </td>
                          <td className={`num p-3 text-right ${lNosso != null && lNosso < 0 ? "text-red-600" : "text-[var(--ink)]"}`}>{lNosso != null ? brl(lNosso) : "-"}</td>
                          <td className={`num p-3 text-right font-bold ${lMerc != null && lMerc < 0 ? "text-red-600" : "text-[var(--ink)]"}`}>{lMerc != null ? brl(lMerc) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && termos.length > 0 && (
        <div className="mt-4 grid gap-3 text-xs text-[var(--ink)]/75 sm:grid-cols-3">
          <div className="card p-3">
            <b className="text-[var(--purple-dark)]">Como é a leitura:</b> busca na Shopee ordenada por vendas, os 60 primeiros anúncios, com as vendas do mês que aparecem no card.
          </div>
          <div className="card p-3">
            <b className="text-[var(--purple-dark)]">Mercado</b> é a mediana do preço dos 10 que mais vendem em cada formato. O formato sai do título: kit 6 peças de roupa conta como kit 3 conjuntos.
          </div>
          <div className="card p-3">
            <b className="text-[var(--purple-dark)]">Lucro</b> usa a taxa da Shopee de Canais{canal ? ` (${Math.round(canal.taxa_pct * 100)}% + ${brl(canal.taxa_fixa)} por item)` : ""}, a embalagem e o custo das peças do dia da leitura.
          </div>
        </div>
      )}
    </div>
  );
}
