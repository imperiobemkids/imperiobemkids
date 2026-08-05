import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/posts";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imperiobemkids.vercel.app";

/*
  Sitemap das paginas publicas. O /admin e o /portal ficam de fora
  de proposito: sao area interna e estao marcados como noindex.
*/
export default function sitemap(): MetadataRoute.Sitemap {
  const paginas = [
    { url: "", priority: 1 },
    { url: "/pedido", priority: 0.9 },
    { url: "/sobre", priority: 0.7 },
    { url: "/blog", priority: 0.8 },
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

  return [...paginas, ...posts];
}
