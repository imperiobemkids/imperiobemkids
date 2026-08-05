/*
  Dados estruturados (JSON-LD) para busca e para IAs.
  Padrao recomendado pela doc do Next: renderizar como <script> na page/layout,
  escapando "<" para evitar injecao (ver 01-app/02-guides/json-ld.md).
*/

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imperiobemkids.vercel.app";

export const jsonLdScript = (dados: object) => ({
  __html: JSON.stringify(dados).replace(/</g, "\\u003c"),
});

export const organizacao = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Império Bem Kids",
  description:
    "Loja de moda infantil com curadoria: kits de roupa para menino e menina com preço que cabe no bolso.",
  url: SITE,
  logo: `${SITE}/logo.png`,
  image: `${SITE}/logo.png`,
  telephone: "+5511947956479",
  areaServed: "BR",
  sameAs: [
    "https://www.instagram.com/imperiobemkids/",
    "https://www.tiktok.com/@imperiobemkids",
  ],
};

/** Lista de produtos da vitrine. ItemList e o formato correto para pagina de listagem. */
export const listaDeProdutos = (
  produtos: { nome: string; preco: string; href: string | null; image: string | null }[],
) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Kits de roupa infantil",
  itemListElement: produtos
    .filter((p) => p.href)
    .map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.nome,
        image: p.image ? `${SITE}${p.image}` : undefined,
        brand: { "@type": "Brand", name: "Império Bem Kids" },
        offers: {
          "@type": "Offer",
          price: p.preco.replace(/[^0-9,]/g, "").replace(",", "."),
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
          url: p.href,
        },
      },
    })),
});

export const artigo = (p: {
  titulo: string;
  resumo: string;
  data: string;
  slug: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: p.titulo,
  description: p.resumo,
  datePublished: p.data,
  dateModified: p.data,
  author: { "@type": "Organization", name: "Império Bem Kids", url: SITE },
  publisher: {
    "@type": "Organization",
    name: "Império Bem Kids",
    logo: { "@type": "ImageObject", url: `${SITE}/logo.png` },
  },
  mainEntityOfPage: `${SITE}/blog/${p.slug}`,
});

export const migalhas = (itens: { nome: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: itens.map((i, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    name: i.nome,
    item: `${SITE}${i.url}`,
  })),
});

export const perguntas = (faq: { pergunta: string; resposta: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.pergunta,
    acceptedAnswer: { "@type": "Answer", text: f.resposta },
  })),
});

/*
  Perguntas reais que chegam no atendimento. Só entram aqui respostas que a
  gente consegue sustentar; prazo de entrega e troca ficam de fora até termos
  a política definida.
*/
export const FAQ = [
  {
    pergunta: "Como faço meu pedido?",
    resposta:
      "Você pode comprar direto na nossa loja na Shopee ou chamar a gente no WhatsApp, que montamos o pedido junto com você.",
  },
  {
    pergunta: "Quantas peças vêm no kit?",
    resposta:
      "Nossos kits de verão vêm com 4 peças, o que dá dois conjuntos completos de camiseta e shorts.",
  },
  {
    pergunta: "Tem para menino e para menina?",
    resposta:
      "Sim. Temos kit de verão para menino e para menina, com estampas sortidas em cada um.",
  },
  {
    pergunta: "Como saber qual tamanho comprar?",
    resposta:
      "O mais seguro é medir a altura da criança e comparar com a tabela de tamanhos. Se ficar entre dois tamanhos, escolha o maior. Também temos um guia completo no blog e ajudamos pelo WhatsApp.",
  },
];
