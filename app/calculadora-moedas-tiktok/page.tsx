import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { EMPRESA } from "@/lib/empresa";
import { SITE, jsonLdScript } from "@/lib/seo";
import { brl } from "@/lib/formato";
import { COMISSAO_TIKTOK, VALOR_MOEDA_USD, calcularMoedas, cotacaoDolar } from "@/lib/moedasTiktok";
import { Calculadora } from "./Calculadora";

/*
  Ferramenta gratuita para atrair busca de quem faz ou assiste live no TikTok.
  A pagina e estatica e se refaz a cada 6 horas, junto com a cotacao do dolar.
*/
export const revalidate = 21600;

const TITULO = "Calculadora de Moedas do TikTok em Reais";
const DESCRICAO =
  "Descubra quanto valem as moedas dos presentes do TikTok em reais e em dólar, com a cotação do dia, e quanto fica para o criador depois da parte do TikTok.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: "/calculadora-moedas-tiktok" },
  // a imagem de compartilhamento sai do opengraph-image.tsx desta pasta
  openGraph: {
    title: TITULO,
    description: "Quanto valem os presentes da live em reais e quanto fica para o criador.",
    url: "/calculadora-moedas-tiktok",
    type: "website",
    siteName: "Império Bem Kids",
    locale: "pt_BR",
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRICAO },
};

// tabela fixa no HTML: da numero pronto para a busca e para as IAs citarem
const TABELA = [100, 500, 1000, 5000, 10000, 50000];

const usd = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);

export default async function CalculadoraMoedasPage() {
  const cotacao = await cotacaoDolar();
  const moedaEmReais = cotacao ? brl(VALOR_MOEDA_USD * cotacao.valor) : null;

  const perguntas = [
    {
      p: "O que esta calculadora faz?",
      r: "Converte as moedas dos presentes do TikTok em reais e em dólar e mostra quanto sobra para o criador depois da parte que fica com o TikTok.",
    },
    {
      p: "Quanto vale 1 moeda do TikTok em reais?",
      r: `A referência mais usada é US$ ${String(VALOR_MOEDA_USD).replace(".", ",")} por moeda, a média dos pacotes vendidos.${moedaEmReais ? ` Com o dólar de hoje, dá cerca de ${moedaEmReais} por moeda.` : ""} No Brasil, o pacote costuma sair entre R$ 0,05 e R$ 0,10 por moeda, conforme o tamanho do pacote e se a compra é feita pelo app ou pelo site.`,
    },
    {
      p: "Quanto o TikTok fica dos presentes?",
      r: `Cerca de metade. O valor do presente vira diamantes para o criador, e o TikTok fica com aproximadamente ${COMISSAO_TIKTOK * 100}% como taxa da plataforma.`,
    },
    {
      p: "Como a conta é feita?",
      r: "Valor dos presentes = moedas × valor da moeda. O criador recebe esse valor menos a parte do TikTok. Para chegar em reais, a calculadora multiplica pelo dólar comercial do dia.",
    },
    {
      p: "Por que o valor real pode ser diferente?",
      r: "O TikTok não publica uma tabela oficial. O preço das moedas muda por país, loja de aplicativo e promoção, o saque pode ter taxas e impostos, e a cotação do dia do saque é outra. Use o resultado como estimativa.",
    },
    {
      p: "De onde vem a cotação do dólar?",
      r: "É o dólar comercial, atualizado a cada 6 horas. Se quiser simular outro valor, é só trocar o campo Dólar na calculadora.",
    },
  ];

  const linhasTabela = TABELA.map((q) => {
    const r = calcularMoedas(q, VALOR_MOEDA_USD, COMISSAO_TIKTOK);
    return {
      moedas: q.toLocaleString("pt-BR"),
      valor: cotacao ? brl(r.total * cotacao.valor) : usd(r.total),
      criador: cotacao ? brl(r.criador * cotacao.valor) : usd(r.criador),
      valorUsd: usd(r.total),
      criadorUsd: usd(r.criador),
    };
  });

  const dados = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: TITULO,
      description: DESCRICAO,
      url: `${SITE}/calculadora-moedas-tiktok`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      isAccessibleForFree: true,
      // a pagina se refaz a cada 6 horas com a cotacao nova; a data mostra isso sem texto na tela
      dateModified: new Date().toISOString(),
      offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
      publisher: { "@type": "Organization", name: "Império Bem Kids", url: SITE },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: TITULO, item: `${SITE}/calculadora-moedas-tiktok` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: perguntas.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
    },
  ];

  return (
    <>
      <SiteHeader />
      {dados.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(d)} />
      ))}

      <main className="flex-1">
        <section className="relative overflow-hidden px-6 pb-8 pt-12 text-center">
          <div className="pointer-events-none absolute -left-16 top-6 h-52 w-52 rounded-full bg-[var(--pink)]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-20 h-52 w-52 rounded-full bg-[var(--mint)]/30 blur-3xl" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-xs font-extrabold text-[var(--purple-dark)]">
              Ferramenta grátis
            </span>
            <h1 className="mt-3 font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)] sm:text-4xl">
              Calculadora de Moedas do TikTok em Reais
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-[16px] leading-relaxed text-[var(--ink)]/75">
              Quanto valem os presentes da sua live em reais e em dólar, e quanto fica com você
              depois da parte do TikTok.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6">
          <Calculadora cotacao={cotacao?.valor ?? null} />
        </section>

        <section className="mx-auto mt-10 max-w-2xl px-6">
          <h2 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Tabela de moedas do TikTok em reais
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/75">
            Os valores mais procurados, com o dólar do dia. Para outro número de moedas, use a calculadora acima.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_3px_0_rgba(109,40,184,0.08)]">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-[var(--purple)]/8 text-xs uppercase tracking-wide text-[var(--purple-dark)]">
                <tr>
                  <th scope="col" className="px-4 py-3">Moedas</th>
                  <th scope="col" className="px-4 py-3">Valor dos presentes</th>
                  <th scope="col" className="px-4 py-3">O criador recebe</th>
                </tr>
              </thead>
              <tbody>
                {linhasTabela.map((l) => (
                  <tr key={l.moedas} className="border-t border-[var(--purple)]/10">
                    <th scope="row" className="px-4 py-3 font-extrabold text-[var(--purple-dark)]">{l.moedas}</th>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[var(--ink)]">{l.valor}</div>
                      {cotacao && <div className="text-xs text-[var(--ink)]/55">{l.valorUsd}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[var(--purple)]">{l.criador}</div>
                      {cotacao && <div className="text-xs text-[var(--ink)]/55">{l.criadorUsd}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-2xl px-6">
          <h2 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Perguntas frequentes
          </h2>
          <div className="mt-4 space-y-3">
            {perguntas.map((q) => (
              <details key={q.p} className="group rounded-2xl bg-white p-4 shadow-[0_3px_0_rgba(109,40,184,0.08)]">
                <summary className="cursor-pointer list-none font-bold text-[var(--purple-dark)]">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                  {q.p}
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/75">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto my-10 max-w-2xl px-6">
          <div className="rounded-3xl bg-white p-6 text-center shadow-[0_4px_0_rgba(109,40,184,0.1)]">
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              A gente também faz live no TikTok 💜
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[var(--ink)]/75">
              O Império Bem Kids mostra roupinha infantil e achadinhos ao vivo. Passa lá para dar um oi.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <a
                href={EMPRESA.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white transition-transform active:scale-[0.97]"
              >
                Seguir @imperiobemkids
              </a>
              <Link
                href="/pedido"
                className="rounded-full bg-[var(--purple)]/10 px-5 py-2.5 text-sm font-extrabold text-[var(--purple)] transition-transform active:scale-[0.97]"
              >
                Ver os achadinhos
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
