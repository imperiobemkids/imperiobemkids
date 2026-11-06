import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadSimple, FilePdf, Heart, ListChecks, WarningCircle, WhatsappLogo } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../../SiteHeader";
import { SiteFooter } from "../../SiteFooter";
import { EMPRESA } from "@/lib/empresa";
import { OFERTAS_ENTREGA, ofertaDoAcesso } from "@/lib/checkout/ofertas";
import { SITE } from "@/lib/seo";
import { AvisoNavegador } from "./AvisoNavegador";

/*
  Para onde a Kiwify manda a compradora depois do pagamento aprovado, com o
  codigo de acesso no link. Junta a Minha lista e os arquivos, sem esperar o
  e-mail da area de membros. Fica fora do Google e tem o botao de mandar o link
  para o proprio WhatsApp.
*/
export const metadata: Metadata = {
  title: "Seu pedido",
  robots: { index: false, follow: false },
};

const titulo = "font-[family-name:var(--font-baloo)] font-extrabold text-[var(--purple-dark)]";
const texto = "text-[16px] leading-relaxed text-[var(--ink)]/80";
const botao =
  "press inline-flex items-center justify-center gap-2 rounded-full bg-[var(--purple)] px-6 py-3 text-base font-extrabold text-white shadow-[0_4px_0_var(--purple-dark)]";
const botaoClaro =
  "press inline-flex items-center justify-center rounded-full border-2 border-[var(--purple)]/20 bg-white py-3 text-base font-extrabold text-[var(--purple-dark)]";

export default async function ObrigadoPage({ params, searchParams }: PageProps<"/obrigado/[oferta]">) {
  const { oferta: slug } = await params;
  const { acesso } = await searchParams;
  const pagina = OFERTAS_ENTREGA[slug];
  if (!pagina) notFound();

  const oferta = ofertaDoAcesso(acesso);
  if (oferta?.slug !== slug) {
    const ajuda = `${EMPRESA.whatsappLink}?text=${encodeURIComponent("Oi! Preciso de ajuda com uma compra no site")}`;
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 text-center">
          <WarningCircle size={56} weight="fill" className="mx-auto text-[var(--purple)]" aria-hidden />
          <h1 className={`${titulo} mt-3 text-3xl`}>Não encontramos este acesso</h1>
          <p className={`${texto} mt-2`}>
            Confira se o link está completo. Quem comprou também encontra tudo na área de membros, pelo e-mail da compra.
            Se não achar, chame a gente no WhatsApp.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href={pagina.pagina} className={botao}>
              Voltar para a página
            </Link>
            <a href={ajuda} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} px-6`}>
              Falar no WhatsApp
            </a>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const meuWhatsapp = `https://wa.me/?text=${encodeURIComponent(`Meu acesso ao ${oferta.nome}: ${SITE}/obrigado/${slug}?acesso=${acesso}`)}`;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 text-center">
        <Heart size={56} weight="fill" className="mx-auto text-[var(--purple)]" aria-hidden />
        <h1 className={`${titulo} mt-3 text-3xl`}>Compra confirmada!</h1>
        <p className={`${texto} mb-6 mt-2`}>O {oferta.nome} é seu. Tudo abre aqui mesmo, no celular ou no computador.</p>
        <AvisoNavegador />
        {oferta.temLista && (
          <div className="mx-auto mb-6 max-w-xs">
            <Link href={`/obrigado/${slug}/lista?acesso=${acesso}`} className={`${botao} w-full`}>
              <ListChecks size={20} weight="bold" aria-hidden />
              Abrir minha lista
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/70">
              Monte a lista pelo mês do parto, sem instalar nada. Você anota os valores e imprime ou salva em PDF.
            </p>
          </div>
        )}
        <ul className="mx-auto flex max-w-xs flex-col gap-3">
          {oferta.arquivos.map((a) => {
            const abre = a.tipo === "application/pdf";
            return (
              <li key={a.id}>
                <a
                  href={`/api/entrega/${acesso}/${a.id}`}
                  target={abre ? "_blank" : undefined}
                  rel={abre ? "noopener" : undefined}
                  className={`${botaoClaro} w-full gap-2`}
                >
                  {abre ? <FilePdf size={20} weight="bold" aria-hidden /> : <DownloadSimple size={20} weight="bold" aria-hidden />}
                  {a.rotulo}
                </a>
              </li>
            );
          })}
        </ul>
        {oferta.temLista && (
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--ink)]/70">
            A planilha é para Excel ou Google Planilhas e, no celular, precisa do app.
          </p>
        )}
        <div className="mx-auto mt-8 max-w-md rounded-2xl bg-[var(--yellow)]/50 px-4 py-4 text-sm leading-relaxed text-[var(--ink)]/80">
          <b className="text-[var(--purple-dark)]">Guarde o seu acesso.</b> Ele também chega no seu e-mail, pela área de
          membros, junto com tudo que você comprou. Se preferir, mande este link para o seu próprio WhatsApp.
          <a href={meuWhatsapp} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} mt-3 w-full gap-2 px-3 text-[15px]`}>
            <WhatsappLogo size={20} weight="bold" aria-hidden />
            Mandar para o meu WhatsApp
          </a>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
