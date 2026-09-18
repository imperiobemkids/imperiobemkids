import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../SiteHeader";
import { SiteFooter } from "../../SiteFooter";
import { Saida } from "../../Saida";
import { jsonLdScript, migalhas, SITE } from "@/lib/seo";
import { EMPRESA } from "@/lib/empresa";
import { listarProdutosPublicos, produtoPublicoPorSlug, brl, fotoDe, fotoOtimizavel, nomeCurto } from "@/lib/produtosPublicos";
import { CardProduto } from "../CardProduto";

/*
  Pagina de produto no site proprio. Ate aqui o produto so existia na Shopee,
  entao o Google indexava a Shopee. Agora cada produto publicado na ficha vira
  uma pagina com titulo, descricao, especificacoes, tamanhos com estoque,
  JSON-LD de Product e dois caminhos de compra: Shopee e WhatsApp.
  Regera de hora em hora (ISR); publicou na ficha, aparece sozinho.
*/
export const revalidate = 3600;

export async function generateStaticParams() {
  const lista = await listarProdutosPublicos();
  return lista.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await produtoPublicoPorSlug(slug);
  if (!p) return { title: "Produto não encontrado" };
  const desc = (p.descricao ?? "").replace(/\s+/g, " ").slice(0, 155);
  return {
    title: p.titulo,
    description: desc || `${p.titulo} por ${brl(p.preco_venda)}. Pronta entrega, envio pela Shopee ou pedido pelo WhatsApp.`,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { title: p.titulo, description: desc, images: [fotoDe(p)], type: "website" },
  };
}

const rotuloLinha = (l: string | null) => (l === "verao" ? "Verão" : l === "inverno" ? "Inverno" : null);
const rotuloGenero = (g: string | null) => (g === "menino" ? "Menino" : g === "menina" ? "Menina" : g === "unissex" ? "Unissex" : null);

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await produtoPublicoPorSlug(slug);
  if (!p) notFound();

  const todos = await listarProdutosPublicos();
  const relacionados = todos.filter((x) => x.id !== p.id).slice(0, 3);

  const whatsapp =
    `${EMPRESA.whatsappLink}?text=` +
    encodeURIComponent(`Oi! Vi no site o ${nomeCurto(p)}${p.tamanhos.length ? ` (tamanhos ${p.tamanhos.join(", ")})` : ""} e quero fazer um pedido 💜`);

  const specs: { rotulo: string; valor: string }[] = [
    p.pecas_por_kit ? { rotulo: "Peças no kit", valor: String(p.pecas_por_kit) } : null,
    p.tamanhos.length ? { rotulo: "Tamanhos disponíveis", valor: p.tamanhos.join(", ") } : null,
    rotuloGenero(p.genero) ? { rotulo: "Para", valor: rotuloGenero(p.genero)! } : null,
    rotuloLinha(p.linha) ? { rotulo: "Estação", valor: rotuloLinha(p.linha)! } : null,
    p.faixa_etaria ? { rotulo: "Faixa etária", valor: p.faixa_etaria } : null,
    p.material ? { rotulo: "Material", valor: p.material } : null,
    p.composicao ? { rotulo: "Composição", valor: p.composicao } : null,
    p.marca ? { rotulo: "Marca", valor: p.marca } : null,
  ].filter((x): x is { rotulo: string; valor: string } => Boolean(x));

  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.titulo,
    image: fotoDe(p).startsWith("/") ? `${SITE}${fotoDe(p)}` : fotoDe(p),
    description: p.descricao ?? undefined,
    brand: { "@type": "Brand", name: p.marca || EMPRESA.nomeFantasia },
    ...(p.preco_venda
      ? {
          offers: {
            "@type": "Offer",
            price: p.preco_venda.toFixed(2),
            priceCurrency: "BRL",
            availability: p.em_estoque ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${SITE}/produto/${p.slug}`,
            seller: { "@type": "Organization", name: EMPRESA.nomeFantasia },
          },
        }
      : {}),
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <nav className="text-xs text-[var(--ink)]/55" aria-label="migalhas">
          <Link href="/" className="hover:underline">Home</Link> ·{" "}
          <Link href="/produtos" className="hover:underline">Produtos</Link> ·{" "}
          <span className="text-[var(--ink)]/80">{nomeCurto(p)}</span>
        </nav>

        <article className="mt-5 grid gap-8 md:grid-cols-2">
          <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.12)]">
            <Image src={fotoDe(p)} alt={p.titulo} fill priority unoptimized={!fotoOtimizavel(fotoDe(p))} className="object-cover" sizes="(max-width: 768px) 100vw, 480px" />
            {!p.em_estoque && (
              <span className="absolute left-3 top-3 rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-extrabold uppercase text-white">esgotado</span>
            )}
          </div>

          <div>
            <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold leading-tight tracking-tight text-[var(--purple-dark)]">
              {p.titulo}
            </h1>
            {p.preco_venda != null && (
              <p className="num mt-3 font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple)]">
                {brl(p.preco_venda)}
                {p.pecas_por_kit ? <span className="ml-2 text-base font-bold text-[var(--ink)]/55">o kit com {p.pecas_por_kit} peças</span> : null}
              </p>
            )}

            {p.tamanhos.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/45">Tamanhos com pronta entrega</div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.tamanhos.map((t) => (
                    <li key={t} className="rounded-full border-2 border-[var(--purple)]/25 bg-white px-3 py-1 text-sm font-bold text-[var(--purple-dark)]">{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              {p.url_shopee && (
                <Saida
                  href={p.url_shopee}
                  evento="InitiateCheckout"
                  params={{ content_name: p.titulo, content_type: "product", value: p.preco_venda ?? undefined, num_items: 1 }}
                  className="press flex-1 rounded-full bg-[var(--purple)] px-6 py-3 text-center font-[family-name:var(--font-baloo)] text-base font-extrabold text-white shadow-lg shadow-[var(--purple)]/25 hover:bg-[var(--purple-dark)]"
                >
                  Comprar na Shopee 🛒
                </Saida>
              )}
              <Saida
                href={whatsapp}
                evento="Contact"
                params={{ content_name: p.titulo }}
                className={`press flex-1 rounded-full px-6 py-3 text-center font-[family-name:var(--font-baloo)] text-base font-extrabold ${
                  p.url_shopee
                    ? "border-2 border-[var(--purple)]/25 text-[var(--purple)] hover:border-[var(--purple)]"
                    : "bg-[var(--purple)] text-white shadow-lg shadow-[var(--purple)]/25 hover:bg-[var(--purple-dark)]"
                }`}
              >
                Pedir pelo WhatsApp 💬
              </Saida>
            </div>
            <p className="mt-2 text-xs text-[var(--ink)]/55">
              Pela Shopee você tem a garantia da plataforma. Pelo WhatsApp a gente tira dúvida de tamanho antes de fechar.{" "}
              <Link href="/trocas" className="underline">Trocas e devoluções</Link>.
            </p>

            {specs.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-white/70 p-4 text-sm">
                {specs.map((s) => (
                  <div key={s.rotulo}>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/45">{s.rotulo}</dt>
                    <dd className="font-semibold text-[var(--ink)]">{s.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </article>

        {p.descricao && (
          <section className="mt-10 max-w-2xl">
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Sobre o produto</h2>
            <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-[var(--ink)]/80">
              {p.descricao.split(/\n{2,}|\r\n\r\n/).map((par, i) => (
                <p key={i} className="whitespace-pre-line">{par.trim()}</p>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 max-w-2xl rounded-2xl bg-white/70 p-5 text-sm leading-relaxed text-[var(--ink)]/75">
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Na dúvida do tamanho?</h2>
          <p className="mt-1">
            Idade engana: o que manda é a altura. A gente montou uma{" "}
            <Link href="/blog/tabela-de-tamanhos-roupa-infantil" className="font-bold text-[var(--purple)] underline">tabela de tamanhos por altura</Link>{" "}
            pra você acertar de primeira. E se ainda ficar em dúvida, manda a altura da criança no WhatsApp que a gente confere junto.
          </p>
        </section>

        {relacionados.length > 0 && (
          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Você também pode gostar</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relacionados.map((r) => (
                <CardProduto key={r.id} p={r} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          migalhas([
            { nome: "Home", url: "/" },
            { nome: "Produtos", url: "/produtos" },
            { nome: nomeCurto(p), url: `/produto/${p.slug}` },
          ]),
        )}
      />
    </>
  );
}
