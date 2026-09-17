import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao } from "../PaginaLegal";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Império Bem Kids coleta, para que usa e como você pede para apagar.",
  alternates: { canonical: "/privacidade" },
  robots: { index: true, follow: true },
};

/*
  Escrita para ser lida, nao para assustar. Diz o que de fato acontece no
  site: Pixel da Meta, conversa no WhatsApp e mais nada. Se entrar cadastro,
  newsletter ou checkout proprio, esta pagina precisa mudar junto.
*/
export default function PrivacidadePage() {
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      resumo="A gente coleta pouco, e conta aqui exatamente o quê. Vale para o site e para o atendimento pelo WhatsApp."
    >
      <Secao titulo="Quem cuida dos seus dados">
        <p>
          {EMPRESA.razaoSocial} ({EMPRESA.nomeFantasia}), CNPJ {EMPRESA.cnpj}, com endereço em {EMPRESA.endereco},{" "}
          {EMPRESA.cidadeUf}. Para qualquer assunto sobre privacidade, fale pelo e-mail {EMPRESA.email} ou pelo{" "}
          <a href={EMPRESA.whatsappLink} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--purple)] underline">
            WhatsApp
          </a>
          .
        </p>
      </Secao>

      <Secao titulo="O que a gente coleta no site">
        <p>
          O site usa o <strong>Pixel da Meta</strong> (Facebook e Instagram). Ele grava um cookie no seu navegador e
          registra que você visitou nossas páginas. A gente usa isso para saber se os anúncios estão trazendo gente
          e para mostrar nossos produtos para quem já passou por aqui. A Meta também recebe esses dados, conforme a
          política dela.
        </p>
        <p>
          Não pedimos cadastro, e-mail ou senha para navegar. As páginas de acesso restrito servem só para a equipe da
          loja.
        </p>
      </Secao>

      <Secao titulo="O que a gente coleta quando você compra ou fala com a gente">
        <p>
          Pelo <strong>WhatsApp</strong>: seu nome, número e o que você escreveu. Se fechar um pedido, também o
          endereço de entrega e a forma de pagamento. Usamos isso para atender, entregar e, se você topar, avisar de
          promoções e novidades no tamanho do seu filho.
        </p>
        <p>
          Pela <strong>Shopee</strong> ou outro marketplace: a plataforma é quem coleta e guarda seus dados. A gente
          só recebe o necessário para enviar o pedido, e segue a política de privacidade da plataforma.
        </p>
      </Secao>

      <Secao titulo="Com quem a gente compartilha">
        <p>
          Com a transportadora ou os Correios, para entregar. Com a Meta, pelo Pixel. Com o emissor de nota fiscal,
          quando a lei exige. Não vendemos nem alugamos sua lista de contato para ninguém.
        </p>
      </Secao>

      <Secao titulo="Por quanto tempo">
        <p>
          Dados de pedido ficam guardados pelo prazo que a lei fiscal manda (cinco anos). Conversas de WhatsApp sem
          compra a gente apaga quando deixam de ser úteis. Os cookies do Pixel duram até 90 dias.
        </p>
      </Secao>

      <Secao titulo="Seus direitos (LGPD)">
        <p>
          Você pode pedir a qualquer momento: saber quais dados temos sobre você, corrigir, apagar, ou parar de receber
          mensagens. É só mandar um WhatsApp ou e-mail. A gente responde em até 15 dias.
        </p>
        <p>
          Para bloquear o Pixel, use a opção de anúncios do seu navegador ou as configurações de privacidade da sua
          conta Meta.
        </p>
      </Secao>

      <Secao titulo="Mudanças">
        <p>
          Se esta política mudar, a data no fim da página muda junto. Mudança grande a gente avisa no site e no grupo de
          achadinhos.
        </p>
        <p>
          Veja também a <Link href="/trocas" className="font-bold text-[var(--purple)] underline">política de trocas e devoluções</Link>.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
