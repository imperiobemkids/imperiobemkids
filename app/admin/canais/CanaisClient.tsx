"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Warning, ArrowSquareOut } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonRows, btnPrimario, btnSecundario } from "../ui";
import type { Faixa } from "@/lib/canais";
import { hojeIso, num, brl } from "@/lib/formato";

/*
  Canais de venda e o que cada um cobra. Tudo editavel aqui, porque as
  tabelas mudam: comissao e fixa (unica ou por faixa de preco do item),
  fixa por item ou por pedido, programa opcional em cima (Frete Gratis,
  +6%), embalagem, limite de titulo, e a data em que a tabela foi conferida
  com a fonte. Tabela conferida ha mais de 90 dias ganha aviso.
*/
export type Canal = {
  id: string;
  nome: string;
  taxa_pct: number;
  taxa_fixa: number;
  taxa_fixa_por_item: boolean | null;
  insumo_custo: number;
  limite_titulo: number | null;
  faixas: Faixa[] | null;
  programa_nome: string | null;
  programa_pct: number;
  programa_ativo: boolean;
  taxas_conferidas_em: string | null;
  taxas_fonte: string | null;
  ordem: number;
  ativo: boolean;
  obs: string | null;
};

const pctTxt = (v: number) => String(Math.round(v * 1000) / 10).replace(".", ",");
const valTxt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");
const diasDesde = (iso: string) => Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400000);

type FaixaForm = { ate: string; pct: string; fixo: string };
type Form = {
  nome: string;
  taxaPct: string;
  taxaFixa: string;
  porItem: boolean;
  usaFaixas: boolean;
  faixas: FaixaForm[];
  programaNome: string;
  programaPct: string;
  programaAtivo: boolean;
  insumo: string;
  limiteTitulo: string;
  conferidasEm: string;
  fonte: string;
  obs: string;
};

const vazio: Form = {
  nome: "",
  taxaPct: "",
  taxaFixa: "0",
  porItem: true,
  usaFaixas: false,
  faixas: [{ ate: "", pct: "", fixo: "" }],
  programaNome: "",
  programaPct: "",
  programaAtivo: false,
  insumo: "0,40",
  limiteTitulo: "0",
  conferidasEm: hojeIso(),
  fonte: "",
  obs: "",
};

export function CanaisClient() {
  const [rows, setRows] = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(vazio);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("ibk_canais").select("*").order("ordem");
    if (error) setErro(error.message);
    else setRows((data as Canal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const abrirEdicao = (c: Canal) => {
    setNovo(false);
    setEditId(c.id);
    const faixas = Array.isArray(c.faixas) && c.faixas.length > 0 ? c.faixas : null;
    setForm({
      nome: c.nome,
      taxaPct: pctTxt(c.taxa_pct),
      taxaFixa: valTxt(c.taxa_fixa),
      porItem: c.taxa_fixa_por_item ?? true,
      usaFaixas: !!faixas,
      faixas: faixas
        ? [...faixas]
            .sort((a, b) => (a.ate === null ? 1 : b.ate === null ? -1 : a.ate - b.ate))
            .map((f) => ({ ate: f.ate === null ? "" : valTxt(f.ate), pct: pctTxt(f.pct), fixo: valTxt(f.fixo) }))
        : [{ ate: "", pct: "", fixo: "" }],
      programaNome: c.programa_nome ?? "",
      programaPct: c.programa_pct ? pctTxt(c.programa_pct) : "",
      programaAtivo: !!c.programa_ativo,
      insumo: valTxt(c.insumo_custo),
      limiteTitulo: String(c.limite_titulo ?? 0),
      conferidasEm: c.taxas_conferidas_em ?? "",
      fonte: c.taxas_fonte ?? "",
      obs: c.obs ?? "",
    });
  };

  const salvar = async () => {
    if (!supabase) return;
    if (!form.nome.trim()) return setErro("informe o nome do canal");
    setErro("");
    // faixas: linhas com "ate" vazio sao a ultima (sem teto); so pode haver uma
    const faixas: Faixa[] = form.usaFaixas
      ? form.faixas
          .filter((f) => f.pct !== "" || f.fixo !== "" || f.ate !== "")
          .map((f) => ({ ate: f.ate.trim() === "" ? null : num(f.ate), pct: num(f.pct) / 100, fixo: num(f.fixo) }))
      : [];
    if (form.usaFaixas && faixas.filter((f) => f.ate === null).length !== 1) {
      return setErro("nas faixas, deixe exatamente uma linha com o 'até' vazio: é a faixa de cima, sem teto");
    }
    const payload = {
      nome: form.nome.trim(),
      taxa_pct: num(form.taxaPct) / 100,
      taxa_fixa: num(form.taxaFixa),
      taxa_fixa_por_item: form.porItem,
      faixas,
      programa_nome: form.programaNome.trim() || null,
      programa_pct: num(form.programaPct) / 100,
      programa_ativo: form.programaAtivo && num(form.programaPct) > 0,
      insumo_custo: num(form.insumo),
      limite_titulo: Math.round(num(form.limiteTitulo)),
      taxas_conferidas_em: form.conferidasEm || null,
      taxas_fonte: form.fonte.trim() || null,
      obs: form.obs.trim() || null,
    };
    const res = editId
      ? await supabase.from("ibk_canais").update(payload).eq("id", editId)
      : await supabase.from("ibk_canais").insert({ ...payload, ordem: rows.length + 1 });
    if (res.error) return setErro(res.error.message);
    setEditId(null);
    setNovo(false);
    setForm(vazio);
    carregar();
  };

  const alternarAtivo = async (c: Canal) => {
    if (!supabase) return;
    await supabase.from("ibk_canais").update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  };

  const alternarPrograma = async (c: Canal) => {
    if (!supabase) return;
    await supabase.from("ibk_canais").update({ programa_ativo: !c.programa_ativo }).eq("id", c.id);
    carregar();
  };

  const setFaixa = (i: number, patch: Partial<FaixaForm>) =>
    setForm((f) => ({ ...f, faixas: f.faixas.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));

  const editando = novo || editId !== null;
  const velhas = rows.filter((c) => c.ativo && (!c.taxas_conferidas_em || diasDesde(c.taxas_conferidas_em) > 90));

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">Canais de venda</h1>
          <p className="text-sm text-[var(--ink)]/65">
            O que cada plataforma cobra. Toda a precificação e o lucro das vendas saem daqui, então quando a tabela mudar, mude aqui.
          </p>
        </div>
        {!editando && (
          <button onClick={() => { setNovo(true); setEditId(null); setForm({ ...vazio, conferidasEm: hojeIso() }); }} className={`flex items-center gap-1.5 ${btnPrimario}`}>
            <Plus size={16} weight="bold" /> canal
          </button>
        )}
      </div>

      {velhas.length > 0 && !editando && (
        <div className="card mt-4 flex items-center gap-3 border-2 border-[var(--sun)] p-3 text-sm">
          <Warning size={22} weight="duotone" className="text-amber-600" />
          <span>
            Tabela conferida há mais de 90 dias (ou nunca) em: <b>{velhas.map((c) => c.nome).join(", ")}</b>. Vale abrir a central do vendedor e comparar.
          </span>
        </div>
      )}

      {editando && (
        <div className="card mt-5 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <Campo label="Nome"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex: Kwai Shop" className={`${inp} w-40`} autoFocus /></Campo>
            <Campo label="Embalagem por pedido"><input value={form.insumo} onChange={(e) => setForm({ ...form, insumo: e.target.value })} className={`${inp} num w-20`} /></Campo>
            <Campo label="Limite do título"><input value={form.limiteTitulo} onChange={(e) => setForm({ ...form, limiteTitulo: e.target.value })} className={`${inp} num w-20`} /></Campo>
            <Campo label="Observação"><input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} className={`${inp} w-64`} /></Campo>
          </div>

          {/* comissao e fixa */}
          <div className="mt-4 border-t border-[var(--purple)]/10 pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Comissão e taxa fixa</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input type="radio" checked={!form.usaFaixas} onChange={() => setForm({ ...form, usaFaixas: false })} className="accent-[var(--purple)]" /> única
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input type="radio" checked={form.usaFaixas} onChange={() => setForm({ ...form, usaFaixas: true })} className="accent-[var(--purple)]" /> por faixa de preço do item
              </label>
              <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
                fixa por
                <select value={form.porItem ? "item" : "pedido"} onChange={(e) => setForm({ ...form, porItem: e.target.value === "item" })} className={inp}>
                  <option value="item">item vendido</option>
                  <option value="pedido">pedido</option>
                </select>
              </label>
            </div>

            {!form.usaFaixas ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Campo label="Comissão %"><input value={form.taxaPct} onChange={(e) => setForm({ ...form, taxaPct: e.target.value })} placeholder="20" className={`${inp} num w-20`} /></Campo>
                <Campo label="Fixa R$"><input value={form.taxaFixa} onChange={(e) => setForm({ ...form, taxaFixa: e.target.value })} placeholder="4,00" className={`${inp} num w-20`} /></Campo>
              </div>
            ) : (
              <div className="mt-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-bold uppercase text-[var(--ink)]/70">
                  <span>Preço até R$</span><span>Comissão %</span><span>Fixa R$</span><span />
                </div>
                {form.faixas.map((f, i) => (
                  <div key={i} className="mt-1 grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                    <input value={f.ate} onChange={(e) => setFaixa(i, { ate: e.target.value })} placeholder="vazio = acima" className={`${inp} num`} />
                    <input value={f.pct} onChange={(e) => setFaixa(i, { pct: e.target.value })} placeholder="10" className={`${inp} num`} />
                    <input value={f.fixo} onChange={(e) => setFaixa(i, { fixo: e.target.value })} placeholder="4,00" className={`${inp} num`} />
                    <button onClick={() => setForm((x) => ({ ...x, faixas: x.faixas.filter((_, idx) => idx !== i) }))} aria-label="tirar faixa" className="p-1 text-[var(--ink)]/55 hover:text-red-500">
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setForm((x) => ({ ...x, faixas: [...x.faixas, { ate: "", pct: "", fixo: "" }] }))} className="mt-2 text-xs font-bold text-[var(--purple)] hover:underline">
                  + faixa
                </button>
                <p className="mt-1 text-[11px] text-[var(--ink)]/70">
                  a faixa vale pelo preço de cada item. Deixe o &quot;até&quot; vazio na última. Quando a fixa é um percentual (ML: 50% do valor até R$ 12,49), some na comissão dessa faixa.
                </p>
              </div>
            )}
          </div>

          {/* programa opcional */}
          <div className="mt-4 border-t border-[var(--purple)]/10 pt-3">
            <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Programa opcional (em cima da comissão)</span>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Campo label="Nome"><input value={form.programaNome} onChange={(e) => setForm({ ...form, programaNome: e.target.value })} placeholder="Programa Frete Grátis" className={`${inp} w-48`} /></Campo>
              <Campo label="+ %"><input value={form.programaPct} onChange={(e) => setForm({ ...form, programaPct: e.target.value })} placeholder="6" className={`${inp} num w-16`} /></Campo>
              <label className="flex items-center gap-1.5 pb-2 text-xs font-semibold">
                <input type="checkbox" checked={form.programaAtivo} onChange={(e) => setForm({ ...form, programaAtivo: e.target.checked })} className="accent-[var(--purple)]" /> a loja aderiu (entra na conta)
              </label>
            </div>
          </div>

          {/* conferencia */}
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--purple)]/10 pt-3">
            <Campo label="Tabela conferida em"><input type="date" value={form.conferidasEm} onChange={(e) => setForm({ ...form, conferidasEm: e.target.value })} className={inp} /></Campo>
            <Campo label="Fonte (link da central do vendedor)"><input value={form.fonte} onChange={(e) => setForm({ ...form, fonte: e.target.value })} placeholder="https://" className={`${inp} w-72`} /></Campo>
            <button onClick={() => setForm({ ...form, conferidasEm: hojeIso() })} className={btnSecundario}>conferi hoje</button>
          </div>

          {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={salvar} className={btnPrimario}>salvar</button>
            <button onClick={() => { setEditId(null); setNovo(false); setErro(""); }} className={btnSecundario}>cancelar</button>
          </div>
        </div>
      )}

      {erro && !editando && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Canal</th>
              <th className="p-3">Comissão + fixa</th>
              <th className="p-3">Programa</th>
              <th className="p-3">Embalagem</th>
              <th className="p-3">Conferida</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={7} />}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-[var(--ink)]/70">nenhum canal. rode a migration 0009 ou cadastre um.</td></tr>
            )}
            {rows.map((c) => {
              const faixas = Array.isArray(c.faixas) && c.faixas.length > 0 ? [...c.faixas].sort((a, b) => (a.ate === null ? 1 : b.ate === null ? -1 : a.ate - b.ate)) : null;
              const dias = c.taxas_conferidas_em ? diasDesde(c.taxas_conferidas_em) : null;
              const velha = dias === null || dias > 90;
              return (
                <tr key={c.id} className={`border-b border-[var(--purple)]/6 align-top last:border-0 ${c.ativo ? "" : "opacity-50"}`}>
                  <td className="p-3">
                    <div className="font-semibold text-[var(--ink)]">{c.nome}</div>
                    {c.obs && <div className="max-w-[220px] text-[11px] leading-snug text-[var(--ink)]/70">{c.obs}</div>}
                  </td>
                  <td className="num p-3 text-[var(--ink)]/80">
                    {faixas ? (
                      <div className="text-[12px] leading-snug">
                        {faixas.map((f, i) => (
                          <div key={i}>
                            <span className="text-[var(--ink)]/70">{f.ate === null ? "acima" : `até ${brl(f.ate)}`}:</span> {pctTxt(f.pct)}%{f.fixo > 0 ? ` + ${brl(f.fixo)}` : ""}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>{pctTxt(c.taxa_pct)}%{c.taxa_fixa > 0 ? ` + ${brl(c.taxa_fixa)}` : ""}</span>
                    )}
                    {(c.taxa_fixa > 0 || faixas?.some((f) => f.fixo > 0)) && (
                      <div className="text-[10px] text-[var(--ink)]/70">fixa por {c.taxa_fixa_por_item === false ? "pedido" : "item"}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {c.programa_nome && c.programa_pct > 0 ? (
                      <button
                        onClick={() => alternarPrograma(c)}
                        title={c.programa_ativo ? "clique pra desligar" : "clique pra ligar"}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${c.programa_ativo ? "bg-[var(--purple)] text-white" : "bg-[var(--ink)]/8 text-[var(--ink)]/75"}`}
                      >
                        {c.programa_nome} +{pctTxt(c.programa_pct)}% · {c.programa_ativo ? "ligado" : "desligado"}
                      </button>
                    ) : (
                      <span className="text-[var(--ink)]/55">-</span>
                    )}
                  </td>
                  <td className="num p-3">{brl(c.insumo_custo)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${velha ? "bg-[var(--sun)]/50 text-[var(--ink)]" : "bg-emerald-100 text-emerald-700"}`}>
                      {dias === null ? "nunca" : dias === 0 ? "hoje" : `há ${dias}d`}
                    </span>
                    {c.taxas_fonte && (
                      <a href={c.taxas_fonte} target="_blank" rel="noopener noreferrer" aria-label="abrir fonte" className="ml-1 inline-block align-middle text-[var(--purple)]">
                        <ArrowSquareOut size={14} weight="bold" />
                      </a>
                    )}
                  </td>
                  <td className="p-3">
                    <button onClick={() => alternarAtivo(c)} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${c.ativo ? "bg-emerald-100 text-emerald-700" : "bg-[var(--ink)]/10 text-[var(--ink)]/70"}`}>
                      {c.ativo ? "ativo" : "inativo"}
                    </button>
                  </td>
                  <td className="p-3">
                    <button onClick={() => abrirEdicao(c)} className={btnSecundario}>editar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--ink)]/70">
        Canal inativo não aparece no caixa nem na precificação, mas a venda antiga guarda a taxa que valia no dia.
      </p>
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
