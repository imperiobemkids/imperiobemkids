"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

export type Canal = {
  id: string;
  nome: string;
  taxa_pct: number;
  taxa_fixa: number;
  insumo_custo: number;
  limite_titulo: number | null;
  ordem: number;
  ativo: boolean;
  obs: string | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

type Form = { nome: string; taxaPct: string; taxaFixa: string; insumo: string; limiteTitulo: string; obs: string };
const vazio: Form = { nome: "", taxaPct: "", taxaFixa: "0", insumo: "0,40", limiteTitulo: "0", obs: "" };

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
    setForm({
      nome: c.nome,
      taxaPct: String(c.taxa_pct * 100).replace(".", ","),
      taxaFixa: String(c.taxa_fixa).replace(".", ","),
      insumo: String(c.insumo_custo).replace(".", ","),
      limiteTitulo: String(c.limite_titulo ?? 0),
      obs: c.obs ?? "",
    });
  };

  const salvar = async () => {
    if (!supabase) return;
    if (!form.nome.trim()) { setErro("informe o nome do canal"); return; }
    setErro("");
    const payload = {
      nome: form.nome.trim(),
      taxa_pct: num(form.taxaPct) / 100,
      taxa_fixa: num(form.taxaFixa),
      insumo_custo: num(form.insumo),
      limite_titulo: Math.round(num(form.limiteTitulo)),
      obs: form.obs.trim() || null,
    };
    const res = editId
      ? await supabase.from("ibk_canais").update(payload).eq("id", editId)
      : await supabase.from("ibk_canais").insert({ ...payload, ordem: rows.length + 1 });
    if (res.error) { setErro(res.error.message); return; }
    setEditId(null); setNovo(false); setForm(vazio);
    carregar();
  };

  const alternarAtivo = async (c: Canal) => {
    if (!supabase) return;
    await supabase.from("ibk_canais").update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  };

  const editando = novo || editId !== null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Canais de venda
          </h1>
          <p className="text-sm text-[var(--ink)]/70">
            Cada canal tem sua comissão, tarifa fixa e embalagem. É daqui que a precificação tira as contas.
          </p>
        </div>
        {!editando && (
          <button onClick={() => { setNovo(true); setEditId(null); setForm(vazio); }}
            className="rounded-xl bg-[var(--purple)] px-4 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)]">
            + Novo canal
          </button>
        )}
      </div>

      {editando && (
        <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-[var(--purple)]/30 bg-white p-4">
          <Campo label="Nome"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex: Shein" className={`${inputCls} w-40`} /></Campo>
          <Campo label="Comissão %"><input value={form.taxaPct} onChange={(e) => setForm({ ...form, taxaPct: e.target.value })} placeholder="20" className={`${inputCls} w-20`} /></Campo>
          <Campo label="Tarifa fixa"><input value={form.taxaFixa} onChange={(e) => setForm({ ...form, taxaFixa: e.target.value })} placeholder="0" className={`${inputCls} w-20`} /></Campo>
          <Campo label="Embalagem"><input value={form.insumo} onChange={(e) => setForm({ ...form, insumo: e.target.value })} placeholder="0,40" className={`${inputCls} w-20`} /></Campo>
          <Campo label="Limite do título"><input value={form.limiteTitulo} onChange={(e) => setForm({ ...form, limiteTitulo: e.target.value })} placeholder="0" className={`${inputCls} w-24`} /></Campo>
          <Campo label="Observação"><input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} className={`${inputCls} w-56`} /></Campo>
          <button onClick={salvar} className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)]">salvar</button>
          <button onClick={() => { setEditId(null); setNovo(false); }} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2 text-sm font-bold text-[var(--purple)]">cancelar</button>
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
              <th className="p-3">Canal</th>
              <th className="p-3">Comissão</th>
              <th className="p-3">Tarifa fixa</th>
              <th className="p-3">Embalagem</th>
              <th className="p-3">Limite título</th>
              <th className="p-3">Situação</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (<tr><td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-[var(--ink)]/50">nenhum canal. rode a migration 0009 ou cadastre um.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className={`border-b border-[var(--purple)]/6 last:border-0 ${c.ativo ? "" : "opacity-50"}`}>
                <td className="p-3">
                  <div className="font-semibold text-[var(--ink)]">{c.nome}</div>
                  {c.obs && <div className="text-[11px] text-[var(--ink)]/45">{c.obs}</div>}
                </td>
                <td className="p-3">{Math.round(c.taxa_pct * 1000) / 10}%</td>
                <td className="p-3">{brl(c.taxa_fixa)}</td>
                <td className="p-3">{brl(c.insumo_custo)}</td>
                <td className="p-3">{c.limite_titulo ? `${c.limite_titulo} car.` : "-"}</td>
                <td className="p-3">
                  <button onClick={() => alternarAtivo(c)} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${c.ativo ? "bg-emerald-100 text-emerald-700" : "bg-[var(--ink)]/10 text-[var(--ink)]/50"}`}>
                    {c.ativo ? "ativo" : "inativo"}
                  </button>
                </td>
                <td className="p-3">
                  <button onClick={() => abrirEdicao(c)} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--ink)]/50">
        As taxas vieram como ponto de partida. Confira na conta de cada plataforma e ajuste aqui:
        toda a precificação e o lucro das vendas usam estes números.
      </p>
    </div>
  );
}

const inputCls =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
