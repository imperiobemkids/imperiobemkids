import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarBlank, CheckCircle, Gift, Ruler, ShieldCheck, Table, XCircle } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { Saida } from "../Saida";
import { EMPRESA } from "@/lib/empresa";
import { SITE, jsonLdScript } from "@/lib/seo";
import { OFERTA_ENXOVAL as O } from "@/lib/ofertas/enxoval";
import { CHECKOUT_ENXOVAL, ENXOVAL_NO_AR } from "@/lib/ofertas/checkout";

/*
  Pagina de vendas do Enxoval na Medida (planilha + guia), a primeira oferta low ticket da IBK.
  A copy vem de lib/ofertas/enxoval.ts, gerado a partir da oferta; aqui fica so a montagem.
  Sem checkout configurado, o botao chama no WhatsApp e a pagina fica fora do Google.
*/

const TITULO = "Lista de enxoval de bebê pelo mês do parto";
const DESCRICAO =
  "Planilha e guia que montam a lista de enxoval do bebê pelo mês do parto, com a quantidade certa de cada tamanho do RN ao GG. R$ 19,90, com garantia de 7 dias.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: "/enxoval" },
  // so entra no Google quando o checkout estiver configurado
  robots: ENXOVAL_NO_AR ? undefined : { index: false, follow: true },
  openGraph: {
    title: `${O.nomeCurto}: o enxoval pelo mês do parto`,
    description: "A quantidade certa de cada tamanho, do RN ao GG, para a estação em que o bebê vai usar.",
    url: "/enxoval",
    type: "website",
    siteName: "Império Bem Kids",
    locale: "pt_BR",
    images: ["/enxoval/guia-capa.webp"],
  },
};

const WHATSAPP_COMPRA = `${EMPRESA.whatsappLink}?text=${encodeURIComponent(
  `Oi! Quero o ${O.nomeCurto}, a planilha e o guia do enxoval, por ${O.precoTexto} 💜`,
)}`;
const COMPRA = ENXOVAL_NO_AR ? CHECKOUT_ENXOVAL : WHATSAPP_COMPRA;
const EVENTO = ENXOVAL_NO_AR ? "InitiateCheckout" : "Contact";

const titulo = "font-[family-name:var(--font-baloo)] font-extrabold text-[var(--purple-dark)]";
const texto = "text-[16px] leading-relaxed text-[var(--ink)]/80";
const cartao = "rounded-3xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]";

function corEstacao(estacao: string) {
  if (estacao.startsWith("frio")) return "bg-[#ddd6fe] text-[var(--purple-dark)]";
  if (estacao.startsWith("calor")) return "bg-[var(--yellow)] text-[#78350f]";
  return "bg-[var(--mint)]/40 text-[#065f46]";
}

function BotaoComprar({ local, rotulo = O.cta }: { local: string; rotulo?: string }) {
  return (
    <Saida
      href={COMPRA}
      evento={EVENTO}
      params={{ content_name: O.nomeCurto, content_ids: [O.id], value: O.preco, num_items: 1, local }}
      className="press inline-flex items-center justify-center rounded-full bg-[var(--purple)] px-7 py-3.5 text-base font-extrabold text-white shadow-[0_4px_0_var(--purple-dark)]"
    >
      {rotulo}
    </Saida>
  );
}

export default function EnxovalPage() {
  const ex = O.exemplo;
  const tamanhoM = ex.tamanhos.find((t) => t.tamanho === "M");

  const perguntas = [
    {
      p: "Funciona no celular?",
      r: "Sim. A planilha abre no Google Planilhas, no celular ou no computador, e também no Excel. O guia é um PDF que abre em qualquer celular.",
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
        ? "Logo depois do pagamento aprovado, a planilha e o guia chegam no seu e-mail."
        : "Pelo WhatsApp: você chama a gente, paga por Pix e recebe a planilha e o guia ali mesmo.",
    },
    {
      p: "E se não for para mim?",
      r: `Você tem ${O.garantia.dias} dias de garantia. ${O.garantia.texto}`,
    },
  ];

  const dados = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: O.nomeCurto,
      description: DESCRICAO,
      image: `${SITE}/enxoval/guia-capa.webp`,
      brand: { "@type": "Brand", name: "Império Bem Kids" },
      offers: {
        "@type": "Offer",
        price: O.preco.toFixed(2),
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        url: `${SITE}/enxoval`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: O.nomeCurto, item: `${SITE}/enxoval` },
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
              <span className="inline-block rounded-full bg-[var(--yellow)] px-3 py-1 text-xs font-extrabold text-[var(--purple-dark)]">
                Planilha e guia em PDF
              </span>
              <h1 className={`${titulo} mt-3 text-3xl leading-tight sm:text-4xl`}>{O.headline}</h1>
              <p className={`${texto} mx-auto mt-3 max-w-lg md:mx-0`}>{O.subheadline}</p>
              <div className="mt-6 flex flex-col items-center gap-2 md:items-start">
                <BotaoComprar local="topo" />
                <p className="text-sm text-[var(--ink)]/65">
                  <b className="text-[var(--purple-dark)]">{O.precoTexto}</b>, pagamento único. Garantia de {O.garantia.dias} dias.
                </p>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-sm">
              <Image
                src="/enxoval/planilha-lista.webp"
                alt="Aba Meu enxoval da planilha, com a quantidade de cada peça do tamanho P"
                width={1352}
                height={800}
                preload
                className="rounded-2xl border border-[var(--purple)]/10 shadow-[0_6px_0_rgba(109,40,184,0.12)]"
              />
              <Image
                src="/enxoval/guia-capa.webp"
                alt="Capa do guia Enxoval na Medida"
                width={720}
                height={1020}
                className="absolute -bottom-8 -right-3 w-28 rotate-3 rounded-xl shadow-[0_6px_0_rgba(76,29,128,0.25)] sm:w-32"
              />
            </div>
          </div>
        </section>

        {/* a dor */}
        <section className="mx-auto mt-6 max-w-2xl px-6">
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
            <span className="text-xs font-extrabold uppercase tracking-wide">O jeito novo de montar o enxoval</span>
          </div>
          <h2 className={`${titulo} mt-1 text-2xl`}>O {O.mecanismo.nome}</h2>
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
              Repare no tamanho M: ele cai entre {tamanhoM.periodo}, no frio. A lista genérica mandaria body de manga curta. Para esse
              bebê, o M pede manga longa, calça e macacão.
            </p>
          )}
          <p className={`${texto} mt-4`}>{O.mecanismo.porQueFunciona}</p>
        </section>

        {/* o que recebe */}
        <section className="mx-auto mt-12 max-w-5xl px-6">
          <h2 className={`${titulo} text-center text-2xl`}>O que você recebe</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className={`${cartao} p-5`}>
              <div className="flex items-center gap-2 text-[var(--purple)]">
                <Table size={26} weight="duotone" />
                <h3 className={`${titulo} text-lg`}>Planilha Calendário de Tamanhos</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/80">
                Para Excel e Google Planilhas, no computador ou no celular. Você preenche três células e recebe a lista com a quantidade
                de cada peça, do RN ao GG, e o que falta comprar.
              </p>
              <Image
                src="/enxoval/planilha-lista.webp"
                alt="Lista de peças do tamanho P na planilha"
                width={1352}
                height={800}
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
                <Image src="/enxoval/guia-regiao.webp" alt="Página do guia com a estação de cada tamanho por mês do parto" width={720} height={1020} className="rounded-lg border border-[var(--purple)]/10" />
                <Image src="/enxoval/guia-exemplo.webp" alt="Página do guia com o exemplo completo de quantidades" width={720} height={1020} className="rounded-lg border border-[var(--purple)]/10" />
              </div>
            </div>
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
          <h2 className={`${titulo} text-2xl`}>Como funciona</h2>
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
            No exemplo do bebê de {ex.mes} no Sudeste, a lista dá {ex.bodiesInicio} bodies entre RN e P, dentro do que as listas de
            enxoval pedem para os três primeiros meses. A diferença é que a manga curta e a manga longa seguem a estação de cada tamanho.
          </p>
        </section>

        {/* oferta */}
        <section className="mx-auto mt-12 max-w-2xl px-6">
          <div className={`${cartao} p-6 text-center`}>
            <h2 className={`${titulo} text-2xl`}>{O.nomeCurto}</h2>
            <p className="mt-1 text-[15px] text-[var(--ink)]/75">Planilha, guia de {O.produto.paginas} páginas e {O.bonus.length} bônus</p>
            <p className="mt-4 font-[family-name:var(--font-baloo)] text-5xl font-extrabold text-[var(--purple)]">{O.precoTexto}</p>
            <p className="text-sm text-[var(--ink)]/60">pagamento único</p>
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
          <h2 className={`${titulo} text-2xl`}>Perguntas frequentes</h2>
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
