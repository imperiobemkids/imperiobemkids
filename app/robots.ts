import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imperiobemkids.vercel.app";

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
