"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { LogoutButton } from "./LogoutButton";

/*
  Menu lateral agrupado por area. Compras fica em Suprimentos porque o que ela faz
  primeiro e entrar mercadoria no estoque (o caixa e consequencia); Precificacao
  fica em Comercial porque define preco, nao movimenta dinheiro.
*/
export const GRUPOS = [
  {
    nome: "Suprimentos",
    emoji: "📦",
    itens: [
      { href: "/admin/estoque", label: "Estoque", emoji: "📦" },
      { href: "/admin/compras", label: "Compras", emoji: "🛍️" },
      { href: "/admin/fornecedores", label: "Fornecedores", emoji: "🏭" },
    ],
  },
  {
    nome: "Comercial",
    emoji: "🧾",
    itens: [
      { href: "/admin/vendas", label: "Vendas", emoji: "🧾" },
      { href: "/admin/simulador", label: "Precificação", emoji: "🧮" },
      { href: "/admin/canais", label: "Canais", emoji: "🏬" },
    ],
  },
  {
    nome: "Financeiro",
    emoji: "💰",
    itens: [
      { href: "/admin/financeiro", label: "Caixa", emoji: "💰" },
      { href: "/admin/conciliacao", label: "Conciliação", emoji: "🔎" },
    ],
  },
];

function Conteudo({ aoNavegar }: { aoNavegar?: () => void }) {
  const pathname = usePathname();
  const grupoDoCaminho = GRUPOS.find((g) => g.itens.some((i) => pathname.startsWith(i.href)));
  // tudo aberto por padrao: o menu e curto e ver as opcoes ajuda mais do que esconder
  const [abertos, setAbertos] = useState<string[]>(GRUPOS.map((g) => g.nome));

  useEffect(() => {
    if (grupoDoCaminho) setAbertos((a) => (a.includes(grupoDoCaminho.nome) ? a : [...a, grupoDoCaminho.nome]));
  }, [grupoDoCaminho]);

  const alternar = (nome: string) =>
    setAbertos((a) => (a.includes(nome) ? a.filter((n) => n !== nome) : [...a, nome]));

  const itemCls = (ativo: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      ativo
        ? "bg-[var(--purple)] text-white shadow-[0_3px_0_rgba(76,29,128,0.35)]"
        : "text-[var(--ink)]/75 hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
    }`;

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/admin"
        onClick={aoNavegar}
        className="flex items-center gap-2.5 border-b border-[var(--purple)]/10 px-4 py-4"
      >
        <Image src="/logo.png" alt="Império Bem Kids" width={34} height={34} />
        <span className="font-[family-name:var(--font-baloo)] text-base font-extrabold leading-tight text-[var(--purple-dark)]">
          Império <span className="text-[var(--purple)]">Admin</span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <Link href="/admin" onClick={aoNavegar} className={itemCls(pathname === "/admin")}>
          <span className="text-base">🏠</span> Painel
        </Link>

        <div className="mt-3 flex flex-col gap-1">
          {GRUPOS.map((g) => {
            const aberto = abertos.includes(g.nome);
            const temAtivo = g.itens.some((i) => pathname.startsWith(i.href));
            return (
              <div key={g.nome}>
                <button
                  onClick={() => alternar(g.nome)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors ${
                    temAtivo
                      ? "bg-[var(--purple)]/8 text-[var(--purple)]"
                      : "text-[var(--ink)]/55 hover:bg-[var(--purple)]/6 hover:text-[var(--purple)]"
                  }`}
                >
                  <span className="text-sm">{g.emoji}</span>
                  <span>{g.nome}</span>
                  <span className={`ml-auto text-[10px] opacity-60 transition-transform ${aberto ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>

                {aberto && (
                  <div className="mt-0.5 ml-4 flex flex-col gap-0.5 border-l-2 border-[var(--purple)]/12 pl-2">
                    {g.itens.map((i) => (
                      <Link key={i.href} href={i.href} onClick={aoNavegar} className={itemCls(pathname.startsWith(i.href))}>
                        <span className="text-base">{i.emoji}</span> {i.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--purple)]/10 p-3">
        <Link
          href="/"
          onClick={aoNavegar}
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink)]/60 hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
        >
          <span className="text-base">🌐</span> Ver o site
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}

export function AdminNav() {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  // fecha o menu do celular ao trocar de pagina
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <>
      {/* lateral fixa no desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[var(--purple)]/12 bg-white lg:block">
        <Conteudo />
      </aside>

      {/* barra do celular */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--purple)]/12 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--purple)]/8 text-lg text-[var(--purple)]"
        >
          ☰
        </button>
        <Link href="/admin" className="font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]">
          Império <span className="text-[var(--purple)]">Admin</span>
        </Link>
      </div>

      {/* gaveta do celular */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-2xl">
            <Conteudo aoNavegar={() => setDrawer(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
