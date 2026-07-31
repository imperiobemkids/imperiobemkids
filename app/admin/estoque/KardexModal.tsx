"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mov = {
  id: string;
  data: string;
  tipo: string;
  origem: string;
  qtd: number;
  custo_unit: number;
  saldo_depois: number;
  custo_medio_depois: number;
  obs: string | null;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const rotuloOrigem: Record<string, string> = {
  compra: "Compra",
  venda: "Venda",
  ajuste: "Ajuste",
  devolucao: "Devolução",
  inicial: "Saldo inicial",
};

export function KardexModal({ produtoId, titulo, onClose }: { produtoId: string; titulo: string; onClose: () => void }) {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("ibk_estoque_mov")
      .select("*")
      .eq("produto_id", produtoId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setMovs((data as Mov[]) ?? []);
        setLoading(false);
      });
  }, [produtoId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="mt-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              Extrato de estoque
            </h2>
            <p className="text-sm text-[var(--ink)]/60">{titulo}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1.5 text-sm font-bold text-[var(--purple)]">fechar</button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                <th className="p-2">Data</th>
                <th className="p-2">Origem</th>
                <th className="p-2">Qtd</th>
                <th className="p-2">Custo un.</th>
                <th className="p-2">Saldo</th>
                <th className="p-2">Custo médio</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={6} className="p-5 text-center text-[var(--ink)]/50">carregando...</td></tr>)}
              {!loading && movs.length === 0 && (
                <tr><td colSpan={6} className="p-5 text-center text-[var(--ink)]/50">sem movimentações registradas.</td></tr>
              )}
              {movs.map((m) => (
                <tr key={m.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-2">{new Date(m.data).toLocaleDateString("pt-BR")}</td>
                  <td className="p-2">
                    {rotuloOrigem[m.origem] ?? m.origem}
                    {m.obs && <div className="text-[11px] text-[var(--ink)]/45">{m.obs}</div>}
                  </td>
                  <td className={`p-2 font-bold ${m.qtd >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {m.qtd > 0 ? `+${m.qtd}` : m.qtd}
                  </td>
                  <td className="p-2">{brl(m.custo_unit)}</td>
                  <td className="p-2 font-semibold">{m.saldo_depois}</td>
                  <td className="p-2">{brl(m.custo_medio_depois)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
