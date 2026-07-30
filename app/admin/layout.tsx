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
  { href: "/admin/fornecedores", label: "Fornecedores" },
  { href: "/admin/vendas", label: "Vendas" },
  { href: "/admin/financeiro", label: "Financeiro" },
  { href: "/admin/simulador", label: "Simulador" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--purple)]/12 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Link
            href="/admin"
            className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]"
          >
            Império <span className="text-[var(--purple)]">Admin</span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--ink)]/70 transition-colors hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
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
