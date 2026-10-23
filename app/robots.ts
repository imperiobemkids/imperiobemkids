import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // area interna dos socios fica fora da busca, e o caminho da compra tambem
      disallow: ["/admin", "/portal", "/comprar", "/obrigado", "/api"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
