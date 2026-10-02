"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonRows, Vazio } from "../ui";
import { brl, pct, hojeIso } from "@/lib/formato";
import { estornada, type StatusPedido } from "@/lib/pedidos";
import { MOTIVOS_SAIDA } from "@/lib/estoque";

/*
  DRE mensal: o resultado de verdade, mes a mes. Diferente do caixa, aqui
  compra de mercadoria NAO e despesa: ela vira estoque e so vira custo quando
  a peca e vendida (CMV). Por isso um mes de compra grande fica negativo no
  caixa e positivo no DRE, e e o DRE que diz se o negocio da lucro.

  Receita e custos da venda saem das vendas (pela data da venda). Despesas
  (ads, imposto, servico, pro-labore, outro) saem do caixa (pela data do
  lancamento). Cancelada nao entra; devolvida entra com o custo da devolucao.
  Peca que saiu sem venda (presente, conteudo, perda) entra pelo custo, pela
  data da saida no kardex: o dinheiro ja saiu na compra, mas o lucro diminui.
*/

type Venda = {
  data: string;
  status: StatusPedido;
  devolvida: boolean;
  custo_devolucao: number;
  preco_venda: number;
  taxa_pct: number;
  taxa_fixa: number;
  insumo_custo: number;
  frete: number;
  ibk_venda_itens: { qtd: number; produto: { custo_unit: number } | null }[];
};
type Mov = { data: string; tipo: "entrada" | "saida"; categoria: string; valor: number };
type SaidaSemVenda = { data: string; origem: string; qtd: number; custo_unit: number };

type Linha = { chave: string; rotulo: string; sinal: -1 | 1 | 0; forte?: boolean; sutil?: boolean };

const LINHAS: Linha[] = [
  { chave: "receita", rotulo: "Receita bruta (vendas)", sinal: 1, forte: true },
  { chave: "taxas", rotulo: "Taxas de marketplace", sinal: -1 },
  { chave: "cmv", rotulo: "Custo das peças vendidas (CMV)", sinal: -1 },
  { chave: "embalagem", rotulo: "Embalagem", sinal: -1 },
  { chave: "frete", rotulo: "Frete pago pela loja", sinal: -1 },
  { chave: "devolucoes", rotulo: "Custo de devoluções", sinal: -1 },
  { chave: "lucroBruto", rotulo: "Lucro bruto", sinal: 0, forte: true },
  { chave: "ads", rotulo: "Anúncios (ads)", sinal: -1 },
  { chave: "presentes", rotulo: "Presentes e conteúdo (custo das peças)", sinal: -1 },
  { chave: "perdas", rotulo: "Perdas de estoque", sinal: -1 },
  { chave: "imposto", rotulo: "Imposto (DAS)", sinal: -1 },
  { chave: "servico", rotulo: "Serviços e ferramentas", sinal: -1 },
  { chave: "pro_labore", rotulo: "Pró-labore", sinal: -1 },
  { chave: "outro", rotulo: "Outras despesas", sinal: -1 },
  { chave: "resultado", rotulo: "Resultado do mês", sinal: 0, forte: true },
];

const mesDe = (iso: string) => iso.slice(0, 7);
const rotuloMes = (ym: string) => {
  const [a, m] = ym.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[parseInt(m, 10) - 1]}/${a.slice(2)}`;
};

export function DreClient() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [semVenda, setSemVenda] = useState<SaidaSemVenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [v, m, k] = await Promise.all([
      buscarTodos<Venda>((de, ate) =>
        supabase!
          .from("ibk_vendas")
          .select("data, status, devolvida, custo_devolucao, preco_venda, taxa_pct, taxa_fixa, insumo_custo, frete, ibk_venda_itens(qtd, produto:ibk_produtos(custo_unit))")
          .order("id")
          .range(de, ate),
      ),
      buscarTodos<Mov>((de, ate) =>
        supabase!.from("ibk_movimentos").select("data, tipo, categoria, valor").eq("tipo", "saida").in("categoria", ["ads", "imposto", "servico", "pro_labore", "outro"]).order("id").range(de, ate),
      ),
      buscarTodos<SaidaSemVenda>((de, ate) =>
        supabase!.from("ibk_estoque_mov").select("data, origem, qtd, custo_unit").in("origem", Object.keys(MOTIVOS_SAIDA)).order("id").range(de, ate),
      ),
    ]);
    if (v.error) setErro(v.error);
    setVendas(v.data);
    setMovs(m.data);
    setSemVenda(k.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  const { meses, valores } = useMemo(() => {
    const todos = new Set<string>([mesDe(hojeIso())]);
    for (const v of vendas) todos.add(mesDe(v.data));
    for (const m of movs) todos.add(mesDe(m.data));
    for (const k of semVenda) todos.add(mesDe(k.data));
    // do mais antigo ao mais novo, no maximo 12
    const meses = [...todos].sort().slice(-12);
    const zero = () => Object.fromEntries(LINHAS.map((l) => [l.chave, 0])) as Record<string, number>;
    const valores: Record<string, Record<string, number>> = Object.fromEntries(meses.map((m) => [m, zero()]));

    for (const v of vendas) {
      const m = mesDe(v.data);
      if (!valores[m]) continue;
      const r = valores[m];
      if (v.status === "cancelado") continue;
      if (v.devolvida || v.status === "devolvido") {
        r.devolucoes += v.custo_devolucao ?? 0;
        continue;
      }
      r.receita += v.preco_venda;
      r.taxas += v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0);
      r.cmv += v.ibk_venda_itens.reduce((s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd, 0);
      r.embalagem += v.insumo_custo;
      r.frete += v.frete;
    }
    for (const mv of movs) {
      const m = mesDe(mv.data);
      if (!valores[m]) continue;
      valores[m][mv.categoria] = (valores[m][mv.categoria] ?? 0) + mv.valor;
    }
    for (const k of semVenda) {
      const m = mesDe(k.data);
      if (!valores[m]) continue;
      const chave = k.origem === "perda" ? "perdas" : "presentes";
      valores[m][chave] += Math.abs(k.qtd) * k.custo_unit;
    }
    for (const m of meses) {
      const r = valores[m];
      r.lucroBruto = r.receita - r.taxas - r.cmv - r.embalagem - r.frete - r.devolucoes;
      r.resultado = r.lucroBruto - r.ads - r.presentes - r.perdas - r.imposto - r.servico - r.pro_labore - r.outro;
    }
    return { meses, valores };
  }, [vendas, movs, semVenda]);

  if (!supabaseConfigured) return <SetupCard />;

  const total = (chave: string) => meses.reduce((s, m) => s + (valores[m][chave] ?? 0), 0);
  const margem = (m: string) => (valores[m].receita > 0 ? valores[m].resultado / valores[m].receita : 0);
  const mesAtual = mesDe(hojeIso());

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">Resultado (DRE)</h1>
          <p className="max-w-2xl text-sm text-[var(--ink)]/70">
            O lucro de verdade, mês a mês. Compra de mercadoria não entra como despesa: vira estoque e só conta quando a peça é vendida (CMV). Por isso um mês de compra grande fica negativo no caixa e não aqui.
          </p>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {!loading && meses.length === 1 && vendas.length === 0 && (
        <div className="mt-6">
          <Vazio emoji="📊" titulo="Ainda não há vendas" texto="O DRE se monta sozinho a partir das vendas registradas e das despesas do caixa." />
        </div>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3 text-left">Linha</th>
              {meses.map((m) => (
                <th key={m} className={`num p-3 text-right ${m === mesAtual ? "text-[var(--purple)]" : ""}`}>{rotuloMes(m)}</th>
              ))}
              <th className="num p-3 text-right text-[var(--purple-dark)]">Total</th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={meses.length + 2} linhas={8} />}
            {!loading &&
              LINHAS.map((l) => {
                const cor = (v: number) => (l.sinal === 0 ? (v >= 0 ? "text-emerald-600" : "text-red-500") : l.sinal === -1 && v > 0 ? "text-red-500" : "text-[var(--ink)]");
                return (
                  <tr key={l.chave} className={`border-b border-[var(--purple)]/6 last:border-0 ${l.forte ? "bg-[var(--purple)]/5 font-bold" : ""}`}>
                    <td className={`p-3 ${l.forte ? "text-[var(--purple-dark)]" : "pl-6 text-[var(--ink)]/80"}`}>{l.rotulo}</td>
                    {meses.map((m) => {
                      const v = valores[m][l.chave] ?? 0;
                      return (
                        <td key={m} className={`num p-3 text-right ${v === 0 ? "text-[var(--ink)]/55" : cor(v)}`}>
                          {v === 0 && !l.forte ? "-" : `${l.sinal === -1 && v > 0 ? "− " : ""}${brl(Math.abs(v))}`}
                        </td>
                      );
                    })}
                    <td className={`num p-3 text-right font-bold ${cor(total(l.chave))}`}>
                      {l.sinal === -1 && total(l.chave) > 0 ? "− " : ""}{brl(Math.abs(total(l.chave)))}
                    </td>
                  </tr>
                );
              })}
            {!loading && (
              <tr className="border-t-2 border-[var(--purple)]/15 text-xs">
                <td className="p-3 text-[var(--ink)]/80">Margem sobre a receita</td>
                {meses.map((m) => (
                  <td key={m} className={`num p-3 text-right font-bold ${margem(m) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {valores[m].receita > 0 ? pct(margem(m)) : "-"}
                  </td>
                ))}
                <td className={`num p-3 text-right font-bold ${total("resultado") >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {total("receita") > 0 ? pct(total("resultado") / total("receita")) : "-"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 text-xs text-[var(--ink)]/75 sm:grid-cols-3">
        <div className="card p-3">
          <b className="text-[var(--purple-dark)]">Receita e custos da venda</b> saem das vendas, pela data da venda: preço, taxa do canal, custo das peças (custo médio), embalagem e frete pago pela loja.
        </div>
        <div className="card p-3">
          <b className="text-[var(--purple-dark)]">Despesas</b> saem do caixa, pela data do lançamento: ads, imposto, serviços, pró-labore e outros. Conta a pagar já entra no mês da competência. Presentes, conteúdo e perdas saem do estoque, pelo custo da peça.
        </div>
        <div className="card p-3">
          <b className="text-[var(--purple-dark)]">Fora do DRE:</b> compra de mercadoria, insumo e equipamento (viram estoque e patrimônio). Venda cancelada não entra; devolvida entra só com o custo da devolução.
        </div>
      </div>
    </div>
  );
}
