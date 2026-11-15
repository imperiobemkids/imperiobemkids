import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { SiteHeader } from "../../../SiteHeader";
import { SiteFooter } from "../../../SiteFooter";
import { AvisoNavegador } from "../AvisoNavegador";
import { MeuGuardaRoupa } from "./MeuGuardaRoupa";
import { lerDados } from "@/lib/checkout/entrega";
import { anosDeNascimento, type DadosGuardaRoupa } from "@/lib/checkout/guardaRoupa";
import { ofertaDoAcesso } from "@/lib/checkout/ofertas";

/*
  Meu guarda-roupa: a planilha do guarda-roupa de 1 a 3 anos para quem esta no
  celular. Abre no navegador, sem app e sem login, pelo link com o codigo de
  acesso. Sem o codigo, volta para a pagina de obrigado, que explica. Fora do
  Google pelo noindex e pelo /obrigado no robots.
*/
export const metadata: Metadata = {
  title: "Meu guarda-roupa",
  robots: { index: false, follow: false },
};

export default async function GuardaRoupaPage({ params, searchParams }: PageProps<"/obrigado/[oferta]/guarda-roupa">) {
  const { oferta: slug } = await params;
  const { acesso } = await searchParams;
  const oferta = ofertaDoAcesso(acesso);
  const obrigado = `/obrigado/${slug}?acesso=${typeof acesso === "string" ? encodeURIComponent(acesso) : ""}`;
  if (oferta?.slug !== slug || !oferta.guardaRoupa) redirect(obrigado);
  const dados = await lerDados<DadosGuardaRoupa>(slug);
  const varios = oferta.guardaRoupa.length > 1;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-6">
        <Link href={obrigado} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--purple)]">
          <ArrowLeft size={16} weight="bold" aria-hidden />
          Voltar para os arquivos
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">Meu guarda-roupa</h1>
        <p className="mb-5 mt-1 text-[16px] leading-relaxed text-[var(--ink)]/80">
          {varios
            ? "Escolha quando a criança nasceu e o guarda-roupa dos tamanhos 1, 2 e 3 se monta sozinho: o que comprar para o calor e para o frio, e quando."
            : "Escolha quando a criança nasceu e o guarda-roupa do tamanho 1 se monta sozinho: o que comprar para o calor e para o frio, e quando."}
        </p>
        <AvisoNavegador />
        <MeuGuardaRoupa
          acesso={acesso as string}
          opcoes={{
            produto: oferta.nome,
            meses: dados.meses,
            anos: anosDeNascimento(),
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
