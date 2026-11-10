import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarBlank, CheckCircle, Gift, Printer, Ruler, ShieldCheck, Star, Table, XCircle } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { Saida } from "../Saida";
import { EMPRESA } from "@/lib/empresa";
import { ORGANIZACAO_ID, SITE, jsonLdScript, organizacao } from "@/lib/seo";
import { POSTS_ENXOVAL } from "@/lib/posts-enxoval";
import { OFERTA_ENXOVAL as O } from "@/lib/ofertas/enxoval";
import { precoVigente, type PrecoVigente } from "@/lib/ofertas/promocao";
import { ENXOVAL_NO_AR, ENXOVAL_OCULTO, linkDeCompra } from "@/lib/ofertas/checkout";
import { AVALIACOES } from "@/lib/ofertas/enxoval-avaliacoes";

/*
  Pagina de vendas do Enxoval na Medida (planilha + guia), a primeira oferta low ticket da IBK.
  A copy vem de lib/ofertas/enxoval.ts, gerado a partir da oferta; aqui fica so a montagem.
  Com o link da Kiwify configurado, o botao vai para o checkout; sem ele, chama no WhatsApp.
  A pagina so sai do Google com ENXOVAL_OCULTO (lib/ofertas/checkout.ts).

  SEO (plano em lowticket/ofertas/ibk-enxoval/seo/plano-consolidado.md): esta pagina
  disputa "planilha de enxoval de bebe". "Lista de enxoval de bebe" e do post pilar, que
  esta pagina linka; nenhuma ancora com "lista de enxoval" aponta para ca. Titulo e
  descricao nao citam preco nem promo: o Google guarda o trecho por semanas.
*/

const TITULO = "Planilha de enxoval de bebê pelo mês do parto";
const DESCRICAO = `Planilha de enxoval de bebê que monta a lista pelo mês do parto, com a quantidade de cada peça do RN ao GG e o que falta comprar. Garantia de ${O.garantia.dias} dias.`;
// muda so quando o conteudo da pagina mudar de verdade (aparece na pagina e no schema)
const REVISADO_EM = "2026-11-08";

// a frase que as IAs repetem ao descrever ferramentas: o que voce informa, o que ela calcula
const DEFINICAO =
  "O Enxoval na Medida, da Império Bem Kids, é uma planilha de enxoval de bebê para Excel e Google Planilhas, com guia em PDF e lista para imprimir. Você informa o mês previsto do parto, a região e de quantos em quantos dias lava a roupa. A planilha mostra em que estação o bebê usa cada tamanho, do RN ao GG, e quantas peças de cada tipo comprar.";

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const NOME_MES: Record<string, string> = { marco: "março" };
// posts "que nasce em" ja publicados, na ordem do calendario
const POSTS_DE_MES = POSTS_ENXOVAL.filter((p) => p.slug.startsWith("enxoval-para-bebe-que-nasce-em-"))
  .map((p) => ({ slug: p.slug, mes: p.slug.replace("enxoval-para-bebe-que-nasce-em-", "") }))
  .sort((a, b) => MESES.indexOf(a.mes) - MESES.indexOf(b.mes));

// a promo tem dia para acabar: a pagina se refaz a cada 5 minutos para voltar ao preco normal sozinha
export const revalidate = 300;

export function generateMetadata(): Metadata {
  return {
    title: TITULO,
    description: DESCRICAO,
    alternates: { canonical: "/enxoval" },
    // sai do Google so se for escondida de proposito
    robots: ENXOVAL_OCULTO ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${TITULO} | ${O.nomeCurto}`,
      description: "A quantidade certa de cada tamanho, do RN ao GG, para a estação em que o bebê vai usar.",
      url: "/enxoval",
      type: "website",
      siteName: "Império Bem Kids",
      locale: "pt_BR",
      images: ["/enxoval/guia-capa.webp"],
    },
  };
}

const whatsappCompra = (v: PrecoVigente) =>
  `${EMPRESA.whatsappLink}?text=${encodeURIComponent(
    `Oi! Quero o ${O.nomeCurto}, a planilha e o guia do enxoval, por ${v.precoTexto}${v.promo ? ` (${v.promo.nome})` : ""} 💜`,
  )}`;

const titulo = "font-[family-name:var(--font-baloo)] font-extrabold text-[var(--purple-dark)]";
const texto = "text-[16px] leading-relaxed text-[var(--ink)]/80";
const cartao = "rounded-3xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]";

function corEstacao(estacao: string) {
  if (estacao.startsWith("frio")) return "bg-[#ddd6fe] text-[var(--purple-dark)]";
  if (estacao.startsWith("calor")) return "bg-[var(--yellow)] text-[#78350f]";
  return "bg-[var(--mint)]/40 text-[#065f46]";
}

function BotaoComprar({ local, rotulo = O.cta }: { local: string; rotulo?: string }) {
  const v = precoVigente(O);
  const params = { content_name: O.nomeCurto, content_ids: [O.id], value: v.preco, num_items: 1, local };
  const classe =
    "press inline-flex items-center justify-center rounded-full bg-[var(--purple)] px-7 py-3.5 text-base font-extrabold text-white shadow-[0_4px_0_var(--purple-dark)]";
  return ENXOVAL_NO_AR ? (
    <Saida href={linkDeCompra(!!v.promo)} origem evento="InitiateCheckout" params={params} className={classe}>
      {rotulo}
    </Saida>
  ) : (
    <Saida href={whatsappCompra(v)} evento="Contact" params={params} className={classe}>
      {rotulo}
    </Saida>
  );
}

export default function EnxovalPage() {
  const v = precoVigente(O);
  const ex = O.exemplo;
  const tamanhoM = ex.tamanhos.find((t) => t.tamanho === "M");

  const perguntas = [
    {
      p: "Quantas roupas preciso comprar para o enxoval do bebê?",
      r: `Depende do mês do parto e de quantas vezes você lava a roupa. Como referência, um bebê que nasce em ${ex.mes} no ${ex.regiao}, lavando a cada ${ex.dias} dias, precisa de ${ex.totalPecas} peças do RN ao GG, com o G e o GG em quantidade menor, para completar depois. A planilha refaz a conta para o seu mês.`,
    },
    {
      p: "Quantos bodies um recém-nascido precisa?",
      r: "Somando os tamanhos RN e P, de 14 a 16 bodies, conforme o mês do parto e a região, lavando a cada 3 dias. Se são de manga curta ou longa depende da estação em que cada tamanho vai ser usado.",
    },
    {
      p: "Qual a diferença entre a planilha e uma lista de enxoval pronta?",
      r: "A lista pronta dá a mesma quantidade para todo bebê. A planilha liga o mês do parto à estação de cada tamanho, então muda a quantidade e o tipo de peça (manga curta ou longa), considera a região e a sua rotina de lavagem e soma quanto falta gastar.",
    },
    {
      p: "A lista serve para menino e para menina?",
      r: "Serve. A quantidade vem do tipo de peça e do tamanho, não do sexo do bebê. O que muda é a escolha de cor e estampa.",
    },
    {
      p: "Funciona no celular?",
      r: ENXOVAL_NO_AR
        ? "Sim. Depois da compra, a página Minha lista abre no navegador do celular, sem instalar nada: você escolhe o mês do parto, vê as quantidades, anota os valores e imprime ou salva em PDF. O guia também abre direto no celular. A planilha é para Excel ou Google Planilhas, e no celular precisa do app."
        : "Sim. A planilha abre no app do Google Planilhas ou no computador, e também no Excel. O guia é um PDF que abre em qualquer celular.",
    },
    {
      p: "Dá para imprimir a lista?",
      r: "Dá. Vem uma lista para imprimir em A4, com espaço para marcar o que já tem, anotar o valor médio de cada peça e somar quanto vai gastar em cada tamanho. A aba Meu enxoval da planilha também imprime, já com as quantidades do seu mês.",
    },
    {
      p: "Preciso entender de planilha?",
      r: "Não. São só três células amarelas: o mês previsto do parto, a região e de quantos em quantos dias você lava a roupinha. O resto a planilha calcula sozinha.",
    },
    {
      p: "E se o parto adiantar ou atrasar?",
      r: "Use o mês previsto. Se o parto mudar de mês, é só trocar na planilha e a lista se refaz na hora.",
    },
    {
      p: "Já comprei parte do enxoval. Ainda vale?",
      r: "Vale. Você anota o que já tem ou ganhou no chá de bebê e a planilha mostra só o que falta comprar, tamanho por tamanho.",
    },
    {
      p: "Serve para qualquer marca de roupa?",
      r: "As faixas de tamanho são aproximadas e variam entre marcas. O guia ensina a conferir pela altura, que é o que manda, e a tabela do fabricante dá a palavra final.",
    },
    {
      p: "Moro numa cidade mais fria que a média da região. E agora?",
      r: "Escolha a região mais parecida com o seu clima ou ajuste o clima de cada mês na aba Regras. A planilha recalcula tudo.",
    },
    {
      p: "Como eu recebo?",
      r: ENXOVAL_NO_AR
        ? "Assim que o pagamento por Pix ou cartão é aprovado, você cai na página com a Minha lista, o guia, a lista para imprimir, a planilha e os bônus. O acesso também chega no seu e-mail, pela área de membros, para voltar quando quiser."
        : "Pelo WhatsApp: você chama a gente, paga por Pix e recebe a planilha e o guia ali mesmo.",
    },
    {
      p: "E se não for para mim?",
      r: `Você tem ${O.garantia.dias} dias de garantia. ${O.garantia.texto}`,
    },
  ];

  const dados = [
    organizacao,
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `${SITE}/enxoval#produto`,
      name: `${O.nomeCurto}: planilha de enxoval de bebê pelo mês do parto`,
      description: DEFINICAO,
      image: [`${SITE}/enxoval/guia-capa.webp`, `${SITE}/enxoval/planilha-lista.webp`, `${SITE}/enxoval/lista-impressa.webp`],
      sku: O.id,
      brand: { "@type": "Brand", name: "Império Bem Kids" },
      offers: {
        "@type": "Offer",
        price: v.preco.toFixed(2),
        priceCurrency: "BRL",
        ...(v.promo ? { priceValidUntil: `${v.promo.ate}T23:59:59-03:00` } : {}),
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: `${SITE}/enxoval`,
        seller: { "@id": ORGANIZACAO_ID },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "BR",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: O.garantia.dias,
          merchantReturnLink: `${SITE}/trocas`,
        },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: "Planilha de enxoval de bebê", item: `${SITE}/enxoval` },
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
        {/* topo: promessa, preco e botao */}
        <section className="relative overflow-hidden px-6 pb-10 pt-10">
          <div className="pointer-events-none absolute -left-16 top-6 h-52 w-52 rounded-full bg-[var(--pink)]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-24 h-52 w-52 rounded-full bg-[var(--mint)]/30 blur-3xl" />
          <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[1.15fr_1fr]">
            <div className="text-center md:text-left">
              <nav aria-label="Você está em" className="mb-3 text-xs font-semibold text-[var(--ink)]/60">
                <Link href="/" className="hover:underline">Início</Link> <span aria-hidden="true">&rsaquo;</span> Planilha de enxoval de bebê
              </nav>
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                <span className="inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-xs font-extrabold text-[var(--purple-dark)]">
                  Planilha e guia em PDF
                </span>
                {v.promo && (
                  <span className="inline-block rounded-full bg-[var(--purple)] px-3 py-1 text-xs font-extrabold text-white">
                    {v.promo.nome}: {v.precoTexto} até {v.promo.ateCurto}
                  </span>
                )}
              </div>
              <h1 className={`${titulo} mt-3 text-3xl leading-tight sm:text-4xl`}>{O.headline}</h1>
              <p className={`${texto} mx-auto mt-3 max-w-lg md:mx-0`}>{O.subheadline}</p>
              <div className="mt-6 flex flex-col items-center gap-2 md:items-start">
                <BotaoComprar local="topo" />
                <p className="text-sm text-[var(--ink)]/65">
                  {v.de && (
                    <>
                      de <s>{v.de}</s> por{" "}
                    </>
                  )}
                  <b className="text-[var(--purple-dark)]">{v.precoTexto}</b>
                  {v.promo && ` até ${v.promo.ateCurto}`}, pagamento único. Garantia de {O.garantia.dias} dias.
                </p>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm pb-6">
              {/* foto do Unsplash (Kelly Sikkema), creditos em lowticket/ofertas/ibk-enxoval/criativos/fotos/CREDITOS.md */}
              <Image
                src="/enxoval/foto-mae-rn.webp"
                alt="Mãe abraçando o bebê recém-nascido"
                width={900}
                height={1200}
                sizes="(max-width: 768px) 90vw, 384px"
                preload
                className="aspect-[4/5] w-full rounded-3xl object-cover shadow-[0_6px_0_rgba(109,40,184,0.12)]"
              />
              <Image
                src="/enxoval/planilha-lista.webp"
                alt="Planilha de enxoval de bebê: aba Meu enxoval com a quantidade de cada peça do tamanho P"
                width={1592}
                height={800}
                sizes="240px"
                className="absolute -left-4 bottom-0 w-60 rounded-xl border border-[var(--purple)]/10 shadow-[0_6px_0_rgba(109,40,184,0.18)] sm:-left-8"
              />
              <Image
                src="/enxoval/guia-capa.webp"
                alt="Capa do guia Enxoval na Medida"
                width={720}
                height={1020}
                sizes="112px"
                className="absolute -right-3 bottom-2 w-24 rotate-3 rounded-xl shadow-[0_6px_0_rgba(76,29,128,0.25)] sm:w-28"
              />
            </div>
          </div>
        </section>

        {/* resposta direta: o que o Google e as IAs extraem para "quantas roupas comprar" */}
        <section className="mx-auto max-w-2xl px-6">
          <p className={`${cartao} p-5 text-[16px] leading-relaxed text-[var(--ink)]/85`}>
            <b className="text-[var(--purple-dark)]">Quantas roupas comprar no enxoval de bebê?</b> Depende do mês do parto, que
            decide a estação em que o bebê usa cada tamanho, e de quantas vezes você lava a roupa. Um bebê que nasce em {ex.mes} no{" "}
            {ex.regiao}, lavando a cada {ex.dias} dias, precisa de {ex.totalPecas} peças do RN ao GG, sendo {ex.bodiesInicio} bodies
            entre RN e P. A planilha faz essa conta para o seu mês, a sua região e a sua rotina de lavagem.
          </p>
        </section>

        {/* a dor */}
        <section className="mx-auto mt-6 max-w-2xl px-6">
          <Image
            src="/enxoval/foto-dobrando.webp"
            alt="Mãos dobrando roupinhas de bebê"
            width={1200}
            height={800}
            className="mb-6 aspect-[3/2] w-full rounded-3xl object-cover"
          />
          <h2 className={`${titulo} text-2xl`}>Cinco listas de enxoval salvas e nenhuma igual à outra?</h2>
          <p className={`${texto} mt-2`}>A culpa não é sua, é da lista. O caminho de sempre costuma ser este:</p>
          <ul className="mt-4 space-y-2">
            {O.tentativas.map((t) => (
              <li key={t} className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_3px_0_rgba(109,40,184,0.08)]">
                <XCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-[var(--pink)]" />
                <span className="text-[15px] text-[var(--ink)]/85">{t}</span>
              </li>
            ))}
          </ul>
          <p className={`${texto} mt-4`}>{O.mecanismo.porQueORestoFalha}</p>
        </section>

        {/* o mecanismo */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <div className="flex items-center gap-2 text-[var(--purple)]">
            <CalendarBlank size={24} weight="duotone" />
            <span className="text-xs font-extrabold uppercase tracking-wide">O {O.mecanismo.nome}</span>
          </div>
          <h2 className={`${titulo} mt-1 text-2xl`}>Como a planilha monta o enxoval pelo mês do parto</h2>
          <p className={`${texto} mt-2`}>{O.mecanismo.oQueE}</p>
          <div className={`${cartao} mt-5 overflow-hidden`}>
            <div className="bg-[var(--purple)]/8 px-4 py-3 text-sm font-extrabold text-[var(--purple-dark)]">
              Exemplo: bebê que nasce em {ex.mes}, no Sudeste
            </div>
            <table className="w-full text-left text-[15px]">
              <thead className="text-xs uppercase tracking-wide text-[var(--purple-dark)]">
                <tr>
                  <th scope="col" className="px-4 py-2">Tamanho</th>
                  <th scope="col" className="px-4 py-2">Quando usa</th>
                  <th scope="col" className="px-4 py-2">Estação</th>
                </tr>
              </thead>
              <tbody>
                {ex.tamanhos.map((t) => (
                  <tr key={t.tamanho} className="border-t border-[var(--purple)]/10">
                    <th scope="row" className="px-4 py-2.5 font-extrabold text-[var(--purple-dark)]">{t.tamanho}</th>
                    <td className="px-4 py-2.5">{t.periodo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${corEstacao(t.estacao)}`}>{t.estacao}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tamanhoM && (
            <p className="mt-4 rounded-2xl bg-[var(--pink)]/20 px-4 py-3 text-[15px] font-bold text-[var(--purple-dark)]">
              Repare no tamanho M: ele cai de {tamanhoM.periodo}, no frio. A lista genérica mandaria body de manga curta. Para esse
              bebê, o M pede manga longa, calça e macacão.
            </p>
          )}
          <p className={`${texto} mt-4`}>{O.mecanismo.porQueFunciona}</p>
        </section>

        {/* comparacao: so com lista pronta em PDF ou imagem; calculadora gratis tambem considera regiao, entao nao entra */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <h2 className={`${titulo} text-2xl`}>Planilha ou lista pronta: qual a diferença?</h2>
          <div className={`${cartao} mt-4 overflow-x-auto`}>
            {/* sem largura minima: no celular as tres colunas cabem na tela e a da planilha nao some para a direita */}
            <table className="w-full text-left text-[14px] sm:text-[15px]">
              <thead className="text-xs uppercase tracking-wide text-[var(--purple-dark)]">
                <tr>
                  <th scope="col" className="px-3 py-2 sm:px-4"><span className="sr-only">O que muda</span></th>
                  <th scope="col" className="px-3 py-2 sm:px-4">Lista pronta (PDF ou imagem)</th>
                  <th scope="col" className="px-3 py-2 sm:px-4">{O.nomeCurto}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Quantidade de cada peça", "A mesma para todo bebê", "Muda com o mês do parto"],
                  ["Manga curta ou longa", "Costuma seguir a estação do nascimento", "Segue a estação de cada tamanho"],
                  ["Região", "Em geral, não considera", "Três faixas de clima"],
                  ["Rotina de lavagem", "Não considera", "Você informa os dias entre lavagens"],
                  ["Quanto vai gastar", "Em geral, não soma", "Soma pelo valor médio de cada peça"],
                  ["Para imprimir", "Depende da lista", "Folha A4 com espaço para marcar e somar"],
                ].map(([item, lista, planilha]) => (
                  <tr key={item} className="border-t border-[var(--purple)]/10">
                    <th scope="row" className="px-3 py-2.5 font-extrabold text-[var(--purple-dark)] sm:px-4">{item}</th>
                    <td className="px-3 py-2.5 text-[var(--ink)]/75 sm:px-4">{lista}</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--purple-dark)] sm:px-4">{planilha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* o que recebe */}
        <section className="mx-auto mt-12 max-w-5xl px-6">
          <h2 className={`${titulo} text-center text-2xl`}>O que você recebe com a planilha de enxoval de bebê</h2>
          <div className="mx-auto mt-3 max-w-2xl">
            <p className={texto}>{DEFINICAO}</p>
            <ul className="mt-3 space-y-1.5 text-[15px] text-[var(--ink)]/85">
              {[
                "Quantidade de cada peça por tamanho: RN, P, M, G e GG.",
                "A estação em que o bebê usa cada tamanho, pelo mês previsto do parto, com ajuste por região.",
                "Campo para marcar o que você já tem ou ganhou no chá, e a lista mostra só o que falta comprar.",
                "Valor médio de cada peça e a soma de quanto falta gastar.",
                "Abre no Excel e no Google Planilhas, e vem também em lista A4 para imprimir.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[var(--purple)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className={`${cartao} p-5`}>
              <div className="flex items-center gap-2 text-[var(--purple)]">
                <Table size={26} weight="duotone" />
                <h3 className={`${titulo} text-lg`}>Planilha Calendário de Tamanhos</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80">
                Para Excel e Google Planilhas. Você preenche três células e recebe a lista com a quantidade de cada peça, do RN ao GG, e
                o que falta comprar.{ENXOVAL_NO_AR && " No celular, a página Minha lista faz a mesma conta, sem instalar nada."}
              </p>
              <Image
                src="/enxoval/planilha-lista.webp"
                alt="Planilha de enxoval de bebê: lista de peças do tamanho P com a quantidade de cada uma"
                width={1592}
                height={800}
                sizes="(max-width: 768px) 90vw, 450px"
                className="mt-4 rounded-xl border border-[var(--purple)]/10"
              />
            </div>
            <div className={`${cartao} p-5`}>
              <div className="flex items-center gap-2 text-[var(--purple)]">
                <BookOpen size={26} weight="duotone" />
                <h3 className={`${titulo} text-lg`}>Guia {O.nomeCurto}, {O.produto.paginas} páginas</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80">O porquê de cada número, em seis capítulos:</p>
              <ol className="mt-3 space-y-1.5">
                {O.produto.capitulos.map((c, i) => (
                  <li key={c.titulo} className="flex gap-2 text-[15px]">
                    <span className="font-extrabold text-[var(--purple)]">{i + 1}.</span>
                    <span className="text-[var(--ink)]/85">{c.titulo}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Image src="/enxoval/guia-regiao.webp" alt="Página do guia com a estação de cada tamanho por mês do parto" width={720} height={1020} sizes="(max-width: 768px) 45vw, 220px" className="rounded-lg border border-[var(--purple)]/10" />
                <Image src="/enxoval/guia-exemplo.webp" alt="Página do guia com o exemplo completo de quantidades" width={720} height={1020} sizes="(max-width: 768px) 45vw, 220px" className="rounded-lg border border-[var(--purple)]/10" />
              </div>
            </div>
          </div>

          <div className={`${cartao} mt-5 grid items-center gap-5 p-5 md:grid-cols-[1fr_15rem]`}>
            <div>
              <div className="flex items-center gap-2 text-[var(--purple)]">
                <Printer size={26} weight="duotone" />
                <h3 className={`${titulo} text-lg`}>Lista para imprimir, em A4</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80">
                Duas folhas para levar nas compras ou deixar na porta da geladeira. Tem quadradinho para marcar o que já
                comprou, espaço para o valor médio de cada peça e o total de cada tamanho, até chegar a quanto vai custar o
                enxoval inteiro.
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80">
                Prefere a lista já preenchida? A aba Meu enxoval da planilha também imprime, com as quantidades do seu mês e
                a soma do que falta gastar.
              </p>
            </div>
            <Image
              src="/enxoval/lista-impressa.webp"
              alt="Primeira folha da lista para imprimir, com os tamanhos RN, P e M e as colunas de valor médio e total"
              width={900}
              height={1273}
              sizes="(max-width: 768px) 192px, 240px"
              className="mx-auto w-48 rotate-2 rounded-lg border border-[var(--purple)]/10 shadow-[0_6px_0_rgba(109,40,184,0.15)] md:w-full"
            />
          </div>

          <div className={`${cartao} mt-5 p-5`}>
            <div className="flex items-center gap-2 text-[var(--purple)]">
              <Gift size={26} weight="duotone" />
              <h3 className={`${titulo} text-lg`}>E ainda vem junto</h3>
            </div>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {O.bonus.map((b) => (
                <li key={b.nome} className="rounded-2xl bg-[var(--cream)] p-4">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-[#db2777]">Bônus</span>
                  <p className="mt-0.5 font-extrabold text-[var(--purple-dark)]">{b.nome}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink)]/75">{b.descricao}</p>
                </li>
              ))}
            </ul>
          </div>

          <ul className="mx-auto mt-6 max-w-2xl space-y-2">
            {O.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[15px] text-[var(--ink)]/85">
                <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-[var(--mint)]" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 text-center">
            <BotaoComprar local="o que recebe" />
          </div>
        </section>

        {/* como funciona */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <Image
            src="/enxoval/foto-gestante.webp"
            alt="Gestante com as mãos na barriga"
            width={1200}
            height={800}
            className="mb-6 aspect-[3/2] w-full rounded-3xl object-cover"
          />
          <h2 className={`${titulo} text-2xl`}>Como usar a planilha de enxoval de bebê em 3 passos</h2>
          <ol className="mt-4 space-y-4">
            {[
              ["Preencha três células", "Mês previsto do parto, região e de quantos em quantos dias você lava a roupinha do bebê."],
              ["Veja os seus tamanhos", "A planilha mostra quando o bebê deve usar cada tamanho e com que clima."],
              ["Receba a lista", "A quantidade de cada peça, tamanho por tamanho. Anote o que já tem e veja o que falta comprar."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--purple)] font-[family-name:var(--font-baloo)] text-lg font-extrabold text-white shadow-[0_3px_0_var(--purple-dark)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-extrabold text-[var(--purple-dark)]">{t}</p>
                  <p className="text-[15px] leading-relaxed text-[var(--ink)]/80">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-[var(--mint)]/25 px-4 py-3 text-[15px] text-[var(--ink)]/85">{O.produto.quickWin}</p>
        </section>

        {/* para quem e: honesto, e o link da pagina de venda para o guia gratis (o Google ve qual das duas e informativa) */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <h2 className={`${titulo} text-2xl`}>Para quem é a planilha</h2>
          <p className={`${texto} mt-2`}>
            É para quem quer saber quantas peças comprar de cada tamanho e em que estação o bebê vai usar cada um, no seu mês e na
            sua região. Se você só quer uma referência geral para conferir, a nossa{" "}
            <Link href="/blog/lista-de-enxoval-de-bebe-com-quantidade" className="font-bold text-[var(--purple)] underline">
              lista de enxoval de bebê com quantidades e tamanhos
            </Link>{" "}
            é grátis e mostra o exemplo de {ex.mes} completo.
          </p>
          {POSTS_DE_MES.length > 0 && (
            <>
              <h3 className={`${titulo} mt-6 text-lg`}>Meu bebê nasce em...</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {POSTS_DE_MES.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="inline-block rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[var(--purple-dark)] shadow-[0_3px_0_rgba(109,40,184,0.08)] hover:bg-[var(--purple)]/8"
                    >
                      <span className="sr-only">Enxoval para bebê que nasce em </span>
                      <span className="capitalize">{NOME_MES[p.mes] ?? p.mes}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* por que confiar na conta */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <div className="flex items-center gap-2 text-[var(--purple)]">
            <Ruler size={24} weight="duotone" />
            <h2 className={`${titulo} text-2xl`}>Uma conta aberta, sem chute</h2>
          </div>
          <p className={`${texto} mt-2`}>
            Cada número sai de uma conta que o guia explica: trocas por dia, dias entre lavagens, quanto de cada tamanho vale comprar
            antes do parto e a estação em que ele vai ser usado. As faixas de tamanho são as mesmas da{" "}
            <Link href="/blog/tabela-de-tamanhos-roupa-infantil" className="font-bold text-[var(--purple)] underline">
              tabela que a gente usa na loja
            </Link>
            .
          </p>
          <p className={`${texto} mt-3`}>
            No exemplo do bebê de {ex.mes} no Sudeste, a lista dá {ex.bodiesInicio} bodies entre RN e P, e a manga curta e a manga
            longa seguem a estação de cada tamanho.
          </p>
          <p className="mt-3 text-sm text-[var(--ink)]/60">
            Conta e textos da Império Bem Kids, loja de roupa infantil de São Paulo. Revisado em{" "}
            <time dateTime={REVISADO_EM}>{REVISADO_EM.split("-").reverse().join("/")}</time>.
          </p>
        </section>

        {/* avaliacoes reais: so aparece quando houver alguma em lib/ofertas/enxoval-avaliacoes.ts */}
        {AVALIACOES.length > 0 && (
          <section className="mx-auto mt-12 max-w-5xl px-6">
            <h2 className={`${titulo} text-center text-2xl`}>Quem já usou</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {AVALIACOES.map((a) => (
                <figure key={`${a.nome}-${a.data}`} className={`${cartao} p-5`}>
                  <div className="flex gap-0.5 text-[var(--yellow)]" aria-label={`Nota ${a.nota} de 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={18} weight={i < a.nota ? "fill" : "regular"} />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-[15px] leading-relaxed text-[var(--ink)]/85">{a.texto}</blockquote>
                  <figcaption className="mt-3 text-sm font-bold text-[var(--purple-dark)]">
                    {a.nome}, {a.cidade}
                    {a.ganhouParaTestar && (
                      <span className="block text-xs font-semibold text-[var(--ink)]/55">Recebeu o material para testar</span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* oferta */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <div className={`${cartao} p-6 text-center`}>
            <h2 className={`${titulo} text-2xl`}>{O.nomeCurto}</h2>
            <p className="mt-1 text-[15px] text-[var(--ink)]/75">Planilha, guia de {O.produto.paginas} páginas, lista para imprimir e {O.bonus.length} bônus</p>
            {v.promo && (
              <span className="mt-4 inline-block rounded-full bg-[var(--purple)] px-3 py-1 text-xs font-extrabold text-white">
                {v.promo.nome}: só até {v.promo.ateLongo}
              </span>
            )}
            {v.de && (
              <p className="mt-3 text-lg font-bold text-[var(--ink)]/50">
                de <s>{v.de}</s> por
              </p>
            )}
            <p className={`${v.de ? "" : "mt-4 "}font-[family-name:var(--font-baloo)] text-5xl font-extrabold text-[var(--purple)]`}>{v.precoTexto}</p>
            <p className="text-sm text-[var(--ink)]/60">
              pagamento único{v.promo && `. Depois do dia ${v.promo.ateCurto}, volta para ${v.de}`}
            </p>
            <div className="mt-5">
              <BotaoComprar local="oferta" />
            </div>
            <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-2xl bg-[var(--cream)] p-4 text-left">
              <ShieldCheck size={30} weight="duotone" className="shrink-0 text-[var(--purple)]" />
              <p className="text-[14px] leading-relaxed text-[var(--ink)]/85">
                <b className="text-[var(--purple-dark)]">Garantia de {O.garantia.dias} dias.</b> {O.garantia.texto}
              </p>
            </div>
          </div>
        </section>

        {/* perguntas */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <h2 className={`${titulo} text-2xl`}>Perguntas sobre a planilha de enxoval de bebê</h2>
          <div className="mt-4 space-y-3">
            {perguntas.map((q, i) => (
              <details key={q.p} open={i < 2} className="group rounded-2xl bg-white p-4 shadow-[0_3px_0_rgba(109,40,184,0.08)]">
                <summary className="cursor-pointer list-none font-bold text-[var(--purple-dark)]">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                  {q.p}
                </summary>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/75">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-2xl px-6 text-center">
          <BotaoComprar local="final" />
          <div className="mt-6 space-y-1 text-xs leading-relaxed text-[var(--ink)]/55">
            {O.avisos.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
