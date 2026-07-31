import Link from "next/link";
import type { Metadata } from "next";
import { AuthGuard } from "./AuthGuard";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/estoque", label: "Estoque" },
  { href: "/admin/compras", label: "Compras" },
  { href: "/admin/fornecedores", label: "Fornecedores" },
  { href: "/admin/vendas", label: "Vendas" },
  { href: "/admin/financeiro", label: "Financeiro" },
  { href: "/admin/simulador", label: "Precificação" },
  { href: "/admin/canais", label: "Canais" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--purple)]/12 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <Link
            href="/admin"
            className="shrink-0 font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]"
          >
            Império <span className="text-[var(--purple)]">Admin</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--ink)]/70 transition-colors hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
