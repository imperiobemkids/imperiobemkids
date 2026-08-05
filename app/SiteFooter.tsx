import Link from "next/link";

/*
  Rodape publico do site. Usado nas paginas do site e no Portal do Cliente.
  A pagina /pedido (link in bio) tem rodape proprio, mais enxuto.
*/
const NAV = [
  { href: "/", label: "Home" },
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/pedido", label: "Achadinhos" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--purple)]/10 bg-white/50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10">
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <div className="min-w-[180px] flex-1">
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Império Bem Kids
            </div>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--ink)]/65">
              Moda e achadinhos para o universo infantil, escolhidos com carinho
              de quem entende de criança. 💜
            </p>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/45">
              Navegar
            </div>
            <ul className="space-y-1.5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--purple)]">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/45">
              Fale com a gente
            </div>
            <ul className="space-y-1.5">
              <li>
                <a href="https://www.instagram.com/imperiobemkids/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--purple)]">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://www.tiktok.com/@imperiobemkids" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--purple)]">
                  TikTok
                </a>
              </li>
              <li>
                <a href="https://wa.me/5511947956479" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--ink)]/70 hover:text-[var(--purple)]">
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--purple)]/10 pt-5 text-xs text-[var(--ink)]/45">
          <span>© {new Date().getFullYear()} Império Bem Kids</span>
          <span>
            Powered by{" "}
            <a
              href="https://audaztiva.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--purple)] hover:underline"
            >
              RichardKhalid
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
