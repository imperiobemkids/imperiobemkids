import { randomBytes } from "node:crypto";
import { ErroIntegracao, clienteDoAdmin, lerConexao } from "@/lib/integracoesServidor";
import { buscarPedidos, conectarConta, configML, enviarEstoque, linkAutorizacao, listarAnuncios, tokenDaConta, type EstoqueEnviar } from "@/lib/mercadolivre/servidor";

/*
  Ponte do ERP com a API do Mercado Livre. Mesmas acoes e formatos da rota da
  Shopee (lib/integracoes.ts trata as duas igual). Toda acao e POST e exige
  login de administrador. O corpo pode trazer canalId (o canal do ERP que e
  esta conta).

  status    situacao da integracao (sem segredos)
  conectar  -> { url, state, verifier } do link de autorizacao (o retorno e o ML_REDIRECT_URI)
  token     { code, verifier, canalId } -> troca o codigo pelos tokens
  anuncios  -> anuncios ativos com variacoes e estoque atual
  pedidos   { dias } -> pedidos atualizados nos ultimos dias, com tarifa, frete e rastreio
  estoque   { itens: [{ idAnuncio, idVariacao, estoque }] } -> resultado por variacao
*/

export const maxDuration = 60;

// o ML aceita o filtro de data com fuso explicito
const isoComFuso = (d: Date) => d.toISOString().replace("Z", "-00:00");

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const { acao } = await ctx.params;
  const db = await clienteDoAdmin(req);
  if (db instanceof Response) return db;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const canalPedido = typeof corpo.canalId === "string" && corpo.canalId ? corpo.canalId : undefined;
  const cfg = configML();

  try {
    if (acao === "status") {
      let migracao = true;
      let conexao = null;
      try {
        const c = await lerConexao(db, "mercadolivre", canalPedido);
        if (c) conexao = { canal_id: c.canal_id, ambiente: c.ambiente, loja_id: c.loja_id, apelido: (c.extra?.apelido as string | null) ?? null, access_expira_em: c.access_expira_em, refresh_expira_em: c.refresh_expira_em, conectado_em: c.conectado_em, ultima_sync: c.ultima_sync };
      } catch (e) {
        if (e instanceof ErroIntegracao && e.codigo === "banco") migracao = false;
        else throw e;
      }
      return Response.json({ configurado: cfg.ok, ambiente: cfg.ambiente, migracao, conexao, retorno: cfg.redirect || null });
    }

    if (!cfg.ok) throw new ErroIntegracao("nao_configurado", "faltam ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI (https) no servidor");

    if (acao === "conectar") {
      const state = randomBytes(12).toString("hex");
      return Response.json({ ...linkAutorizacao(state), state });
    }

    if (acao === "token") {
      const code = String(corpo.code ?? "");
      if (!code) throw new ErroIntegracao("param", "codigo ausente no retorno do Mercado Livre");
      if (!canalPedido) throw new ErroIntegracao("param", "falta o canal do Mercado Livre no ERP (cadastre em Canais)");
      const r = await conectarConta(db, canalPedido, code, String(corpo.verifier ?? ""));
      return Response.json({ ok: true, ...r });
    }

    const { token, usuarioId, canalId } = await tokenDaConta(db, canalPedido);

    if (acao === "anuncios") {
      return Response.json({ anuncios: await listarAnuncios(token, usuarioId) });
    }

    if (acao === "pedidos") {
      const dias = Math.min(90, Math.max(1, Number(corpo.dias) || 15));
      const r = await buscarPedidos(token, usuarioId, isoComFuso(new Date(Date.now() - dias * 86400 * 1000)));
      await db.from("ibk_integracoes").update({ ultima_sync: new Date().toISOString() }).eq("canal_id", canalId);
      return Response.json(r);
    }

    if (acao === "estoque") {
      const itens = (Array.isArray(corpo.itens) ? corpo.itens : []) as EstoqueEnviar[];
      // anuncio do ML e "MLB" + numero; variacao e numero (ou vazio)
      const validos = itens.filter((i) => /^MLB\d+$/.test(String(i.idAnuncio)) && /^\d*$/.test(String(i.idVariacao ?? "")) && Number.isFinite(Number(i.estoque)));
      if (!validos.length) throw new ErroIntegracao("param", "nada para enviar");
      return Response.json({ resultados: await enviarEstoque(token, validos.map((i) => ({ idAnuncio: String(i.idAnuncio), idVariacao: String(i.idVariacao ?? ""), estoque: Number(i.estoque) }))) });
    }

    return Response.json({ erro: `acao desconhecida: ${acao}` }, { status: 404 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    const status = e instanceof ErroIntegracao && ["nao_conectado", "nao_configurado", "param", "banco", "ambiente"].includes(e.codigo) ? 409 : 502;
    return Response.json({ erro: msg, codigo: e instanceof ErroIntegracao ? e.codigo : undefined }, { status });
  }
}
