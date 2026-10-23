import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, Clock, DownloadSimple, WarningCircle } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../../SiteHeader";
import { SiteFooter } from "../../SiteFooter";
import { EMPRESA } from "@/lib/empresa";
import { OFERTAS_VENDA, situacaoDoPedido, type Situacao } from "@/lib/checkout/ofertas";
import { Aguardar } from "./Aguardar";
import { CompraPixel } from "./CompraPixel";

/*
  Volta do checkout da AbacatePay. Confere o pedido direto na AbacatePay a
  cada visita (nada fica guardado no site): pago libera os arquivos,
  pendente espera o Pix confirmar, reembolsado ou expirado explica. O link
  desta pagina e o acesso da cliente, entao ela fica fora do Google.
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
  "press inline-flex items-center justify-center rounded-full border-2 border-[var(--purple)]/20 bg-white px-6 py-3 text-base font-extrabold text-[var(--purple-dark)]";

const ajuda = (pedido?: string) =>
  `${EMPRESA.whatsappLink}?text=${encodeURIComponent(
    pedido ? `Oi! Preciso de ajuda com o meu pedido ${pedido}` : "Oi! Preciso de ajuda com uma compra no site",
  )}`;

export default async function ObrigadoPage({ params, searchParams }: PageProps<"/obrigado/[oferta]">) {
  const { oferta: slug } = await params;
  const { pedido, erro } = await searchParams;
  const oferta = OFERTAS_VENDA[slug];
  if (!oferta) notFound();

  let situacao: Situacao | "erro" = "erro";
  let checkout: Awaited<ReturnType<typeof situacaoDoPedido>>["checkout"];
  if (!erro && typeof pedido === "string") {
    try {
      ({ situacao, checkout } = await situacaoDoPedido(oferta, pedido));
    } catch (e) {
      console.error("obrigado", slug, e);
    }
  } else if (!erro) {
    situacao = "nao-encontrado";
  }
  const numero = typeof pedido === "string" ? pedido : undefined;
  const p = oferta.principal;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12 text-center">
        {situacao === "pago" && numero && checkout && (
          <>
            {!checkout.devMode && checkout.status === "PAID" && (
              <CompraPixel eventoId={checkout.id} valor={p.preco / 100} produto={p.externalId} />
            )}
            <CheckCircle size={56} weight="fill" className="mx-auto text-[var(--mint)]" aria-hidden />
            <h1 className={`${titulo} mt-3 text-3xl`}>Pagamento aprovado!</h1>
            <p className={`${texto} mt-2`}>
              O {p.nome} é seu. Baixe os arquivos abaixo, no celular ou no computador.
            </p>
            <ul className="mt-7 flex flex-col items-center gap-3">
              {p.arquivos.map((a) => (
                <li key={a.id}>
                  <a href={`/api/entrega/${numero}/${a.id}`} className={botao}>
                    <DownloadSimple size={20} weight="bold" aria-hidden />
                    {a.nome}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-8 max-w-md rounded-2xl bg-[var(--yellow)]/50 px-4 py-3 text-sm leading-relaxed text-[var(--ink)]/80">
              <b className="text-[var(--purple-dark)]">Guarde o link desta página.</b> É por ele que você baixa os
              arquivos de novo quando quiser. Seu pedido: <span className="num break-all">{numero}</span>
            </p>
            {checkout.devMode && (
              <p className="mt-4 text-xs text-[var(--ink)]/60">Compra de teste (modo de desenvolvimento da AbacatePay).</p>
            )}
          </>
        )}

        {situacao === "aguardando" && (
          <>
            <Aguardar />
            <Clock size={56} weight="fill" className="mx-auto text-[var(--purple)]" aria-hidden />
            <h1 className={`${titulo} mt-3 text-3xl`}>Esperando o pagamento</h1>
            <p className={`${texto} mt-2`}>
              Pagou por Pix? A confirmação leva alguns segundos. Esta página se atualiza sozinha e libera os arquivos
              assim que o banco confirmar.
            </p>
            {checkout && (
              <a href={checkout.url} className={`${botaoClaro} mt-6`}>
                Voltar para o pagamento
              </a>
            )}
          </>
        )}

        {(situacao === "reembolsado" || situacao === "expirado" || situacao === "nao-encontrado" || situacao === "erro") && (
          <>
            <WarningCircle size={56} weight="fill" className="mx-auto text-[var(--purple)]" aria-hidden />
            <h1 className={`${titulo} mt-3 text-3xl`}>
              {situacao === "reembolsado"
                ? "Este pedido foi reembolsado"
                : situacao === "expirado"
                  ? "Este pagamento expirou"
                  : situacao === "nao-encontrado"
                    ? "Não encontramos este pedido"
                    : "Não deu para abrir o pagamento"}
            </h1>
            <p className={`${texto} mt-2`}>
              {situacao === "reembolsado"
                ? "O valor já foi devolvido, e os arquivos deste pedido não ficam mais disponíveis."
                : situacao === "expirado"
                  ? "O prazo para pagar acabou e nada foi cobrado. Se ainda quiser, é só fazer o pedido de novo."
                  : situacao === "nao-encontrado"
                    ? "Confira se o link está completo. Se você pagou e não consegue baixar, chame a gente no WhatsApp com o comprovante."
                    : "Tivemos um problema para falar com o sistema de pagamento. Tente de novo em instantes ou chame a gente no WhatsApp."}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {situacao !== "reembolsado" && (
                <Link href={oferta.pagina} className={botao}>
                  Voltar para a página
                </Link>
              )}
              <a href={ajuda(numero)} target="_blank" rel="noopener noreferrer" className={botaoClaro}>
                Falar no WhatsApp
              </a>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
