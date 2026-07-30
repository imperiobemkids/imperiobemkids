import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Império Bem Kids | Moda e achadinhos infantis",
  description:
    "Império Bem Kids: roupas, brinquedos e achadinhos para o universo infantil, escolhidos com carinho de quem entende de criança.",
};

/*
  Home placeholder do site. O site completo vem depois; por enquanto
  e uma capa da marca com CTA para a pagina de pedido (/pedido).
*/
export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
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

      <div className="relative z-10 mt-6 flex gap-4 text-sm font-semibold text-[var(--purple)]">
        <a href="https://www.instagram.com/imperiobemkids/" target="_blank" rel="noopener noreferrer" className="hover:underline">
          Instagram
        </a>
        <a href="https://www.tiktok.com/@imperiobemkids" target="_blank" rel="noopener noreferrer" className="hover:underline">
          TikTok
        </a>
      </div>
    </main>
  );
}
