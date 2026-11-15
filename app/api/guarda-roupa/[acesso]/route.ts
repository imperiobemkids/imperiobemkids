import type { NextRequest } from "next/server";
import { lerDados } from "@/lib/checkout/entrega";
import { montarGuardaRoupa, type DadosGuardaRoupa } from "@/lib/checkout/guardaRoupa";
import { ofertaDoAcesso } from "@/lib/checkout/ofertas";

/*
  Conta da pagina Meu guarda-roupa: recebe mes e ano de nascimento, regiao e
  lavagem e devolve o guarda-roupa daquela combinacao, so com os tamanhos que a
  oferta vende. So responde com o codigo de acesso da oferta. A tabela inteira
  nunca sai daqui.
*/
const privado = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function GET(req: NextRequest, ctx: RouteContext<"/api/guarda-roupa/[acesso]">) {
  const { acesso } = await ctx.params;
  const oferta = ofertaDoAcesso(acesso);
  if (!oferta?.guardaRoupa) return Response.json({ erro: "acesso invalido" }, { status: 403, headers: privado });

  const q = req.nextUrl.searchParams;
  const mes = Number(q.get("mes"));
  const ano = Number(q.get("ano"));
  const dias = Number(q.get("dias"));
  try {
    const dados = await lerDados<DadosGuardaRoupa>(oferta.slug);
    const valido =
      Number.isInteger(mes) && mes >= 1 && mes <= 12 &&
      Number.isInteger(ano) && ano >= 2015 && ano <= 2040 &&
      dados.dias_entre_lavagens_opcoes.includes(dias);
    const guarda = valido ? montarGuardaRoupa(dados, mes, ano, q.get("regiao") ?? "", dias, oferta.guardaRoupa) : null;
    if (!guarda) return Response.json({ erro: "escolha invalida" }, { status: 400, headers: privado });
    return Response.json(guarda, { headers: privado });
  } catch (e) {
    console.error("guarda-roupa", oferta.slug, e);
    return Response.json({ erro: "indisponivel" }, { status: 503, headers: privado });
  }
}
