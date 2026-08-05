"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/*
  Menu agrupado por area, no padrao de ERP. Compras fica em Suprimentos porque
  o que ela faz primeiro e entrar mercadoria no estoque (o caixa e consequencia);
  Precificacao fica em Comercial porque define preco, nao movimenta dinheiro.
*/
export const GRUPOS = [
  {
    nome: "Suprimentos",
    itens: [
      { href: "/admin/estoque", label: "Estoque", emoji: "📦" },
      { href: "/admin/compras", label: "Compras", emoji: "🛍️" },
      { href: "/admin/fornecedores", label: "Fornecedores", emoji: "🏭" },
    ],
  },
  {
    nome: "Comercial",
    itens: [
      { href: "/admin/vendas", label: "Vendas", emoji: "🧾" },
      { href: "/admin/simulador", label: "Precificação", emoji: "🧮" },
      { href: "/admin/canais", label: "Canais", emoji: "🏬" },
    ],
  },
  {
    nome: "Financeiro",
    itens: [
      { href: "/admin/financeiro", label: "Caixa", emoji: "💰" },
      { href: "/admin/conciliacao", label: "Conciliação", emoji: "🔎" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState<string | null>(null);

  const grupoAtivo = (g: (typeof GRUPOS)[number]) =>
    g.itens.some((i) => pathname.startsWith(i.href));

  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden">
      <Link
        href="/admin"
        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
          pathname === "/admin"
            ? "bg-[var(--purple)]/10 text-[var(--purple-dark)]"
            : "text-[var(--ink)]/70 hover:bg-[var(--purple)]/8"
        }`}
      >
        Painel
      </Link>

      {GRUPOS.map((g) => (
        <div key={g.nome} className="relative shrink-0">
          <button
            onClick={() => setAberto(aberto === g.nome ? null : g.nome)}
            onBlur={() => setTimeout(() => setAberto((a) => (a === g.nome ? null : a)), 150)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
              grupoAtivo(g)
                ? "bg-[var(--purple)]/10 text-[var(--purple-dark)]"
                : "text-[var(--ink)]/70 hover:bg-[var(--purple)]/8"
            }`}
          >
            {g.nome}
            <span className={`text-[9px] transition-transform ${aberto === g.nome ? "rotate-180" : ""}`}>▾</span>
          </button>

          {aberto === g.nome && (
            <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--purple)]/15 bg-white shadow-lg">
              {g.itens.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setAberto(null)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    pathname.startsWith(i.href)
                      ? "bg-[var(--purple)]/8 text-[var(--purple-dark)]"
                      : "text-[var(--ink)]/75 hover:bg-[var(--purple)]/6"
                  }`}
                >
                  <span>{i.emoji}</span>
                  {i.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
