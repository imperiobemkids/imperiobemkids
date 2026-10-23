import { OFERTA_ENXOVAL } from "@/lib/ofertas/enxoval";
import { SITE } from "@/lib/seo";
import manifesto from "@/entregaveis/manifesto.json";
import { abacatepayConfigurado, buscarCheckout, type Checkout } from "./abacatepay";

/*
  O que cada oferta low ticket vende pelo checkout proprio (AbacatePay).
  Oferta nova entra aqui, com os arquivos dela em entregaveis/manifesto.json.

  O externalId do produto leva o preco em centavos: mudou o preco, nasce um
  produto novo na AbacatePay, porque a API dela nao edita produto.

  A venda so liga com a oferta listada em VENDA_ATIVA (separada por virgula)
  e a chave da AbacatePay configurada. Com a conta em modo de teste, VENDA_ATIVA
  fica so no .env.local e no ambiente Preview da Vercel, nunca em Production.
*/

export type Arquivo = { id: string; nome: string; tipo: string };

export type ProdutoVenda = {
  externalId: string;
  nome: string;
  descricao: string;
  preco: number; // centavos
  imagem: string;
  arquivos: Arquivo[];
};

export type OfertaVenda = {
  slug: string;
  pagina: string;
  principal: ProdutoVenda;
};

const centavos = (reais: number) => Math.round(reais * 100);

export const OFERTAS_VENDA: Record<string, OfertaVenda> = {
  [OFERTA_ENXOVAL.id]: {
    slug: OFERTA_ENXOVAL.id,
    pagina: "/enxoval",
    principal: {
      externalId: `${OFERTA_ENXOVAL.id}-${centavos(OFERTA_ENXOVAL.preco)}`,
      nome: OFERTA_ENXOVAL.nomeCurto,
      descricao: "Planilha e guia para montar o enxoval do bebê pelo mês do parto, do RN ao GG.",
      preco: centavos(OFERTA_ENXOVAL.preco),
      imagem: `${SITE}/enxoval/guia-capa.webp`,
      arquivos: manifesto[OFERTA_ENXOVAL.id as keyof typeof manifesto],
    },
  },
};

export function vendaAtiva(slug: string): boolean {
  const ativas = (process.env.VENDA_ATIVA ?? "").split(",").map((s) => s.trim());
  return abacatepayConfigurado && slug in OFERTAS_VENDA && ativas.includes(slug);
}

/* ---------- pedido ---------- */

/*
  O numero do pedido e "<oferta>-<uuid>". Ele vai como externalId do checkout
  e volta na pagina de obrigado, e e o que da acesso aos arquivos: quem tem o
  link baixa, desde que a AbacatePay diga que aquele checkout esta pago.
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const novoPedido = (slug: string) => `${slug}-${crypto.randomUUID()}`;

export function ofertaDoPedido(pedido: string): OfertaVenda | null {
  if (pedido.length < 38 || !UUID.test(pedido.slice(-36))) return null;
  return OFERTAS_VENDA[pedido.slice(0, -37)] ?? null;
}

export type Situacao = "pago" | "aguardando" | "reembolsado" | "expirado" | "nao-encontrado";

export async function situacaoDoPedido(
  oferta: OfertaVenda,
  pedido: string,
): Promise<{ situacao: Situacao; checkout?: Checkout }> {
  if (ofertaDoPedido(pedido)?.slug !== oferta.slug) return { situacao: "nao-encontrado" };
  // so este servidor cria checkout com a chave da conta, e o pedido ja diz a
  // oferta; nao confere o produto, para um preco novo nao tirar o acesso de
  // quem comprou antes
  const checkout = await buscarCheckout(pedido);
  if (!checkout || checkout.externalId !== pedido) return { situacao: "nao-encontrado" };
  const situacao: Situacao =
    checkout.status === "PAID" || checkout.status === "REDEEMED"
      ? "pago"
      : checkout.status === "PENDING"
        ? "aguardando"
        : checkout.status === "REFUNDED"
          ? "reembolsado"
          : "expirado";
  return { situacao, checkout };
}
