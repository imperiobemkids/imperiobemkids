import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { jsonLdScript, organizacao } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Roupa infantil com preço que cabe no bolso | Império Bem Kids",
  description:
    "Kits de roupa infantil para menino e menina, escolhidos peça por peça. Curadoria de verdade, pronta entrega e atendimento pelo WhatsApp.",
  alternates: { canonical: "/" },
};

/*
  Home placeholder do site. O site completo vem depois; por enquanto
  e uma capa da marca com CTA para a pagina de pedido (/pedido).
*/
export default function Home() {
  return (
    <>
    <SiteHeader />
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* bolhas de fundo */}
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-[var(--pink)]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 h-56 w-56 rounded-full bg-[var(--mint)]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 left-1/3 h-48 w-48 rounded-full bg-[var(--sun)]/30 blur-3xl" />

      <div className="animate-float relative z-10">
        <Image src="/logo.png" alt="Império Bem Kids" width={200} height={200} priority className="drop-shadow-sm" />
      </div>

      <h1 className="relative z-10 mt-2 font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">
        Império Bem Kids
      </h1>
      <p className="relative z-10 mt-3 max-w-md text-[15px] leading-relaxed text-[var(--ink)]/75">
        Moda, brinquedos e achadinhos para o universo infantil, escolhidos com
        carinho de quem entende de criança. 💜
      </p>

      <Link
        href="/pedido"
        className="relative z-10 mt-7 rounded-full bg-[var(--purple)] px-7 py-3.5 font-[family-name:var(--font-baloo)] text-base font-extrabold text-white shadow-lg shadow-[var(--purple)]/30 transition-transform hover:scale-105"
      >
        Ver achadinhos e promoções 🎁
      </Link>

      {/* a planilha de enxoval a um clique da home: e a pagina que mais precisa de link interno */}
      <Link
        href="/enxoval"
        className="relative z-10 mt-6 block max-w-md rounded-3xl bg-white/80 px-5 py-4 text-left shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-transform hover:-translate-y-0.5"
      >
        <span className="block font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]">
          Vai ter bebê? Monte o enxoval pelo mês do parto
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--ink)]/75">
          Planilha que mostra quantas peças comprar de cada tamanho, do RN ao GG, para a estação em que o bebê vai usar.
        </span>
        <span className="mt-2 block text-sm font-bold text-[var(--purple)]">Ver a planilha de enxoval de bebê →</span>
      </Link>

      <div className="relative z-10 mt-6 flex gap-4 text-sm font-semibold text-[var(--purple)]">
        <a href="https://www.instagram.com/imperiobemkids/" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Instagram
        </a>
        <a href="https://www.tiktok.com/@imperiobemkids" target="_blank" rel="noopener noreferrer" className="hover:underline">
          TikTok
        </a>
      </div>
    </main>
    <SiteFooter />
    {/* identifica a loja para busca e IAs */}
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizacao)} />
    </>
  );
}
