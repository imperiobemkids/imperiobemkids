"use client";

import Link from "next/link";

export type Variacao = { id: string; tamanho: string | null; cor: string | null; qtd_atual: number };

/*
  Grade tamanho x tipo (a coluna "cor" guarda o tipo do kit: 2, 4, 6 pecas).
  Cada celula e a variacao: quantidade com mais e menos, vermelho zerada,
  amarelo no minimo. Um so tipo vira uma linha de tamanhos; um so tamanho,
  uma linha de tipos.
*/
export function GradeVariacoes<T extends Variacao>({
  filhos,
  minimo,
  onAjustar,
  onExtrato,
  comLink,
}: {
  filhos: T[];
  minimo: number;
  onAjustar: (p: T, delta: number) => void;
  onExtrato?: (p: T) => void;
  comLink?: boolean; // na ficha: o numero abre a ficha da variacao
}) {
  const ordena = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
  const tamanhos = [...new Set(filhos.map((f) => f.tamanho ?? ""))].sort(ordena);
  const tipos = [...new Set(filhos.map((f) => f.cor ?? ""))].sort(ordena);
  const celula = (t: string, c: string) => filhos.find((f) => (f.tamanho ?? "") === t && (f.cor ?? "") === c);
  const umTipo = tipos.length === 1;

  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase text-[var(--ink)]/70">
            <th className="px-2 py-1 text-left">{umTipo ? "" : "tam \\ tipo"}</th>
            {(umTipo ? tamanhos : tipos).map((h) => (
              <th key={h} className="px-2 py-1 text-center">{h || "-"}</th>
            ))}
            <th className="px-2 py-1 text-right text-[var(--ink)]/60">total</th>
          </tr>
        </thead>
        <tbody>
          {(umTipo ? [tipos[0]] : tamanhos).map((linha) => {
            const colunas = umTipo ? tamanhos : tipos;
            const itens = colunas.map((col) => (umTipo ? celula(col, linha) : celula(linha, col)));
            const total = itens.reduce((s, f) => s + (f?.qtd_atual ?? 0), 0);
            return (
              <tr key={linha} className="border-t border-[var(--purple)]/8">
                <td className="whitespace-nowrap px-2 py-1 font-bold text-[var(--purple-dark)]">{umTipo ? (linha || "tamanhos") : `tam ${linha || "-"}`}</td>
                {itens.map((f, i) => (
                  <td key={i} className="px-1 py-1 text-center">
                    {f ? (
                      <div
                        className={`inline-flex items-center gap-0.5 rounded-lg px-1 py-0.5 ${
                          f.qtd_atual === 0 ? "bg-red-100 text-red-700" : f.qtd_atual <= minimo ? "bg-[var(--sun)]/50 text-[var(--ink)]" : "bg-white text-[var(--ink)]"
                        }`}
                      >
                        <button onClick={() => onAjustar(f, -1)} aria-label="menos um" className="h-8 w-8 rounded-md text-base text-[var(--purple)] hover:bg-[var(--purple)]/10">−</button>
                        {comLink ? (
                          <Link href={`/admin/estoque/${f.id}`} title="abrir a ficha desta variação" className="num min-w-[1.6rem] text-center text-sm font-extrabold hover:underline">{f.qtd_atual}</Link>
                        ) : (
                          <button onClick={() => onExtrato?.(f)} title="extrato desta variação" className="num min-w-[1.6rem] text-center text-sm font-extrabold hover:underline">{f.qtd_atual}</button>
                        )}
                        <button onClick={() => onAjustar(f, 1)} aria-label="mais um" className="h-8 w-8 rounded-md text-base text-[var(--purple)] hover:bg-[var(--purple)]/10">+</button>
                      </div>
                    ) : (
                      <span className="text-[var(--ink)]/20">·</span>
                    )}
                  </td>
                ))}
                <td className="num px-2 py-1 text-right font-bold text-[var(--ink)]/60">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 text-[11px] text-[var(--ink)]/70">
        {comLink ? "clique no número pra abrir a ficha da variação (peso, medidas, códigos)." : "clique no número pra ver o extrato da variação; a ficha de cada uma abre pela ficha do produto."}
      </div>
    </div>
  );
}

