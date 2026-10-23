import { POSTS } from "@/lib/posts";
import { SITE, organizacao } from "@/lib/seo";
import { ENXOVAL_NO_AR } from "@/lib/ofertas/checkout";

/*
  /llms.txt: o site em texto simples para assistentes de IA (proposta llmstxt.org).
  So entram paginas publicas e indexaveis. A pagina de vendas do enxoval aparece
  quando o checkout estiver no ar, igual ao sitemap.
*/
export const dynamic = "force-static";

export function GET() {
  const linhas = [
    "# Império Bem Kids",
    "",
    `> ${organizacao.description} Loja de São Paulo, com venda pela Shopee, Mercado Livre, Kwai e WhatsApp.`,
    "",
    "## Guias do blog",
    ...POSTS.map((p) => `- [${p.titulo}](${SITE}/blog/${p.slug}): ${p.resumo}`),
    "",
    "## Ferramentas",
    `- [Calculadora de Moedas do TikTok em Reais](${SITE}/calculadora-moedas-tiktok): quanto valem os presentes da live em reais e quanto fica para o criador.`,
    ...(ENXOVAL_NO_AR
      ? [
          "",
          "## Produtos digitais",
          `- [Enxoval na Medida](${SITE}/enxoval): planilha e guia que montam a lista de enxoval do bebê pelo mês do parto, com a quantidade de cada tamanho do RN ao GG.`,
        ]
      : []),
    "",
    "## Loja",
    `- [Kits de roupa infantil](${SITE}/pedido): kits de verão e inverno para menino e menina, por tamanho.`,
    `- [Sobre a Império Bem Kids](${SITE}/sobre)`,
  ];
  return new Response(linhas.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
