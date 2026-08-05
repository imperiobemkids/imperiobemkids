import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";

export const metadata: Metadata = {
  title: "Sobre a loja",
  description:
    "Quem é o Império Bem Kids: uma lojinha que garimpa roupa infantil bonita e que cabe no bolso, escolhida peça por peça, com atendimento de gente de verdade.",
  alternates: { canonical: "/sobre" },
};

const PILARES = [
  {
    emoji: "🔍",
    titulo: "A gente garimpa",
    texto:
      "Não jogamos um catálogo inteiro na sua frente. Cada kit que entra na lojinha foi escolhido olhando tecido, estampa e preço. Se está aqui, é porque a gente colocaria no nosso filho.",
  },
  {
    emoji: "💰",
    titulo: "Preço que cabe",
    texto:
      "Criança cresce rápido e roupa boa costuma ser cara. Nosso trabalho é achar o meio termo: peça bonita, que aguenta lavagem, por um valor que não pesa no mês.",
  },
  {
    emoji: "💬",
    titulo: "Tem gente do outro lado",
    texto:
      "Ficou na dúvida do tamanho? Quer ver mais foto? É só chamar no WhatsApp. Você fala com a gente de verdade, não com um robô de loja grande.",
  },
];

export default function SobrePage() {
  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* topo */}
        <section className="relative overflow-hidden px-6 py-14 text-center">
          <div className="pointer-events-none absolute -left-16 top-6 h-52 w-52 rounded-full bg-[var(--pink)]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-24 h-52 w-52 rounded-full bg-[var(--mint)]/30 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="animate-float mx-auto mb-2 w-fit">
              <Image src="/logo.png" alt="Império Bem Kids" width={130} height={130} priority />
            </div>
            <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">
              Prazer, somos o Império Bem Kids
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[var(--ink)]/75">
              A gente existe por um motivo simples: vestir bem as crianças sem
              fazer a conta do mês desandar. 💜
            </p>
          </div>
        </section>

        {/* historia */}
        <section className="mx-auto max-w-2xl px-6 pb-4">
          <div className="rounded-3xl bg-white p-6 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              Como tudo começou
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--ink)]/75">
              <p>
                O Império nasceu de uma inquietação boba e muito comum: por que
                é tão difícil achar roupinha bonita, de qualidade decente e que
                não custe uma fortuna?
              </p>
              <p>
                A gente testou caminho errado antes de achar o certo. Já tentou
                vender de tudo um pouco, já tentou competir com loja gigante no
                preço. Não deu. O que deu certo foi parar de tentar ter tudo e
                começar a escolher bem pouca coisa, com cuidado.
              </p>
              <p>
                Hoje é isso: uma lojinha pequena, com curadoria feita à mão, que
                atende de verdade quem chama. E que cresce no boca a boca de mãe
                para mãe.
              </p>
            </div>
          </div>
        </section>

        {/* pilares */}
        <section className="mx-auto max-w-3xl px-6 py-8">
          <h2 className="mb-4 text-center font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            No que a gente acredita
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {PILARES.map((p) => (
              <div key={p.titulo} className="rounded-3xl bg-white p-5 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
                <div className="text-3xl">{p.emoji}</div>
                <h3 className="mt-2 font-[family-name:var(--font-baloo)] text-lg font-bold text-[var(--purple-dark)]">
                  {p.titulo}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]/70">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* chamada final */}
        <section className="mx-auto max-w-2xl px-6 pb-6 text-center">
          <div className="rounded-3xl bg-gradient-to-br from-[var(--purple)]/10 to-[var(--pink)]/15 p-8">
            <h2 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
              Bora vestir essa criança?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[var(--ink)]/70">
              Dá uma olhada nos kits que estão saindo agora. Se ficar em dúvida
              no tamanho, chama no WhatsApp que a gente te ajuda.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link
                href="/pedido"
                className="rounded-full bg-[var(--purple)] px-6 py-3 font-[family-name:var(--font-baloo)] text-sm font-extrabold text-white shadow-lg shadow-[var(--purple)]/25 transition-transform hover:scale-105"
              >
                Ver os achadinhos 🎁
              </Link>
              <a
                href="https://wa.me/5511947956479"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-2 border-[var(--purple)]/25 px-6 py-3 font-[family-name:var(--font-baloo)] text-sm font-extrabold text-[var(--purple)] transition-colors hover:border-[var(--purple)]"
              >
                Chamar no WhatsApp 💬
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
