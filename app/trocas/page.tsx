import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao } from "../PaginaLegal";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description: "Como trocar de tamanho, devolver e pedir reembolso no Império Bem Kids. Prazos e regras claras.",
  alternates: { canonical: "/trocas" },
};

/*
  Regras da loja para compra direta (WhatsApp e site). O que e lei esta
  marcado (CDC). O que e politica da loja (troca de tamanho, frete) e decisao
  do Richard e pode mudar aqui sem mexer no resto.
*/
export default function TrocasPage() {
  return (
    <PaginaLegal
      titulo="Trocas e devoluções"
      resumo="Criança cresce rápido e tamanho engana. Se não deu certo, a gente resolve. Aqui está como funciona."
    >
      <Secao titulo="Comprou pela Shopee?">
        <p>
          Vale a política da Shopee: você pede a devolução dentro do app, em até 7 dias depois de receber, e o próprio
          app cuida do reembolso. Se precisar de ajuda com o pedido, chama a gente pelo chat da Shopee que a gente
          agiliza.
        </p>
      </Secao>

      <Secao titulo="Comprou direto com a gente (WhatsApp ou site)">
        <p>
          <strong>Arrependimento (lei):</strong> você tem 7 dias corridos, contados do recebimento, para desistir da
          compra sem precisar dizer o motivo (Código de Defesa do Consumidor, art. 49). A gente devolve o valor
          inteiro, incluindo o frete que você pagou.
        </p>
        <p>
          <strong>Troca de tamanho (política da loja):</strong> em até 7 dias corridos depois de receber, com a peça
          sem uso, sem lavar e com a etiqueta. A gente troca pelo tamanho que servir. O frete de volta é por sua conta
          e o de ida do novo tamanho é por nossa conta.
        </p>
        <p>
          <strong>Defeito (lei):</strong> se a peça veio com defeito de fabricação (costura aberta, estampa
          descascando na primeira lavagem, botão faltando), você tem 90 dias para reclamar (CDC, art. 26). A gente
          troca, conserta ou devolve o dinheiro, você escolhe, e o frete é todo por nossa conta.
        </p>
      </Secao>

      <Secao titulo="Como pedir">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Chama no{" "}
            <a href={EMPRESA.whatsappLink} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--purple)] underline">
              WhatsApp
            </a>{" "}
            com o número do pedido (ou a data e o nome) e uma foto da peça.
          </li>
          <li>A gente confirma em até 1 dia útil e passa o endereço ou a etiqueta de postagem.</li>
          <li>Assim que a peça chega aqui, a troca sai em até 2 dias úteis e o reembolso em até 5 dias úteis.</li>
        </ol>
      </Secao>

      <Secao titulo="Reembolso">
        <p>
          Devolvemos pelo mesmo meio que você pagou. Pix cai em até 5 dias úteis depois de recebermos a peça. Cartão
          segue o prazo da operadora, que costuma ser de uma a duas faturas.
        </p>
      </Secao>

      <Secao titulo="O que não dá para trocar">
        <p>
          Peça usada, lavada, sem etiqueta ou com cheiro de perfume e amaciante. Roupa íntima e meia, por higiene,
          só com defeito de fabricação.
        </p>
      </Secao>

      <Secao titulo="Dados da loja">
        <p>
          {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}. {EMPRESA.endereco}, {EMPRESA.cidadeUf}, CEP {EMPRESA.cep}.
          E-mail {EMPRESA.email}.
        </p>
        <p>
          Veja também a <Link href="/privacidade" className="font-bold text-[var(--purple)] underline">política de privacidade</Link>.
        </p>
      </Secao>
    </PaginaLegal>
  );
}
