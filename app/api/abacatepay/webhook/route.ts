import { after, type NextRequest } from "next/server";
import { avisoAutentico, buscarCheckout, type AvisoAbacatePay } from "@/lib/checkout/abacatepay";
import { ofertaDoPedido } from "@/lib/checkout/ofertas";
import { compraNaMeta } from "@/lib/checkout/meta";
import { SITE } from "@/lib/seo";

/*
  Aviso de pagamento da AbacatePay (webhook com o evento checkout.completed).
  Cadastrar como https://www.imperiobemkids.com.br/api/abacatepay/webhook?webhookSecret=<segredo>.
  A entrega NAO depende daqui (a pagina de obrigado confere o pagamento
  sozinha); o aviso so manda a compra para a Meta pelo servidor. Responde 200
  na hora e trabalha depois, porque a AbacatePay desiste em 30 segundos e
  reenvia. Reenvio nao duplica: a Meta descarta o mesmo event_id.
*/
export async function POST(req: NextRequest) {
  const corpo = await req.text();
  const autentico = avisoAutentico(
    corpo,
    req.nextUrl.searchParams.get("webhookSecret"),
    req.headers.get("x-webhook-signature"),
  );
  if (!autentico) return Response.json({ erro: "aviso nao autenticado" }, { status: 401 });

  const aviso = JSON.parse(corpo) as AvisoAbacatePay;
  if (aviso.event === "checkout.completed") {
    after(() => compraPeloServidor(aviso).catch((e) => console.error("webhook abacatepay", aviso.id, e)));
  }
  return Response.json({ ok: true });
}

async function compraPeloServidor(aviso: AvisoAbacatePay) {
  const pedido = aviso.data.checkout?.externalId;
  // compra de teste nao vai para a Meta; upsell ainda nao existe em nenhuma oferta
  if (aviso.devMode || !pedido || aviso.data.checkout?.isUpSell) return;
  const oferta = ofertaDoPedido(pedido);
  if (!oferta) return;
  const checkout = await buscarCheckout(pedido);
  if (!checkout || checkout.status !== "PAID") return;
  const m = (checkout.metadata ?? {}) as Record<string, string | undefined>;
  await compraNaMeta({
    eventoId: checkout.id,
    valor: oferta.principal.preco / 100,
    produto: oferta.principal.externalId,
    url: `${SITE}/obrigado/${oferta.slug}`,
    email: aviso.data.customer?.email,
    fbp: m.fbp,
    fbc: m.fbc,
    ip: m.ip,
    ua: m.ua,
  });
}
