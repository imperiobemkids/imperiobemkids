"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Venda = {
  id: string;
  data: string;
  canal: string;
  tipo: string;
  preco_venda: number;
  taxa_pct: number;
  taxa_fixa: number;
  frete: number;
  devolvida: boolean;
  recebido: number | null;
  data_recebimento: string | null;
  obs_conciliacao: string | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/*
  Liquido esperado = preco - comissao - tarifa fixa - frete pago pela loja.
  E o que a plataforma deveria repassar. A diferenca para o que caiu na conta
  e o que precisa ser investigado (campanha, estorno, ajuste, frete debitado).
*/
const esperado = (v: Venda) =>
  v.preco_venda * (1 - v.taxa_pct) - (v.taxa_fixa ?? 0) - (v.frete ?? 0);

export function ConciliacaoClient() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"pendentes" | "conciliadas">("pendentes");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ibk_vendas")
      .select("*")
      .eq("devolvida", false)
      .order("data", { ascending: false })
      .limit(200);
    if (error) setErro(error.message);
    else setVendas((data as Venda[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const conciliar = async (v: Venda) => {
    if (!supabase) return;
    const sugestao = esperado(v).toFixed(2).replace(".", ",");
    const resposta = prompt(
      `Venda de ${brl(v.preco_venda)} em ${v.canal}.\n\nEsperado receber: ${brl(esperado(v))}\n\nQuanto caiu de verdade na conta?`,
      sugestao,
    );
    if (resposta === null) return;
    const valor = parseFloat(resposta.replace(",", ".")) || 0;
    const dif = valor - esperado(v);
    let obs: string | null = null;
    if (Math.abs(dif) >= 0.01) {
      obs = prompt(
        `Diferença de ${brl(dif)}. O que explica? (opcional)\n\nEx: taxa de campanha, frete debitado, estorno parcial.`,
        "",
      );
    }
    const { error } = await supabase
      .from("ibk_vendas")
      .update({
        recebido: valor,
        data_recebimento: new Date().toISOString().slice(0, 10),
        obs_conciliacao: obs || null,
      })
      .eq("id", v.id);
    if (error) { setErro(error.message); return; }

    // ajusta o caixa pela diferenca, para o saldo refletir o que realmente entrou
    if (Math.abs(dif) >= 0.01) {
      await supabase.from("ibk_movimentos").insert({
        tipo: dif > 0 ? "entrada" : "saida",
        categoria: "outro",
        valor: Math.abs(dif),
        descricao: `Ajuste de repasse (${v.canal})${obs ? `: ${obs}` : ""}`,
        ref_venda_id: v.id,
      });
    }
    carregar();
  };

  const desfazer = async (v: Venda) => {
    if (!supabase) return;
    if (!confirm("Desfazer a conciliação desta venda?")) return;
    await supabase
      .from("ibk_vendas")
      .update({ recebido: null, data_recebimento: null, obs_conciliacao: null })
      .eq("id", v.id);
    carregar();
  };

  const pendentes = vendas.filter((v) => v.recebido === null);
  const conciliadas = vendas.filter((v) => v.recebido !== null);
  const lista = aba === "pendentes" ? pendentes : conciliadas;

  const aReceber = pendentes.reduce((s, v) => s + esperado(v), 0);
  const totalEsperado = conciliadas.reduce((s, v) => s + esperado(v), 0);
  const totalRecebido = conciliadas.reduce((s, v) => s + (v.recebido ?? 0), 0);
  const divergencia = totalRecebido - totalEsperado;
  const comDivergencia = conciliadas.filter((v) => Math.abs((v.recebido ?? 0) - esperado(v)) >= 0.01);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Conciliação de repasse
          </h1>
          <p className="text-sm text-[var(--ink)]/70">
            Confere se o que a plataforma pagou bate com o que ela deveria pagar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi titulo="A receber" valor={brl(aReceber)} sub={`${pendentes.length} vendas`} />
          <Kpi titulo="Já recebido" valor={brl(totalRecebido)} sub={`${conciliadas.length} conciliadas`} />
          <Kpi
            titulo="Divergência"
            valor={brl(divergencia)}
            negativo={divergencia < -0.01}
            sub={comDivergencia.length ? `${comDivergencia.length} com diferença` : "tudo bateu"}
          />
        </div>
      </div>

      {divergencia < -0.01 && (
        <div className="mt-4 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
          <p className="text-sm text-[var(--ink)]/80">
            Você recebeu <strong className="text-red-600">{brl(Math.abs(divergencia))} a menos</strong> do que o
            esperado nas vendas já conciliadas. Vale abrir o extrato da plataforma e conferir taxa de campanha,
            frete debitado e estornos.
          </p>
        </div>
      )}

      {/* abas */}
      <div className="mt-5 flex gap-1">
        {(["pendentes", "conciliadas"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${
              aba === a ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/8 text-[var(--purple)]"
            }`}
          >
            {a} ({a === "pendentes" ? pendentes.length : conciliadas.length})
          </button>
        ))}
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Data</th>
              <th className="p-3">Canal</th>
              <th className="p-3">Preço</th>
              <th className="p-3">Esperado</th>
              {aba === "conciliadas" && (<><th className="p-3">Recebido</th><th className="p-3">Diferença</th></>)}
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
            {!loading && lista.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">
                  {aba === "pendentes" ? "nenhuma venda esperando repasse." : "nenhuma venda conciliada ainda."}
                </td>
              </tr>
            )}
            {lista.map((v) => {
              const esp = esperado(v);
              const dif = (v.recebido ?? 0) - esp;
              return (
                <tr key={v.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-3">{new Date(v.data).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 capitalize">{v.canal}</td>
                  <td className="p-3">{brl(v.preco_venda)}</td>
                  <td className="p-3 font-semibold">{brl(esp)}</td>
                  {aba === "conciliadas" && (
                    <>
                      <td className="p-3 font-bold text-[var(--purple-dark)]">{brl(v.recebido ?? 0)}</td>
                      <td className={`p-3 font-bold ${Math.abs(dif) < 0.01 ? "text-[var(--ink)]/40" : dif > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {Math.abs(dif) < 0.01 ? "bateu" : brl(dif)}
                        {v.obs_conciliacao && <div className="text-[11px] font-normal text-[var(--ink)]/50">{v.obs_conciliacao}</div>}
                      </td>
                    </>
                  )}
                  <td className="p-3">
                    {v.recebido === null ? (
                      <button onClick={() => conciliar(v)} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                        conciliar
                      </button>
                    ) : (
                      <button onClick={() => desfazer(v)} className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--ink)]/40 hover:text-red-500">
                        desfazer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--ink)]/50">
        Esperado = preço − comissão − tarifa fixa − frete pago pela loja. Quando o valor recebido difere,
        o sistema lança a diferença no caixa para o saldo refletir o dinheiro real.
      </p>
    </div>
  );
}

function Kpi({ titulo, valor, sub, negativo }: { titulo: string; valor: string; sub?: string; negativo?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className={`font-[family-name:var(--font-baloo)] text-lg font-extrabold ${negativo ? "text-red-500" : "text-[var(--purple-dark)]"}`}>
        {valor}
      </div>
      {sub && <div className="text-[10px] text-[var(--ink)]/50">{sub}</div>}
    </div>
  );
}
