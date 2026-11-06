import type { NextRequest } from "next/server";
import { montarLista, type DadosCalendario } from "@/lib/checkout/calendario";
import { lerDados } from "@/lib/checkout/entrega";
import { ofertaDoAcesso } from "@/lib/checkout/ofertas";

/*
  Conta da pagina Minha lista: recebe mes do parto, regiao e lavagem e devolve
  as quantidades daquela combinacao. So responde com o codigo de acesso da
  oferta. A tabela inteira nunca sai daqui.
*/
const privado = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(req: NextRequest, ctx: RouteContext<"/api/lista/[acesso]">) {
  const { acesso } = await ctx.params;
  const oferta = ofertaDoAcesso(acesso);
  if (!oferta?.temLista) return Response.json({ erro: "acesso invalido" }, { status: 403, headers: privado });

  const q = req.nextUrl.searchParams;
  const mes = Number(q.get("mes"));
  const dias = Number(q.get("dias"));
  try {
    const dados = await lerDados<DadosCalendario>(oferta.slug);
    const valido = Number.isInteger(mes) && mes >= 1 && mes <= 12 && dados.dias_entre_lavagens_opcoes.includes(dias);
    const lista = valido ? montarLista(dados, mes, q.get("regiao") ?? "", dias) : null;
    if (!lista) return Response.json({ erro: "escolha invalida" }, { status: 400, headers: privado });
    return Response.json(lista, { headers: privado });
  } catch (e) {
    console.error("lista", oferta.slug, e);
    return Response.json({ erro: "indisponivel" }, { status: 503, headers: privado });
  }
}
