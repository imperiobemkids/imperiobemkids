import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../SiteHeader";
import { SiteFooter } from "../../SiteFooter";
import { POSTS, getPost, formatarData, type Bloco } from "@/lib/posts";
import { jsonLdScript, artigo, migalhas } from "@/lib/seo";

// gera as rotas dos posts no build
export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

// no Next 16 params e uma Promise e precisa de await
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post não encontrado" };
  return {
    title: post.titulo,
    description: post.resumo,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.titulo,
      description: post.resumo,
      type: "article",
      publishedTime: post.data,
    },
  };
}

function RenderBloco({ bloco }: { bloco: Bloco }) {
  switch (bloco.tipo) {
    case "h2":
      return (
        <h2 className="mt-8 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
          {bloco.texto}
        </h2>
      );
    case "p":
      return <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink)]/80">{bloco.texto}</p>;
    case "lista":
      return (
        <ul className="mt-3 space-y-2">
          {bloco.itens.map((i) => (
            <li key={i} className="flex gap-2 text-[16px] leading-relaxed text-[var(--ink)]/80">
              <span className="mt-1 text-[var(--purple)]">•</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      );
    case "destaque":
      return (
        <blockquote className="mt-5 rounded-2xl border-l-4 border-[var(--purple)] bg-[var(--purple)]/6 p-4 text-[16px] font-semibold leading-relaxed text-[var(--purple-dark)]">
          {bloco.texto}
        </blockquote>
      );
    case "tabela":
      return (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <table className="w-full min-w-[380px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/45">
                {bloco.cabecalho.map((c) => (
                  <th key={c} className="p-3">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((l) => (
                <tr key={l.join()} className="border-b border-[var(--purple)]/6 last:border-0">
                  {l.map((celula, i) => (
                    <td key={celula + i} className={`p-3 ${i === 0 ? "font-bold text-[var(--purple-dark)]" : "text-[var(--ink)]/75"}`}>
                      {celula}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const outros = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link href="/blog" className="text-sm font-bold text-[var(--purple)] hover:underline">
          ← voltar para o blog
        </Link>

        <article className="mt-5">
          <div className="text-4xl">{post.emoji}</div>
          <h1 className="mt-2 font-[family-name:var(--font-baloo)] text-3xl font-extrabold leading-tight text-[var(--purple-dark)]">
            {post.titulo}
          </h1>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink)]/40">
            {formatarData(post.data)} · {post.leitura} de leitura
          </div>

          <div className="mt-6">
            {post.blocos.map((b, i) => (
              <RenderBloco key={i} bloco={b} />
            ))}
          </div>
        </article>

        {/* chamada */}
        <div className="mt-10 rounded-3xl bg-gradient-to-br from-[var(--purple)]/10 to-[var(--mint)]/15 p-6 text-center">
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
            Precisa de ajuda para escolher?
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--ink)]/70">
            A gente confere o tamanho com você antes de fechar o pedido.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/pedido"
              className="rounded-full bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white transition-transform hover:scale-105"
            >
              Ver os achadinhos 🎁
            </Link>
            <a
              href="https://wa.me/5511947956479"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border-2 border-[var(--purple)]/25 px-5 py-2.5 text-sm font-extrabold text-[var(--purple)] hover:border-[var(--purple)]"
            >
              Chamar no WhatsApp 💬
            </a>
          </div>
        </div>

        {/* outros posts */}
        {outros.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Leia também
            </h2>
            <div className="flex flex-col gap-3">
              {outros.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-all hover:-translate-y-0.5"
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <span className="flex-1 text-sm font-bold text-[var(--purple-dark)]">{p.titulo}</span>
                  <span className="text-[var(--purple)] transition-transform group-hover:translate-x-1">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />

      {/* dados estruturados do artigo e da trilha de navegacao */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(artigo(post))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          migalhas([
            { nome: "Início", url: "/" },
            { nome: "Blog", url: "/blog" },
            { nome: post.titulo, url: `/blog/${post.slug}` },
          ]),
        )}
      />
    </>
  );
}
