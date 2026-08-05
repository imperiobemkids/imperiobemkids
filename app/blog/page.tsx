import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { POSTS, formatarData } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Dicas de roupa infantil: tamanhos, enxoval e cuidados",
  description:
    "Guia de tamanhos de roupa infantil, quantas peças a criança realmente precisa e como fazer a roupa durar mais. Conteúdo prático, sem enrolação.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  const posts = [...POSTS].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">
          Blog
        </h1>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--ink)]/70">
          Conteúdo sem enrolação para ajudar na hora de vestir e cuidar dos
          pequenos. 💜
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex items-start gap-4 rounded-3xl border-2 border-transparent bg-white p-5 shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-all hover:-translate-y-1 hover:border-[var(--purple)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--purple)]/8 text-2xl">
                {p.emoji}
              </span>
              <div className="flex-1">
                <h2 className="font-[family-name:var(--font-baloo)] text-lg font-bold leading-snug text-[var(--purple-dark)]">
                  {p.titulo}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]/70">{p.resumo}</p>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)]/40">
                  {formatarData(p.data)} · {p.leitura} de leitura
                </div>
              </div>
              <span className="mt-1 text-[var(--purple)] transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
