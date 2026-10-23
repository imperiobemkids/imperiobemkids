import type { NextRequest } from "next/server";
import { lerEntregavel } from "@/lib/checkout/entrega";
import { ofertaDoPedido, situacaoDoPedido } from "@/lib/checkout/ofertas";

/*
  Download dos arquivos pagos. Confere na AbacatePay, a cada download, que o
  pedido esta pago: reembolsou, o link para de funcionar. Oferta e arquivo
  saem da lista do servidor, nunca do caminho pedido na URL.
*/
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/entrega/[pedido]/[arquivo]">) {
  const { pedido, arquivo: id } = await ctx.params;
  const oferta = ofertaDoPedido(pedido);
  const arquivo = oferta?.principal.arquivos.find((a) => a.id === id);
  if (!oferta || !arquivo) return new Response("Arquivo não encontrado", { status: 404 });

  try {
    const { situacao } = await situacaoDoPedido(oferta, pedido);
    if (situacao !== "pago") return new Response("Pagamento não confirmado", { status: 403 });
    const conteudo = await lerEntregavel(oferta.slug, arquivo.id);
    return new Response(new Uint8Array(conteudo), {
      headers: {
        "Content-Type": arquivo.tipo,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("entrega", pedido, id, e);
    return new Response("Não deu para baixar agora. Tente de novo em instantes.", { status: 503 });
  }
}
