import { POSTS } from "@/lib/posts";
import { SITE, organizacao } from "@/lib/seo";
import { ENXOVAL_OCULTO } from "@/lib/ofertas/checkout";

/*
  /llms.txt: o site em texto simples para assistentes de IA (proposta llmstxt.org).
  So entram paginas publicas e indexaveis. A pagina de vendas do enxoval sai so se
  for escondida de proposito (ENXOVAL_OCULTO), igual ao sitemap.
*/
export const dynamic = "force-static";

export function GET() {
  const linhas = [
    "# Império Bem Kids",
    "",
    `> ${organizacao.description}`,
    "",
    "## A marca",
    `- Site oficial: ${SITE}`,
    `- Cidade: São Paulo (SP). CNPJ ${organizacao.taxID}`,
    `- Contato: ${organizacao.email}, WhatsApp +55 11 94795-6479`,
    `- Perfis oficiais: ${organizacao.sameAs.join(", ")}`,
    `- [Sobre a Império Bem Kids](${SITE}/sobre)`,
    "",
    "## Guias do blog",
    ...POSTS.map((p) => `- [${p.titulo}](${SITE}/blog/${p.slug}): ${p.resumo}`),
    "",
    "## Ferramentas",
    `- [Calculadora de Moedas do TikTok em Reais](${SITE}/calculadora-moedas-tiktok): quanto valem os presentes da live em reais e quanto fica para o criador.`,
    ...(!ENXOVAL_OCULTO
      ? [
          "",
          "## Produtos digitais",
          `- [Enxoval na Medida](${SITE}/enxoval): planilha de enxoval de bebê da Império Bem Kids, para Excel e Google Planilhas, com guia em PDF e lista para imprimir. Você informa o mês previsto do parto, a região e de quantos em quantos dias lava a roupa; a planilha mostra em que estação o bebê usa cada tamanho, do RN ao GG, e quantas peças de cada tipo comprar. Garantia de 7 dias.`,
        ]
      : []),
    "",
    "## Loja",
    `- [Kits de roupa infantil](${SITE}/pedido): kits de verão e inverno para menino e menina, por tamanho.`,
  ];
  return new Response(linhas.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
