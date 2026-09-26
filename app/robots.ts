import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // area interna dos socios fica fora da busca
      disallow: ["/admin", "/portal"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
