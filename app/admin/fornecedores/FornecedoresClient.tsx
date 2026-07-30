"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

type Fornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  canal: string | null;
  link: string | null;
  obs: string | null;
  ibk_produtos: { count: number }[];
};

export function FornecedoresClient() {
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [canal, setCanal] = useState("");
  const [link, setLink] = useState("");
  const [obs, setObs] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ibk_fornecedores")
      .select("*, ibk_produtos(count)")
      .order("nome", { ascending: true });
    if (error) setErro(error.message);
    else setRows((data as Fornecedor[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;

  const adicionar = async () => {
    if (!supabase) return;
    if (!nome.trim()) {
      setErro("informe o nome do fornecedor");
      return;
    }
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("ibk_fornecedores").insert({
      nome: nome.trim(),
      contato: contato.trim() || null,
      canal: canal.trim() || null,
      link: link.trim() || null,
      obs: obs.trim() || null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome("");
    setContato("");
    setCanal("");
    setLink("");
    setObs("");
    carregar();
  };

  const remover = async (f: Fornecedor) => {
    if (!supabase) return;
    if (!confirm(`Remover o fornecedor "${f.nome}"? Os SKUs ligados a ele ficam sem fornecedor.`)) return;
    const { error } = await supabase.from("ibk_fornecedores").delete().eq("id", f.id);
    if (error) setErro(error.message);
    else carregar();
  };

  return (
    <div>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
        Fornecedores
      </h1>
      <p className="text-sm text-[var(--ink)]/70">Quem fornece, contatos e quantos SKUs vieram de cada um.</p>

      {/* novo fornecedor */}
      <div className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <Campo label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: ConectaVenda" className={`${inputCls} w-44`} />
        </Campo>
        <Campo label="Contato">
          <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="WhatsApp / e-mail" className={`${inputCls} w-40`} />
        </Campo>
        <Campo label="Canal">
          <input value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="catálogo / feira" className={`${inputCls} w-32`} />
        </Campo>
        <Campo label="Link">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={`${inputCls} w-48`} />
        </Campo>
        <Campo label="Obs">
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" className={`${inputCls} w-40`} />
        </Campo>
        <button
          onClick={adicionar}
          disabled={salvando}
          className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
        >
          {salvando ? "salvando..." : "adicionar"}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {/* lista */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {loading && <p className="text-[var(--ink)]/50">carregando...</p>}
        {!loading && rows.length === 0 && (
          <p className="text-[var(--ink)]/50">nenhum fornecedor ainda.</p>
        )}
        {rows.map((f) => (
          <div key={f.id} className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-[family-name:var(--font-baloo)] text-lg font-bold text-[var(--purple-dark)]">
                  {f.nome}
                </div>
                <div className="mt-0.5 text-sm text-[var(--ink)]/70">
                  {f.canal && <span>{f.canal}</span>}
                  {f.contato && <span> · {f.contato}</span>}
                </div>
                {f.link && (
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-xs font-semibold text-[var(--purple)] underline">
                    {f.link}
                  </a>
                )}
                {f.obs && <p className="mt-1 text-xs text-[var(--ink)]/55">{f.obs}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-[var(--purple)]/8 px-2 py-1 text-xs font-bold text-[var(--purple)]">
                {f.ibk_produtos?.[0]?.count ?? 0} SKUs
              </span>
            </div>
            <button onClick={() => remover(f)} className="mt-2 text-xs font-bold text-red-400 hover:text-red-600">
              remover
            </button>
          </div>
        ))}
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
