import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../../../SiteHeader";
import { SiteFooter } from "../../../SiteFooter";
import { AvisoNavegador } from "../AvisoNavegador";
import { MinhaLista } from "./MinhaLista";
import type { DadosCalendario } from "@/lib/checkout/calendario";
import { lerDados } from "@/lib/checkout/entrega";
import { ofertaDoAcesso } from "@/lib/checkout/ofertas";

/*
  Minha lista: a planilha para quem esta no celular. Abre no navegador, sem app
  e sem login, pelo link com o codigo de acesso que fica na area de membros. Sem
  o codigo, volta para a pagina de obrigado, que explica. Fora do Google pelo
  noindex e pelo /obrigado no robots.
*/
export const metadata: Metadata = {
  title: "Minha lista do enxoval",
  robots: { index: false, follow: false },
};

export default async function ListaPage({ params, searchParams }: PageProps<"/obrigado/[oferta]/lista">) {
  const { oferta: slug } = await params;
  const { acesso } = await searchParams;
  const oferta = ofertaDoAcesso(acesso);
  const obrigado = `/obrigado/${slug}?acesso=${typeof acesso === "string" ? encodeURIComponent(acesso) : ""}`;
  if (oferta?.slug !== slug || !oferta.temLista) redirect(obrigado);
  const dados = await lerDados<DadosCalendario>(slug);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-6">
        <Link href={obrigado} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--purple)]">
          <ArrowLeft size={16} weight="bold" aria-hidden />
          Voltar para os arquivos
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">Minha lista</h1>
        <p className="mb-5 mt-1 text-[16px] leading-relaxed text-[var(--ink)]/80">
          Escolha o mês do parto e a lista se monta sozinha. Depois é só marcar o que já tem e anotar quanto custa cada peça.
        </p>
        <AvisoNavegador />
        <MinhaLista
          acesso={acesso as string}
          opcoes={{
            meses: dados.meses,
            regioes: dados.regioes.map((r) => ({ nome: r.nome, descricao: r.descricao })),
            dias: dados.dias_entre_lavagens_opcoes,
            diasPadrao: dados.dias_entre_lavagens_padrao,
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
