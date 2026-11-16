import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CheckCircle, Check } from "@phosphor-icons/react/ssr";
import { BotoesUpsell } from "./BotoesUpsell";
import { OFERTAS_ENTREGA, ofertaDoAcesso } from "@/lib/checkout/ofertas";
import { SCRIPT_UPSELL, destinosDoPasso } from "@/lib/checkout/upsell";
import { brl } from "@/lib/formato";

/*
  Oferta de 1 clique entre o pagamento e a pagina do pedido. A Kiwify traz a
  compradora para ca com o token da compra; sem ele nao ha como cobrar em um
  clique, entao a pagina so manda para o pedido. Sem menu, para a escolha ser
  entre aceitar e seguir. Fora do Google pelo noindex e pelo /obrigado no robots.
*/
export const metadata: Metadata = {
  title: "Uma oferta antes do seu pedido",
  robots: { index: false, follow: false },
};

export default async function OfertaUpsellPage({ params, searchParams }: PageProps<"/obrigado/[oferta]/oferta/[passo]/[acesso]">) {
  // o codigo de acesso so tem letras, numeros, _ e -: nao precisa decodificar, e o que vier diferente nao confere
  const { oferta: slug, passo, acesso } = await params;
  const { token } = await searchParams;
  const pedido = `/obrigado/${slug}?acesso=${encodeURIComponent(acesso)}`;
  const oferta = ofertaDoAcesso(acesso);
  const destinos = destinosDoPasso(slug, passo, acesso);
  const extra = destinos ? OFERTAS_ENTREGA[destinos.passo.oferta] : null;
  if (oferta?.slug !== slug || !destinos || !extra || typeof token !== "string" || !token) redirect(pedido);
  const p = destinos.passo;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-12 pt-6">
      <div className="flex justify-center">
        <Image src="/logo.png" alt="Império Bem Kids" width={56} height={56} priority />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#d1fae5] px-4 py-3 text-sm leading-relaxed text-[var(--ink)]/85">
        <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[#047857]" aria-hidden />
        <span>
          <b className="text-[#065f46]">Compra confirmada.</b> O {oferta.nome} é seu e abre logo depois desta página.
        </span>
      </p>

      <p className="mt-7 text-sm font-extrabold uppercase tracking-wide text-[#be185d]">{p.chamada}</p>
      <h1 className="mt-1 font-[family-name:var(--font-baloo)] text-3xl font-extrabold leading-tight text-[var(--purple-dark)]">{p.titulo}</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-[var(--ink)]/80">{p.texto}</p>

      <section className="mt-5 rounded-3xl bg-white p-5 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold leading-tight text-[var(--purple-dark)]">{extra.nome}</h2>
        <ul className="mt-3 space-y-2.5">
          {p.itens.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-snug text-[var(--ink)]/85">
              <Check size={18} weight="bold" className="mt-0.5 shrink-0 text-[var(--purple)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-[var(--purple)]/10 pt-3 text-[15px] text-[var(--ink)]/75">
          Por <b className="num font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">{brl(p.preco)}</b>
        </p>
      </section>

      <BotoesUpsell
        link={p.link}
        script={SCRIPT_UPSELL}
        aoAceitar={destinos.aoAceitar}
        aoRecusar={destinos.aoRecusar}
        aceitar={`${p.aceitar} por ${brl(p.preco)}`}
        recusar={p.recusar}
        pedido={pedido}
      />

      <p className="mt-6 text-center text-sm leading-relaxed text-[var(--ink)]/60">
        O acesso ao {extra.nome} chega no seu e-mail, pela área de membros, junto com o do {oferta.nome}.
      </p>
    </main>
  );
}
