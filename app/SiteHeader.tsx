import Link from "next/link";
import Image from "next/image";

/*
  Cabecalho publico do site, usado nas paginas do site (home, sobre, blog)
  e no Portal do Cliente. NAO confundir com o menu do /admin, que so aparece
  depois de logar.
*/
const NAV = [
  { href: "/", label: "Home" },
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/pedido", label: "Achadinhos" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--purple)]/10 bg-[var(--cream)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="Império Bem Kids" width={34} height={34} />
          <span className="hidden font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)] sm:inline">
            Império Bem Kids
          </span>
        </Link>
        <nav className="flex flex-1 gap-0.5 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--ink)]/70 transition-colors hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/portal"
          className="shrink-0 rounded-full bg-[var(--purple)]/10 px-3.5 py-1.5 text-sm font-bold text-[var(--purple)] transition-colors hover:bg-[var(--purple)]/18"
        >
          Portal
        </Link>
      </div>
    </header>
  );
}
