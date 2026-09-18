import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { CardProduto } from "../produto/CardProduto";
import { jsonLdScript, migalhas } from "@/lib/seo";
import { listarProdutosPublicos } from "@/lib/produtosPublicos";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Roupa infantil com pronta entrega: kits de verão e inverno",
  description:
    "Kits de roupa infantil para menino e menina, com 4 peças, pronta entrega e preço que cabe no bolso. Compre pela Shopee ou peça pelo WhatsApp.",
  alternates: { canonical: "/produtos" },
};

/*
  Vitrine do site com todos os produtos publicados na ficha do ERP. Diferente
  do /pedido (link in bio, que aponta para a Shopee), aqui cada card abre a
  pagina propria do produto, que e o que o Google indexa.
*/
export default async function ProdutosPage() {
  const lista = await listarProdutosPublicos();
  const emEstoque = lista.filter((p) => p.em_estoque);
  const esgotados = lista.filter((p) => !p.em_estoque);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold tracking-tight text-[var(--purple-dark)]">
          Roupa infantil com pronta entrega
        </h1>
        <p className="mt-1 max-w-xl text-[15px] text-[var(--ink)]/70">
          Kits escolhidos peça por peça, pra menino e menina. Tudo que está aqui está em estoque e sai no mesmo dia útil.
        </p>

        {lista.length === 0 && (
          <div className="mt-10 rounded-3xl border-2 border-dashed border-[var(--purple)]/25 bg-white/60 p-8 text-center">
            <p className="text-[var(--ink)]/70">Estamos organizando a vitrine. Enquanto isso, os kits estão na nossa lojinha da Shopee.</p>
            <Link href="/pedido" className="mt-3 inline-block font-bold text-[var(--purple)] underline">ver os achadinhos</Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {emEstoque.map((p) => (
            <CardProduto key={p.id} p={p} />
          ))}
        </div>

        {esgotados.length > 0 && (
          <>
            <h2 className="mt-10 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--ink)]/60">Esgotados (voltam em breve)</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 opacity-70 sm:grid-cols-3 lg:grid-cols-4">
              {esgotados.map((p) => (
                <CardProduto key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(migalhas([{ nome: "Home", url: "/" }, { nome: "Produtos", url: "/produtos" }]))} />
    </>
  );
}
