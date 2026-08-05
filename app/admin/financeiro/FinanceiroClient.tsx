"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Mov = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  categoria: string;
  valor: number;
  descricao: string | null;
  pago: boolean;
  vencimento: string | null;
  forma_pagamento: string | null;
  documento: string | null;
};

const CATEGORIAS = ["mercadoria", "insumo", "capex", "venda", "taxa_shopee", "frete", "ads", "outro"];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const catLabel = (c: string) =>
  ({ mercadoria: "Mercadoria", insumo: "Insumo", capex: "Capex", venda: "Venda", taxa_shopee: "Taxa Shopee", frete: "Frete", ads: "Anúncios (Ads)", outro: "Outro" }[c] ?? c);

const noMes = (dataISO: string) => {
  const d = new Date(dataISO);
  const hoje = new Date();
  return d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth();
};

export function FinanceiroClient() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // form
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("outro");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pago, setPago] = useState(true);
  const [vencimento, setVencimento] = useState("");
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [documento, setDocumento] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ibk_movimentos")
      .select("*")
      .order("data", { ascending: false })
      .limit(200);
    if (error) setErro(error.message);
    else setMovs((data as Mov[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const adicionar = async () => {
    if (!supabase) return;
    const v = parseFloat(valor.replace(",", "."));
    if (!v) {
      setErro("informe o valor");
      return;
    }
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("ibk_movimentos").insert({
      tipo,
      categoria,
      valor: v,
      data,
      descricao: descricao.trim() || null,
      pago,
      vencimento: vencimento || null,
      forma_pagamento: formaPagamento || null,
      documento: documento.trim() || null,
      data_pagamento: pago ? data : null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setValor("");
    setDescricao("");
    setVencimento("");
    setDocumento("");
    setData(hoje);
    carregar();
  };

  const marcarPago = async (m: Mov) => {
    if (!supabase) return;
    setMovs((r) => r.map((x) => (x.id === m.id ? { ...x, pago: true } : x)));
    await supabase.from("ibk_movimentos").update({ pago: true }).eq("id", m.id);
  };

  // somas
  const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const saidas = movs.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const saldo = entradas - saidas;

  const entradasMes = movs.filter((m) => m.tipo === "entrada" && noMes(m.data)).reduce((s, m) => s + m.valor, 0);
  const saidasMes = movs.filter((m) => m.tipo === "saida" && noMes(m.data)).reduce((s, m) => s + m.valor, 0);

  const porCategoria = CATEGORIAS.map((c) => {
    const e = movs.filter((m) => m.categoria === c && m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    const sd = movs.filter((m) => m.categoria === c && m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    return { categoria: c, entradas: e, saidas: sd, liquido: e - sd };
  }).filter((x) => x.entradas || x.saidas);

  const aPagar = movs.filter((m) => !m.pago);
  const totalAPagar = aPagar.reduce((s, m) => s + m.valor, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Financeiro
          </h1>
          <p className="text-sm text-[var(--ink)]/70">Caixa, contas a pagar e resultado do mês.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi titulo="Saldo de caixa" valor={brl(saldo)} destaque={saldo >= 0} />
          <Kpi titulo="Entradas" valor={brl(entradas)} />
          <Kpi titulo="Saídas" valor={brl(saidas)} />
        </div>
      </div>

      {/* resultado do mes */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card titulo="Entradas do mês" valor={brl(entradasMes)} />
        <Card titulo="Saídas do mês" valor={brl(saidasMes)} />
        <Card titulo="Resultado do mês" valor={brl(entradasMes - saidasMes)} destaque={entradasMes - saidasMes >= 0} />
      </div>

      {/* novo movimento */}
      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <Campo label="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
        </Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "saida")} className={inputCls}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </Campo>
        <Campo label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{catLabel(c)}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Valor">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={`${inputCls} w-24`} />
        </Campo>
        <Campo label="Descrição">
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="opcional" className={`${inputCls} w-48`} />
        </Campo>
        <Campo label="Forma">
          <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={inputCls}>
            <option value="">nao informada</option>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
            <option value="boleto">Boleto</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferência</option>
          </select>
        </Campo>
        <Campo label="Documento">
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="nota, recibo, pedido" className={`${inputCls} w-40`} />
        </Campo>
        <Campo label="Pago?">
          <select value={pago ? "s" : "n"} onChange={(e) => setPago(e.target.value === "s")} className={inputCls}>
            <option value="s">Pago</option>
            <option value="n">A pagar</option>
          </select>
        </Campo>
        {!pago && (
          <Campo label="Vencimento">
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inputCls} />
          </Campo>
        )}
        <button
          onClick={adicionar}
          disabled={salvando}
          className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
        >
          {salvando ? "salvando..." : "lançar"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* contas a pagar */}
      {aPagar.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-[var(--sun)] bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Contas a pagar
            </h2>
            <span className="text-sm font-bold text-[var(--ink)]/70">{brl(totalAPagar)}</span>
          </div>
          <div className="space-y-2">
            {aPagar.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-[var(--sun)]/20 px-3 py-2 text-sm">
                <span>
                  <strong>{brl(m.valor)}</strong> · {catLabel(m.categoria)}
                  {m.descricao ? ` · ${m.descricao}` : ""}
                  {m.vencimento ? ` · vence ${new Date(m.vencimento).toLocaleDateString("pt-BR")}` : ""}
                </span>
                <button onClick={() => marcarPago(m)} className="rounded-lg bg-[var(--purple)] px-3 py-1 text-xs font-extrabold text-white hover:bg-[var(--purple-dark)]">
                  marcar pago
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* extrato: os lancamentos em ordem de data */}
      <div className="mt-5">
        <h2 className="mb-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
          Últimos lançamentos
        </h2>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="hidden p-3 sm:table-cell">Categoria</th>
                <th className="hidden p-3 lg:table-cell">Forma</th>
                <th className="p-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={5} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
              {!loading && movs.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-[var(--ink)]/50">nenhum lançamento ainda.</td></tr>
              )}
              {movs.slice(0, 40).map((m) => (
                <tr key={m.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="whitespace-nowrap p-3">{new Date(m.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    <div className="text-[var(--ink)]">{m.descricao || catLabel(m.categoria)}</div>
                    {m.documento && <div className="text-[11px] text-[var(--ink)]/45">{m.documento}</div>}
                    {!m.pago && (
                      <span className="mt-0.5 inline-block rounded-full bg-[var(--sun)]/40 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[var(--ink)]">
                        a pagar
                      </span>
                    )}
                  </td>
                  <td className="hidden p-3 text-[var(--ink)]/70 sm:table-cell">{catLabel(m.categoria)}</td>
                  <td className="hidden p-3 capitalize text-[var(--ink)]/60 lg:table-cell">{m.forma_pagamento || "-"}</td>
                  <td className={`whitespace-nowrap p-3 font-bold ${m.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                    {m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {movs.length > 40 && (
          <p className="mt-2 text-xs text-[var(--ink)]/45">mostrando os 40 mais recentes de {movs.length}.</p>
        )}
      </div>

      {/* por categoria */}
      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Categoria</th>
              <th className="p-3">Entradas</th>
              <th className="p-3">Saídas</th>
              <th className="p-3">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>
            )}
            {!loading && porCategoria.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-[var(--ink)]/50">nenhum movimento ainda.</td></tr>
            )}
            {porCategoria.map((c) => (
              <tr key={c.categoria} className="border-b border-[var(--purple)]/6 last:border-0">
                <td className="p-3 font-semibold">{catLabel(c.categoria)}</td>
                <td className="p-3 text-emerald-600">{c.entradas ? brl(c.entradas) : "-"}</td>
                <td className="p-3 text-red-500">{c.saidas ? brl(c.saidas) : "-"}</td>
                <td className={`p-3 font-bold ${c.liquido >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(c.liquido)}</td>
              </tr>
            ))}
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

function Kpi({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className={`font-[family-name:var(--font-baloo)] text-lg font-extrabold ${destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"}`}>
        {valor}
      </div>
    </div>
  );
}

function Card({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
      <div className="text-xs font-bold uppercase text-[var(--ink)]/45">{titulo}</div>
      <div className={`mt-1 font-[family-name:var(--font-baloo)] text-xl font-extrabold ${destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"}`}>
        {valor}
      </div>
    </div>
  );
}
