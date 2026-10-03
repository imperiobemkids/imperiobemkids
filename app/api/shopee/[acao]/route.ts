import { randomBytes } from "node:crypto";
import { ErroIntegracao, clienteDoAdmin, lerConexao } from "@/lib/integracoesServidor";
import {
  buscarPedidos,
  conectarLoja,
  configShopee,
  enviarEstoque,
  linkAutorizacao,
  listarAnuncios,
  tokenDaLoja,
  type EstoqueEnviar,
} from "@/lib/shopee/servidor";

/*
  Ponte do ERP com a API da Shopee. Toda acao e POST, exige login de
  administrador (cabecalho Authorization com o token do Supabase) e responde
  { erro } com a mensagem pronta para a tela quando algo falha. O corpo pode
  trazer canalId (o canal do ERP que e esta loja); sem ele, vale a loja Shopee
  conectada.

  Cada plataforma tem a sua rota (app/api/<plataforma>/[acao]) com as MESMAS
  acoes e formatos, para o ERP tratar todas igual (lib/integracoes.ts):
  status    situacao da integracao (sem segredos)
  conectar  { retorno } -> { url, state } do link de autorizacao da loja
  token     { code, shopId, canalId } -> troca o codigo da autorizacao pelos tokens
  anuncios  -> anuncios ativos com variacoes e estoque atual
  pedidos   { dias } -> pedidos atualizados nos ultimos dias, com taxas reais
  estoque   { itens: [{ idAnuncio, idVariacao, estoque }] } -> resultado por variacao
*/

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ acao: string }> }) {
  const { acao } = await ctx.params;
  const db = await clienteDoAdmin(req);
  if (db instanceof Response) return db;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const canalPedido = typeof corpo.canalId === "string" && corpo.canalId ? corpo.canalId : undefined;
  const cfg = configShopee();

  try {
    if (acao === "status") {
      let migracao = true;
      let conexao = null;
      try {
        const c = await lerConexao(db, "shopee", canalPedido);
        // sem os tokens: a tela so precisa saber se e quando conectou
        if (c) conexao = { canal_id: c.canal_id, ambiente: c.ambiente, loja_id: c.loja_id, access_expira_em: c.access_expira_em, refresh_expira_em: c.refresh_expira_em, conectado_em: c.conectado_em, ultima_sync: c.ultima_sync };
      } catch (e) {
        if (e instanceof ErroIntegracao && e.codigo === "banco") migracao = false;
        else throw e;
      }
      return Response.json({ configurado: cfg.ok, ambiente: cfg.ambiente, migracao, conexao });
    }

    if (!cfg.ok) throw new ErroIntegracao("nao_configurado", "faltam SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY no servidor");

    if (acao === "conectar") {
      const retorno = String(corpo.retorno ?? "");
      if (!/^https?:\/\//.test(retorno)) throw new ErroIntegracao("param", "endereco de retorno invalido");
      const state = randomBytes(12).toString("hex");
      return Response.json({ url: linkAutorizacao(retorno, state), state });
    }

    if (acao === "token") {
      const code = String(corpo.code ?? "");
      const lojaId = Number(corpo.shopId);
      if (!code || !Number.isInteger(lojaId) || lojaId <= 0) throw new ErroIntegracao("param", "codigo ou loja ausente no retorno da Shopee");
      if (!canalPedido) throw new ErroIntegracao("param", "falta o canal da Shopee no ERP (cadastre em Canais)");
      await conectarLoja(db, canalPedido, code, lojaId);
      return Response.json({ ok: true, lojaId });
    }

    const { token, lojaId, canalId } = await tokenDaLoja(db, canalPedido);

    if (acao === "anuncios") {
      return Response.json({ anuncios: await listarAnuncios(token, lojaId) });
    }

    if (acao === "pedidos") {
      const dias = Math.min(90, Math.max(1, Number(corpo.dias) || 15));
      const r = await buscarPedidos(token, lojaId, Math.floor(Date.now() / 1000) - dias * 86400);
      await db.from("ibk_integracoes").update({ ultima_sync: new Date().toISOString() }).eq("canal_id", canalId);
      return Response.json(r);
    }

    if (acao === "estoque") {
      const itens = (Array.isArray(corpo.itens) ? corpo.itens : []) as EstoqueEnviar[];
      const validos = itens.filter((i) => /^\d+$/.test(String(i.idAnuncio)) && /^\d*$/.test(String(i.idVariacao ?? "")) && Number.isFinite(Number(i.estoque)));
      if (!validos.length) throw new ErroIntegracao("param", "nada para enviar");
      return Response.json({ resultados: await enviarEstoque(token, lojaId, validos.map((i) => ({ idAnuncio: String(i.idAnuncio), idVariacao: String(i.idVariacao ?? ""), estoque: Number(i.estoque) }))) });
    }

    return Response.json({ erro: `acao desconhecida: ${acao}` }, { status: 404 });
  } catch (e) {
    const msg = e instanceof ErroIntegracao ? `${e.message}${e.requestId ? ` (request_id ${e.requestId})` : ""}` : e instanceof Error ? e.message : "erro";
    const status = e instanceof ErroIntegracao && ["nao_conectado", "nao_configurado", "param", "banco", "ambiente"].includes(e.codigo) ? 409 : 502;
    return Response.json({ erro: msg, codigo: e instanceof ErroIntegracao ? e.codigo : undefined }, { status });
  }
}
