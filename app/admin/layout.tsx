import type { Metadata } from "next";
import { AuthGuard } from "./AuthGuard";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <AdminNav />
      {/* o conteudo desvia da lateral fixa a partir de lg */}
      <div className="lg:pl-60">
        <main className="pagina mx-auto max-w-6xl px-5 py-6 pb-12">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}
