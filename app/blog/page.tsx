import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { POSTS, formatarData, type Post } from "@/lib/posts";
import { POSTS_ENXOVAL } from "@/lib/posts-enxoval";

export const metadata: Metadata = {
  title: "Dicas de roupa infantil: tamanhos, enxoval e cuidados",
  description:
    "Guia de tamanhos de roupa infantil, quantas peças a criança realmente precisa e como fazer a roupa durar mais. Conteúdo prático, sem enrolação.",
  alternates: { canonical: "/blog" },
};

/*
  Os guias de enxoval abrem o blog num bloco proprio, na ordem do gerador
  (o pilar primeiro, depois RN, o que nao comprar e os meses), com o link para
  a planilha. E o assunto que o site quer ranquear; misturado por data com o
  resto, ficava diluido.
*/
function Cartao({ p }: { p: Post }) {
  return (
    <Link
      href={`/blog/${p.slug}`}
      className="group flex items-start gap-4 rounded-3xl border-2 border-transparent bg-white p-5 shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-all hover:-translate-y-1 hover:border-[var(--purple)]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--purple)]/8 text-2xl">
        {p.emoji}
      </span>
      <div className="flex-1">
        <h3 className="font-[family-name:var(--font-baloo)] text-lg font-bold leading-snug text-[var(--purple-dark)]">
          {p.titulo}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]/70">{p.resumo}</p>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)]/65">
          {formatarData(p.data)} · {p.leitura} de leitura
        </div>
      </div>
      <span className="mt-1 text-[var(--purple)] transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

export default function BlogPage() {
  const deEnxoval = new Set(POSTS_ENXOVAL.map((p) => p.slug));
  const outros = POSTS.filter((p) => !deEnxoval.has(p.slug)).sort((a, b) => b.data.localeCompare(a.data));
  const titulo = "font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]";

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

        <section className="mt-10">
          <h2 className={titulo}>Enxoval do bebê</h2>
          <p className="mt-1 max-w-lg text-[15px] leading-relaxed text-[var(--ink)]/70">
            Quantas peças comprar de cada tamanho e em que estação o bebê vai usar cada uma, pelo mês do parto. Para a
            conta do seu mês, região e rotina de lavagem, veja a{" "}
            <Link href="/enxoval" className="font-bold text-[var(--purple)] underline">
              planilha de enxoval de bebê
            </Link>
            .
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {POSTS_ENXOVAL.map((p) => (
              <Cartao key={p.slug} p={p} />
            ))}
          </div>
        </section>

        {outros.length > 0 && (
          <section className="mt-12">
            <h2 className={titulo}>Mais do blog</h2>
            <div className="mt-5 flex flex-col gap-3">
              {outros.map((p) => (
                <Cartao key={p.slug} p={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
