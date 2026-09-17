import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { EMPRESA } from "@/lib/empresa";

/*
  Moldura das paginas de politica (privacidade, trocas). Texto corrido com
  largura de leitura, titulos em Baloo e a data de revisao no fim.
*/
export function PaginaLegal({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children: React.ReactNode;
}) {
  const revisada = new Date(EMPRESA.politicasRevisadasEm + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold tracking-tight text-[var(--purple-dark)]">
          {titulo}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink)]/70">{resumo}</p>
        <article className="legal mt-8">{children}</article>
        <p className="mt-10 text-xs text-[var(--ink)]/45">Última revisão em {revisada}.</p>
      </main>
      <SiteFooter />
    </>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">{titulo}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-[var(--ink)]/80">{children}</div>
    </section>
  );
}
