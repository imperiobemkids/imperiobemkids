import type { NextRequest } from "next/server";
import { lerEntregavel } from "@/lib/checkout/entrega";
import { ofertaDoAcesso } from "@/lib/checkout/ofertas";

/*
  Entrega dos arquivos pagos, pelos links das aulas da area de membros. So abre
  com o codigo de acesso da oferta. Oferta e arquivo saem da lista do servidor,
  nunca do caminho pedido na URL. PDF abre no navegador, o que no celular
  funciona melhor do que baixar; a planilha baixa, porque o navegador nao abre xlsx.
*/
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/entrega/[acesso]/[arquivo]">) {
  const { acesso, arquivo: id } = await ctx.params;
  const oferta = ofertaDoAcesso(acesso);
  const arquivo = oferta?.arquivos.find((a) => a.id === id);
  if (!oferta || !arquivo) return new Response("Arquivo não encontrado", { status: 404 });

  try {
    const conteudo = await lerEntregavel(oferta.slug, arquivo.id);
    return new Response(new Uint8Array(conteudo), {
      headers: {
        "Content-Type": arquivo.tipo,
        "Content-Disposition": `${arquivo.tipo === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    console.error("entrega", oferta.slug, id, e);
    return new Response("Não deu para baixar agora. Tente de novo em instantes.", { status: 503 });
  }
}
