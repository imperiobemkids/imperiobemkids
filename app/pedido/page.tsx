import type { Metadata } from "next";
import Image from "next/image";
import { Assistant } from "../Assistant";
import { jsonLdScript, listaDeProdutos, perguntas, FAQ } from "@/lib/seo";

export const metadata: Metadata = {
  // titulo escrito para a busca ("kit de roupa infantil"), nao so para a marca
  title: "Kit de roupa infantil menino e menina | 4 peças por R$ 49,90",
  description:
    "Kit com 4 peças de roupa infantil de verão, para menino e menina, por R$ 49,90. Pronta entrega. Peça pelo WhatsApp ou compre na nossa loja na Shopee.",
  alternates: { canonical: "/pedido" },
  openGraph: {
    title: "Kit de roupa infantil: 4 peças por R$ 49,90",
    description: "Roupa infantil de verão com curadoria, para menino e menina. Pronta entrega.",
    images: ["/produtos/kit-verao-menino.jpg"],
  },
};

/*
  Links da pagina. href: null renderiza o card como "em breve" (sem link).
  anchor: id usado pelo chat (Ursinha) pra rolar ate o bloco.
*/
type BioLink = {
  href: string | null;
  emoji: string;
  title: string;
  desc: string;
  accent: string; // cor de fundo do icone
  featured?: boolean;
  anchor?: string;
};

// WhatsApp de pedido, com mensagem ja preenchida
const WHATSAPP = "https://wa.me/5511947956479?text=" +
  encodeURIComponent("Oi! Vim pelo site do Império Bem Kids e quero fazer um pedido 💜");

const LOJA_SHOPEE =
  "https://shopee.com.br/douglasben?categoryId=100633&entryPoint=ShopByPDP&itemId=58265431662";

const GRUPO_ACHADINHOS = "https://chat.whatsapp.com/GKQ58djmnyGHG2HMrPUxYb";

const LINKS: BioLink[] = [
  {
    href: GRUPO_ACHADINHOS,
    emoji: "🎁",
    title: "Grupo de Achadinhos",
    desc: "as promoções caem aqui primeiro, entra que é de graça",
    accent: "var(--mint)",
    featured: true,
    anchor: "promos",
  },
  {
    href: WHATSAPP,
    emoji: "💬",
    title: "Pedir pelo WhatsApp",
    desc: "fala direto com a gente e monta seu pedido",
    accent: "var(--teal)",
    featured: true,
  },
  {
    href: LOJA_SHOPEE,
    emoji: "🛒",
    title: "Nossa lojinha na Shopee",
    desc: "veja todos os produtos e compre com segurança",
    accent: "var(--yellow)",
    featured: true,
    anchor: "loja",
  },
  {
    href: "https://www.tiktok.com/@imperiobemkids",
    emoji: "🎵",
    title: "TikTok",
    desc: "@imperiobemkids",
    accent: "var(--pink)",
  },
  {
    href: "https://www.instagram.com/imperiobemkids/",
    emoji: "📸",
    title: "Instagram",
    desc: "@imperiobemkids",
    accent: "var(--teal)",
  },
];

/*
  Catalogo de produtos. Enquanto nao tem foto real, deixe image: null
  e escolha um emoji + accent (cor de fundo do placeholder).
  Quando tiver a foto, coloque o caminho em image (ex: "/produtos/nome.jpg")
  e o link de compra em href.
*/
type Produto = {
  href: string | null;
  image: string | null;
  emoji: string;
  accent: string;
  nome: string;
  preco: string;
  precoDe?: string;
};

type Vitrine = {
  id: string;
  emoji: string;
  titulo: string;
  subtitulo: string;
  produtos: Produto[];
};

const VITRINES: Vitrine[] = [
  {
    id: "tendencia",
    emoji: "🔥",
    titulo: "Produtinhos Tendência",
    subtitulo: "kit com 4 peças, pronta entrega",
    produtos: [
      {
        href: "https://shopee.com.br/product/1389538624/58215469217/",
        image: "/produtos/kit-verao-menino.jpg",
        emoji: "👕",
        accent: "var(--teal)",
        nome: "Kit 4 peças verão menino",
        preco: "R$ 49,90",
      },
      {
        href: "https://shopee.com.br/product/1389538624/58265431662/",
        image: "/produtos/kit-verao-menina.jpg",
        emoji: "👗",
        accent: "var(--pink)",
        nome: "Kit 4 peças verão menina",
        preco: "R$ 49,90",
      },
    ],
  },
  {
    id: "achadinhos",
    emoji: "✨",
    titulo: "Achadinhos",
    subtitulo: "as melhores pechinchas garimpadas pra você",
    // sem produto cadastrado ainda: a secao mostra o convite para a loja
    produtos: [],
  },
];

function LinkCard({ link }: { link: BioLink }) {
  const inner = (
    <div
      className={`group flex w-full items-center gap-4 rounded-3xl border-2 bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.12)] transition-all ${
        link.href
          ? "border-transparent hover:-translate-y-1 hover:border-[var(--purple)] hover:shadow-[0_8px_0_rgba(109,40,184,0.18)]"
          : "border-dashed border-[var(--purple)]/25 opacity-80"
      }`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ background: `color-mix(in srgb, ${link.accent} 45%, white)` }}
      >
        {link.emoji}
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-baloo)] text-lg font-bold text-[var(--purple-dark)]">
            {link.title}
          </span>
          {!link.href && (
            <span className="rounded-full bg-[var(--yellow)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
              em breve
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--ink)]/70">{link.desc}</p>
      </div>
      {link.href && (
        <span className="mr-1 text-[var(--purple)] transition-transform group-hover:translate-x-1">
          →
        </span>
      )}
    </div>
  );

  if (!link.href)
    return (
      <div id={link.anchor} className="w-full scroll-mt-4">
        {inner}
      </div>
    );
  return (
    <a
      id={link.anchor}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full scroll-mt-4"
    >
      {inner}
    </a>
  );
}

function desconto(precoDe?: string, preco?: string) {
  if (!precoDe || !preco) return null;
  const num = (v: string) => parseFloat(v.replace(/[^0-9,]/g, "").replace(",", "."));
  const de = num(precoDe);
  const por = num(preco);
  if (!de || !por || por >= de) return null;
  return Math.round((1 - por / de) * 100);
}

function ProdutoCard({ produto }: { produto: Produto }) {
  const off = desconto(produto.precoDe, produto.preco);
  const inner = (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-transparent bg-white shadow-[0_4px_0_rgba(109,40,184,0.12)] transition-all hover:-translate-y-1 hover:border-[var(--purple)] hover:shadow-[0_8px_0_rgba(109,40,184,0.18)]">
      {/* imagem / placeholder */}
      <div
        className="relative flex aspect-[3/4] items-center justify-center overflow-hidden"
        style={
          produto.image
            ? undefined
            : { background: `color-mix(in srgb, ${produto.accent} 35%, white)` }
        }
      >
        {produto.image ? (
          <Image
            src={produto.image}
            alt={produto.nome}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 50vw, 224px"
          />
        ) : (
          <span className="text-6xl">{produto.emoji}</span>
        )}
        {off && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--purple)] px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
            -{off}%
          </span>
        )}
        {!produto.href && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--purple)]">
            em breve
          </span>
        )}
      </div>

      {/* infos */}
      <div className="flex flex-1 flex-col p-3">
        <p className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-[var(--ink)]">
          {produto.nome}
        </p>
        <div className="mt-auto flex items-baseline gap-1.5">
          {produto.precoDe && (
            <span className="text-xs text-[var(--ink)]/40 line-through">
              {produto.precoDe}
            </span>
          )}
          <span className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple)]">
            {produto.preco}
          </span>
        </div>
        <div
          className={`mt-2 rounded-full py-2 text-center text-xs font-extrabold ${
            produto.href
              ? "bg-[var(--purple)] text-white transition-colors group-hover:bg-[var(--purple-dark)]"
              : "bg-[var(--purple)]/10 text-[var(--purple)]/60"
          }`}
        >
          {produto.href ? "Comprar 🛒" : "Em breve"}
        </div>
      </div>
    </div>
  );

  if (!produto.href) return inner;
  return (
    <a href={produto.href} target="_blank" rel="noopener noreferrer" className="block h-full">
      {inner}
    </a>
  );
}

function VitrineSecao({ vitrine }: { vitrine: Vitrine }) {
  return (
    <section id={vitrine.id} className="relative z-10 mb-8 w-full scroll-mt-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{vitrine.emoji}</span>
        <div>
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold leading-none text-[var(--purple-dark)]">
            {vitrine.titulo}
          </h2>
          <p className="text-xs text-[var(--ink)]/60">{vitrine.subtitulo}</p>
        </div>
      </div>
      {vitrine.produtos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {vitrine.produtos.map((p) => (
            <ProdutoCard key={p.nome} produto={p} />
          ))}
        </div>
      ) : (
        <a
          href={LOJA_SHOPEE}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-3xl border-2 border-dashed border-[var(--purple)]/25 bg-white/60 p-5 text-center"
        >
          <p className="text-sm text-[var(--ink)]/70">
            Novidades chegando toda semana. Dá uma olhada na lojinha 👀
          </p>
          <span className="mt-2 inline-block text-sm font-extrabold text-[var(--purple)]">
            ver na Shopee →
          </span>
        </a>
      )}
    </section>
  );
}

export default function Home() {
  const destaque = LINKS.filter((l) => l.featured);
  const redes = LINKS.filter((l) => !l.featured);
  const todosProdutos = VITRINES.flatMap((v) => v.produtos);

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-5 pb-28 pt-8">
      {/* bolhas decorativas de fundo */}
      <div className="pointer-events-none absolute -left-10 top-24 h-40 w-40 rounded-full bg-[var(--pink)]/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-72 h-40 w-40 rounded-full bg-[var(--mint)]/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-24 left-1/4 h-32 w-32 rounded-full bg-[var(--yellow)]/40 blur-3xl" />

      {/* logo */}
      <div className="animate-float relative z-10 mb-1">
        <Image
          src="/logo.png"
          alt="Império Bem Kids"
          width={156}
          height={156}
          priority
          className="drop-shadow-sm"
        />
      </div>

      <p className="relative z-10 mb-6 max-w-xs text-center text-[15px] leading-relaxed text-[var(--ink)]/75">
        Achadinhos e promoções para o universo infantil, escolhidos com carinho
        de quem entende de criança. 💜
      </p>

      {/* destaques (links) */}
      <div className="relative z-10 mb-7 flex w-full flex-col gap-3">
        {destaque.map((l) => (
          <LinkCard key={l.title} link={l} />
        ))}
      </div>

      {/* vitrines de produtos */}
      {VITRINES.map((v) => (
        <VitrineSecao key={v.id} vitrine={v} />
      ))}

      {/* separador arco-iris */}
      <div className="relative z-10 mb-6 flex items-center gap-1.5">
        {["var(--mint)", "var(--pink)", "var(--yellow)", "var(--teal)"].map((c) => (
          <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
        ))}
      </div>

      {/* redes */}
      <div className="relative z-10 flex w-full flex-col gap-3">
        {redes.map((l) => (
          <LinkCard key={l.title} link={l} />
        ))}
      </div>

      {/* perguntas frequentes: responde a duvida antes da compra e alimenta o snippet da busca */}
      <section className="relative z-10 mt-10 w-full">
        <h2 className="mb-3 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
          Perguntas frequentes
        </h2>
        <div className="flex flex-col gap-2">
          {FAQ.map((f) => (
            <details key={f.pergunta} className="group rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
              <summary className="cursor-pointer list-none text-sm font-bold text-[var(--purple-dark)] marker:hidden">
                <span className="mr-2 inline-block text-[var(--purple)] transition-transform group-open:rotate-90">▸</span>
                {f.pergunta}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-[var(--ink)]/75">{f.resposta}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="relative z-10 mt-10 text-center">
        <p className="font-[family-name:var(--font-baloo)] text-sm font-semibold text-[var(--purple)]/50">
          Império Bem Kids
        </p>
        <p className="mt-1 text-xs text-[var(--ink)]/35">
          Powered by{" "}
          <a href="https://audaztiva.com" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--purple)]/60 hover:underline">
            RichardKhalid
          </a>
        </p>
      </footer>

      {/* dados estruturados: produtos com preco e perguntas frequentes */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listaDeProdutos(todosProdutos))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(perguntas(FAQ))} />

      {/* chat que direciona a cliente */}
      <Assistant />
    </main>
  );
}
