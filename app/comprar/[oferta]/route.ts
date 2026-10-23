import type { NextRequest } from "next/server";
import { criarCheckout, garantirProduto } from "@/lib/checkout/abacatepay";
import { OFERTAS_VENDA, novoPedido, vendaAtiva } from "@/lib/checkout/ofertas";

/*
  Botao de comprar das paginas de venda. E um form POST, nunca link: robo de
  busca e pre-carregamento de pagina nao criam cobranca. Cria o checkout na
  AbacatePay e manda a pessoa para la. O numero do pedido volta na pagina de
  obrigado, que confere o pagamento na AbacatePay antes de liberar os arquivos.
*/
export async function POST(req: NextRequest, ctx: RouteContext<"/comprar/[oferta]">) {
  const { oferta: slug } = await ctx.params;
  const oferta = OFERTAS_VENDA[slug];
  if (!oferta || !vendaAtiva(slug)) return new Response("Oferta indisponível", { status: 404 });

  const origem = req.nextUrl.origin;
  const pedido = novoPedido(slug);
  try {
    const p = oferta.principal;
    const produto = await garantirProduto({
      externalId: p.externalId,
      name: p.nome,
      description: p.descricao,
      price: p.preco,
      imageUrl: p.imagem,
    });
    const checkout = await criarCheckout({
      items: [{ id: produto.id, quantity: 1 }],
      methods: ["PIX", "CARD"],
      // abaixo de R$ 20 nao cabe parcela (minimo de R$ 10 cada)
      card: { maxInstallments: 1 },
      externalId: pedido,
      returnUrl: `${origem}${oferta.pagina}`,
      completionUrl: `${origem}/obrigado/${slug}?pedido=${pedido}`,
      // para a API de Conversoes reconhecer quem clicou no anuncio
      metadata: {
        oferta: slug,
        fbp: req.cookies.get("_fbp")?.value,
        fbc: req.cookies.get("_fbc")?.value,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        ua: req.headers.get("user-agent") ?? undefined,
      },
    });
    const destino = new URL(checkout.url);
    // produto digital: o checkout nao pede endereco
    destino.searchParams.set("skip_address", "true");
    return Response.redirect(destino, 303);
  } catch (e) {
    console.error("comprar", slug, e);
    return Response.redirect(new URL(`/obrigado/${slug}?erro=1`, origem), 303);
  }
}
