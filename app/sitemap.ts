import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/posts";
import { listarProdutosPublicos } from "@/lib/produtosPublicos";
import { SITE } from "@/lib/seo";

/*
  Sitemap das paginas publicas. O /admin e o /portal ficam de fora
  de proposito: sao area interna e estao marcados como noindex.
*/
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicados = await listarProdutosPublicos();
  const paginas = [
    { url: "", priority: 1 },
    { url: "/pedido", priority: 0.9 },
    // vitrine vazia nao vai pro Google: so entra quando houver produto publicado
    ...(publicados.length ? [{ url: "/produtos", priority: 0.9 }] : []),
    { url: "/sobre", priority: 0.7 },
    { url: "/blog", priority: 0.8 },
    { url: "/trocas", priority: 0.4 },
    { url: "/privacidade", priority: 0.3 },
  ].map((p) => ({
    url: `${SITE}${p.url}`,
    lastModified: new Date(),
    priority: p.priority,
  }));

  const posts = POSTS.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: new Date(p.data + "T12:00:00"),
    priority: 0.6,
  }));

  const produtos = publicados.map((p) => ({
    url: `${SITE}/produto/${p.slug}`,
    lastModified: new Date(),
    priority: 0.8,
  }));

  return [...paginas, ...produtos, ...posts];
}
