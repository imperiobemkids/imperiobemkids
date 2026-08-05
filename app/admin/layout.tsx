import type { Metadata } from "next";
import { AuthGuard } from "./AuthGuard";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      <AdminNav />
      {/* o conteudo desvia da lateral fixa a partir de lg */}
      <div className="lg:pl-60">
        <main className="mx-auto max-w-5xl px-5 py-6">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}
