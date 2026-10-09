"use client";

import { useState } from "react";
import { brl, num } from "@/lib/formato";
import { COMISSAO_TIKTOK, VALOR_MOEDA_USD, calcularMoedas } from "@/lib/moedasTiktok";

const usd = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: v < 1 ? 4 : 2 }).format(v);

const ATALHOS = [100, 1000, 10000, 100000];

const campo =
  "w-full rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2.5 text-[15px] font-bold text-[var(--ink)] outline-none focus:border-[var(--purple)]";

export function Calculadora({ cotacao }: { cotacao: number | null }) {
  const [moedasTxt, setMoedasTxt] = useState("1.000");
  const [valorTxt, setValorTxt] = useState(String(VALOR_MOEDA_USD).replace(".", ","));
  const [comissaoTxt, setComissaoTxt] = useState(String(COMISSAO_TIKTOK * 100));
  const [cotacaoTxt, setCotacaoTxt] = useState(cotacao ? cotacao.toFixed(2).replace(".", ",") : "");

  const moedas = num(moedasTxt);
  const comissao = num(comissaoTxt) / 100;
  const dolar = num(cotacaoTxt);
  const r = calcularMoedas(moedas, num(valorTxt), comissao);
  const real = (v: number) => (dolar > 0 ? brl(v * dolar) : "R$ ?");

  const linhas = [
    { rotulo: "Valor dos presentes", us: usd(r.total), rs: real(r.total) },
    { rotulo: `Parte do TikTok (${String(Math.round(comissao * 1000) / 10).replace(".", ",")}%)`, us: `− ${usd(r.taxa)}`, rs: dolar > 0 ? `− ${real(r.taxa)}` : "R$ ?" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-3xl bg-white p-6 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <label htmlFor="moedas" className="text-sm font-bold text-[var(--purple-dark)]">
          🪙 Quantas moedas?
        </label>
        <input
          id="moedas"
          inputMode="numeric"
          value={moedasTxt}
          onChange={(e) => setMoedasTxt(e.target.value)}
          className={`${campo} mt-2 text-2xl`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setMoedasTxt(a.toLocaleString("pt-BR"))}
              className="rounded-full bg-[var(--purple)]/10 px-3 py-1.5 text-sm font-bold text-[var(--purple)] transition-colors hover:bg-[var(--purple)]/20"
            >
              {a.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <label className="text-xs font-bold text-[var(--ink)]/60">
            Valor da moeda (US$)
            <input inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} className={`${campo} mt-1`} />
          </label>
          <label className="text-xs font-bold text-[var(--ink)]/60">
            Parte do TikTok (%)
            <input inputMode="decimal" value={comissaoTxt} onChange={(e) => setComissaoTxt(e.target.value)} className={`${campo} mt-1`} />
          </label>
          <label className="text-xs font-bold text-[var(--ink)]/60">
            Dólar (R$)
            <input inputMode="decimal" value={cotacaoTxt} onChange={(e) => setCotacaoTxt(e.target.value)} placeholder="ex: 5,40" className={`${campo} mt-1`} />
          </label>
        </div>
        {cotacao == null && (
          <p className="mt-3 text-xs leading-relaxed text-[var(--ink)]/55">
            Não deu para buscar a cotação agora: digite o valor do dólar para ver em reais.
          </p>
        )}
      </div>

      <div aria-live="polite" className="rounded-3xl bg-[var(--purple-dark)] p-6 text-white shadow-[0_4px_0_rgba(76,29,128,0.25)]">
        <div className="text-sm font-bold text-white/70">
          {moedas.toLocaleString("pt-BR")} {moedas === 1 ? "moeda" : "moedas"}
        </div>
        <dl className="mt-3 space-y-3">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 border-b border-white/15 pb-3">
              <dt className="text-sm text-white/80">{l.rotulo}</dt>
              <dd className="text-right">
                <div className="font-bold">{l.rs}</div>
                <div className="text-xs text-white/60">{l.us}</div>
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="font-[family-name:var(--font-baloo)] text-lg font-extrabold">O criador recebe</dt>
            <dd className="text-right">
              <div className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--yellow)]">{real(r.criador)}</div>
              <div className="text-sm text-white/70">{usd(r.criador)}</div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
