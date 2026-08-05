import Link from "next/link";
import type { Metadata } from "next";
import { AuthGuard } from "./AuthGuard";
import { LogoutButton } from "./LogoutButton";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--purple)]/12 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <Link
            href="/admin"
            className="shrink-0 font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]"
          >
            Império <span className="text-[var(--purple)]">Admin</span>
          </Link>
          <AdminNav />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
