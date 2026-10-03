import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemImportado, PedidoImportado, StatusImportado } from "../importacao";
import { ErroIntegracao, acessoValido, guardarTokens, type Ambiente, type Tokens } from "../integracoesServidor";

/*
  Shopee Open Platform (API v2), lado do servidor. So as rotas de
  app/api/shopee usam este arquivo: a Partner Key e os tokens da loja nunca
  chegam ao navegador. Quem chama, cofre e conexao sao comuns a todas as
  plataformas (lib/integracoesServidor.ts).

  Variaveis (no .env.local e na Vercel, nunca com NEXT_PUBLIC_):
    SHOPEE_PARTNER_ID   numero do app no console da Shopee
    SHOPEE_PARTNER_KEY  chave secreta do app
    SHOPEE_AMBIENTE     "teste" (sandbox, padrao) ou "producao"

  Enderecos conferidos na documentacao em 03/10/2026: producao do Brasil em
  openplatform.shopee.com.br; o sandbox da API e o global (.sg), mas o link de
  autorizacao do sandbox e o do Brasil.
*/

const HOSTS: Record<Ambiente, { api: string; auth: string }> = {
  producao: { api: "https://openplatform.shopee.com.br", auth: "https://open.shopee.com.br/auth" },
  teste: { api: "https://openplatform.sandbox.test-stable.shopee.sg", auth: "https://open.sandbox.test-stable.shopee.com.br/auth" },
};

export function configShopee() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID ?? "");
  const partnerKey = process.env.SHOPEE_PARTNER_KEY ?? "";
  const ambiente: Ambiente = process.env.SHOPEE_AMBIENTE === "producao" ? "producao" : "teste";
  return { ok: Number.isInteger(partnerId) && partnerId > 0 && partnerKey.length > 0, partnerId, partnerKey, ambiente, ...HOSTS[ambiente] };
}

type Query = Record<string, string | number | boolean | undefined>;

/*
  Toda chamada leva partner_id, timestamp e sign na query. O sign e o
  HMAC-SHA256 (hex minusculo) de partner_id + caminho + timestamp, e nas APIs
  da loja tambem + access_token + shop_id, com a Partner Key de chave.
*/
export async function chamar<T>(
  caminho: string,
  op: { metodo?: "GET" | "POST"; query?: Query; corpo?: unknown; token?: string; lojaId?: number } = {},
): Promise<T> {
  const c = configShopee();
  if (!c.ok) throw new ErroIntegracao("nao_configurado", "faltam SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY no servidor");
  const ts = Math.floor(Date.now() / 1000);
  const base = `${c.partnerId}${caminho}${ts}${op.token ?? ""}${op.lojaId ?? ""}`;
  const url = new URL(c.api + caminho);
  url.searchParams.set("partner_id", String(c.partnerId));
  url.searchParams.set("timestamp", String(ts));
  url.searchParams.set("sign", createHmac("sha256", c.partnerKey).update(base).digest("hex"));
  if (op.token) url.searchParams.set("access_token", op.token);
  if (op.lojaId) url.searchParams.set("shop_id", String(op.lojaId));
  for (const [k, v] of Object.entries(op.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: op.metodo ?? "GET",
    headers: op.corpo ? { "Content-Type": "application/json" } : undefined,
    body: op.corpo ? JSON.stringify(op.corpo) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { error?: string; message?: string; request_id?: string } | null;
  if (!json) throw new ErroIntegracao("resposta_invalida", `a Shopee respondeu ${res.status} sem JSON`);
  if (json.error) throw new ErroIntegracao(json.error, json.message || json.error, json.request_id);
  return json as T;
}

/* ---------- autorizacao da loja ---------- */

export function linkAutorizacao(redirect: string, state: string) {
  const c = configShopee();
  const u = new URL(c.auth);
  u.searchParams.set("partner_id", String(c.partnerId));
  u.searchParams.set("auth_type", "seller");
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

type RespostaToken = { access_token: string; refresh_token: string; expire_in: number };

// access_token da Shopee vale 4 horas; refresh_token, 30 dias
const paraTokens = (r: RespostaToken): Tokens => ({ access: r.access_token, refresh: r.refresh_token, expiraEmSeg: r.expire_in || 14400, refreshDias: 30 });

/* troca o codigo da autorizacao pelos tokens e grava a loja no canal */
export async function conectarLoja(db: SupabaseClient, canalId: string, code: string, lojaId: number) {
  const c = configShopee();
  const r = await chamar<RespostaToken>("/api/v2/auth/token/get", { metodo: "POST", corpo: { code, shop_id: lojaId, partner_id: c.partnerId } });
  await guardarTokens(db, { canal_id: canalId, plataforma: "shopee", ambiente: c.ambiente, loja_id: String(lojaId) }, paraTokens(r), c.partnerKey, true);
}

/* token valido da loja (renova sozinho quando falta pouco para vencer) */
export async function tokenDaLoja(db: SupabaseClient, canalId?: string): Promise<{ token: string; lojaId: number; canalId: string }> {
  const c = configShopee();
  const { token, conexao } = await acessoValido(db, "shopee", canalId, c.partnerKey, c.ambiente, async (refresh, con) =>
    paraTokens(
      await chamar<RespostaToken>("/api/v2/auth/access_token/get", {
        metodo: "POST",
        corpo: { refresh_token: refresh, shop_id: Number(con.loja_id), partner_id: c.partnerId },
      }),
    ),
  );
  return { token, lojaId: Number(conexao.loja_id), canalId: conexao.canal_id };
}

/* ---------- anuncios ---------- */

type InfoPreco = { current_price?: number; original_price?: number };
type InfoEstoque = { summary_info?: { total_available_stock?: number; total_reserved_stock?: number }; seller_stock?: { stock?: number }[] };

export type ModeloAnuncio = { idVariacao: string; nome: string; sku: string; estoque: number; reservado: number; preco: number };
export type Anuncio = { idAnuncio: string; titulo: string; sku: string; modelos: ModeloAnuncio[] };

const estoqueDe = (s?: InfoEstoque) => {
  const vendedor = s?.seller_stock?.reduce((t, x) => t + (x.stock ?? 0), 0);
  return { estoque: vendedor ?? s?.summary_info?.total_available_stock ?? 0, reservado: s?.summary_info?.total_reserved_stock ?? 0 };
};

const lotes = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

export async function listarAnuncios(token: string, lojaId: number): Promise<Anuncio[]> {
  // 1) ids dos anuncios ativos, de 100 em 100
  const ids: number[] = [];
  for (let offset = 0; ; ) {
    const r = await chamar<{ response?: { item?: { item_id: number }[]; has_next_page?: boolean; next_offset?: number } }>(
      "/api/v2/product/get_item_list",
      { token, lojaId, query: { offset, page_size: 100, item_status: "NORMAL" } },
    );
    ids.push(...(r.response?.item ?? []).map((i) => i.item_id));
    if (!r.response?.has_next_page || r.response.next_offset == null) break;
    offset = r.response.next_offset;
  }

  // 2) dados basicos de 50 em 50
  type Base = { item_id: number; item_name: string; item_sku?: string; has_model?: boolean; price_info?: InfoPreco[]; stock_info_v2?: InfoEstoque };
  const bases: Base[] = [];
  for (const grupo of lotes(ids, 50)) {
    const r = await chamar<{ response?: { item_list?: Base[] } }>("/api/v2/product/get_item_base_info", {
      token, lojaId, query: { item_id_list: grupo.join(",") },
    });
    bases.push(...(r.response?.item_list ?? []));
  }

  // 3) variacoes; o nome sai das opcoes (tier_index aponta para a opcao de cada nivel)
  type Modelo = { model_id: number; model_sku?: string; tier_index?: number[]; price_info?: InfoPreco[]; stock_info_v2?: InfoEstoque };
  type Tier = { name?: string; option_list?: { option?: string }[] };
  const out: Anuncio[] = [];
  for (const b of bases) {
    const a: Anuncio = { idAnuncio: String(b.item_id), titulo: b.item_name, sku: b.item_sku ?? "", modelos: [] };
    if (b.has_model) {
      const r = await chamar<{ response?: { tier_variation?: Tier[]; model?: Modelo[] } }>("/api/v2/product/get_model_list", {
        token, lojaId, query: { item_id: b.item_id },
      });
      const tiers = r.response?.tier_variation ?? [];
      for (const m of r.response?.model ?? []) {
        const nome = (m.tier_index ?? []).map((ix, k) => tiers[k]?.option_list?.[ix]?.option ?? "").filter(Boolean).join(", ");
        a.modelos.push({ idVariacao: String(m.model_id), nome, sku: m.model_sku ?? "", preco: m.price_info?.[0]?.current_price ?? 0, ...estoqueDe(m.stock_info_v2) });
      }
    } else {
      a.modelos.push({ idVariacao: "", nome: "", sku: b.item_sku ?? "", preco: b.price_info?.[0]?.current_price ?? 0, ...estoqueDe(b.stock_info_v2) });
    }
    out.push(a);
  }
  return out;
}

/* ---------- estoque ---------- */

export type EstoqueEnviar = { idAnuncio: string; idVariacao: string; estoque: number };
export type ResultadoEstoque = EstoqueEnviar & { ok: boolean; motivo?: string };

/*
  update_stock mexe so no "seller_stock", um anuncio por chamada, ate 50
  variacoes. A Shopee recusa estoque abaixo do reservado em promocao e
  anuncio em promocao em andamento: volta como falha com o motivo.
*/
export async function enviarEstoque(token: string, lojaId: number, itens: EstoqueEnviar[]): Promise<ResultadoEstoque[]> {
  const porAnuncio = new Map<string, EstoqueEnviar[]>();
  for (const i of itens) porAnuncio.set(i.idAnuncio, [...(porAnuncio.get(i.idAnuncio) ?? []), i]);
  const out: ResultadoEstoque[] = [];
  for (const [idAnuncio, lista] of porAnuncio) {
    for (const grupo of lotes(lista, 50)) {
      try {
        const r = await chamar<{ response?: { failure_list?: { model_id: number; failed_reason?: string }[] } }>("/api/v2/product/update_stock", {
          metodo: "POST", token, lojaId,
          corpo: {
            item_id: Number(idAnuncio),
            stock_list: grupo.map((g) => ({ model_id: Number(g.idVariacao || 0), seller_stock: [{ stock: Math.max(0, Math.floor(g.estoque)) }] })),
          },
        });
        const falhas = new Map((r.response?.failure_list ?? []).map((f) => [String(f.model_id), f.failed_reason ?? "recusado"]));
        for (const g of grupo) {
          const motivo = falhas.get(g.idVariacao || "0");
          out.push({ ...g, ok: !motivo, motivo });
        }
      } catch (e) {
        const motivo = e instanceof Error ? e.message : "erro";
        for (const g of grupo) out.push({ ...g, ok: false, motivo });
      }
    }
  }
  return out;
}

/* ---------- pedidos ---------- */

export type PedidoShopee = PedidoImportado & { repasse: number | null };

/* status da Shopee -> status daqui ("ignorar" = nao pago, ainda nao e venda) */
const STATUS: Record<string, StatusImportado> = {
  UNPAID: "ignorar",
  PENDING: "aguardando",
  READY_TO_SHIP: "aguardando",
  PROCESSED: "aguardando",
  INVOICE_PENDING: "aguardando",
  RETRY_SHIP: "aguardando",
  SHIPPED: "enviado",
  TO_CONFIRM_RECEIVE: "enviado",
  COMPLETED: "entregue",
  IN_CANCEL: "cancelado",
  CANCELLED: "cancelado",
  TO_RETURN: "devolvido",
};

// a data do pedido no fuso da loja (o servidor da Vercel roda em UTC)
const dataLocal = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

type ItemPedido = {
  item_id: number; item_name: string; item_sku?: string; model_id?: number; model_name?: string; model_sku?: string;
  model_quantity_purchased: number; model_original_price?: number; model_discounted_price?: number;
};
type Detalhe = {
  order_sn: string; order_status: string; create_time: number; buyer_username?: string;
  item_list?: ItemPedido[]; package_list?: { tracking_number?: string }[];
};
type Renda = Partial<Record<
  | "escrow_amount" | "commission_fee" | "service_fee" | "seller_transaction_fee" | "seller_order_processing_fee"
  | "order_ams_commission_fee" | "campaign_fee" | "buyer_paid_shipping_fee",
  number
>>;

// o que a Shopee desconta do vendedor no pedido (fora frete, que tem regra propria)
const TAXAS: (keyof Renda)[] = ["commission_fee", "service_fee", "seller_transaction_fee", "seller_order_processing_fee", "order_ams_commission_fee", "campaign_fee"];

/*
  Pedidos atualizados entre "desde" e agora (update_time pega tambem mudanca
  de status de pedido antigo). A Shopee aceita janela de no maximo 15 dias.
  Para cada pedido pago busca o extrato (escrow) com as taxas reais.
*/
export async function buscarPedidos(token: string, lojaId: number, desdeUnix: number, limite = 150): Promise<{ pedidos: PedidoShopee[]; cortado: boolean }> {
  const agora = Math.floor(Date.now() / 1000);
  const sns: string[] = [];
  let cortado = false;
  // do mais novo para o mais velho: se passar do limite, ficam de fora os antigos
  for (let ate = agora; ate > desdeUnix && !cortado; ate -= 15 * 86400) {
    const de = Math.max(desdeUnix, ate - 15 * 86400);
    let cursor = "";
    for (;;) {
      const r = await chamar<{ response?: { order_list?: { order_sn: string }[]; more?: boolean; next_cursor?: string } }>(
        "/api/v2/order/get_order_list",
        { token, lojaId, query: { time_range_field: "update_time", time_from: de, time_to: ate, page_size: 100, cursor } },
      );
      for (const o of r.response?.order_list ?? []) if (!sns.includes(o.order_sn)) sns.push(o.order_sn);
      if (sns.length >= limite) { cortado = true; break; }
      if (!r.response?.more || !r.response.next_cursor) break;
      cursor = r.response.next_cursor;
    }
  }

  const detalhes: Detalhe[] = [];
  for (const grupo of lotes(sns.slice(0, limite), 50)) {
    const r = await chamar<{ response?: { order_list?: Detalhe[] } }>("/api/v2/order/get_order_detail", {
      token, lojaId,
      query: { order_sn_list: grupo.join(","), response_optional_fields: "buyer_username,item_list,package_list" },
    });
    detalhes.push(...(r.response?.order_list ?? []));
  }

  const montar = async (d: Detalhe): Promise<PedidoShopee> => {
    const status = STATUS[d.order_status] ?? "aguardando";
    let renda: Renda | null = null;
    if (status !== "ignorar" && status !== "cancelado") {
      try {
        const r = await chamar<{ response?: { order_income?: Renda } }>("/api/v2/payment/get_escrow_detail", { token, lojaId, query: { order_sn: d.order_sn } });
        renda = r.response?.order_income ?? null;
      } catch {
        renda = null; // extrato ainda nao gerado: a tela usa a tabela do canal
      }
    }
    const itens: ItemImportado[] = (d.item_list ?? []).map((it) => ({
      produtoNome: it.item_name,
      variacaoNome: it.model_name ?? "",
      sku: it.model_sku || it.item_sku || "",
      skuPai: it.item_sku ?? "",
      idAnuncio: String(it.item_id),
      idVariacao: it.model_id ? String(it.model_id) : "",
      qtd: Math.max(1, it.model_quantity_purchased || 1),
      preco: it.model_discounted_price || it.model_original_price || 0,
      precoOriginal: it.model_original_price || it.model_discounted_price || 0,
      produtoId: null,
      como: null,
    }));
    return {
      pedido: d.order_sn,
      status,
      data: dataLocal(d.create_time),
      rastreio: d.package_list?.find((p) => p.tracking_number)?.tracking_number ?? "",
      comprador: d.buyer_username ?? "",
      nf: "",
      freteComprador: renda?.buyer_paid_shipping_fee ?? 0,
      taxas: renda ? Math.abs(TAXAS.reduce((s, k) => s + (renda![k] ?? 0), 0)) : 0,
      temTaxas: renda != null,
      repasse: renda?.escrow_amount ?? null,
      itens,
    };
  };
  // extrato de 5 pedidos por vez: em serie, 150 pedidos passariam do limite de 60 s da rota
  const pedidos: PedidoShopee[] = [];
  for (const grupo of lotes(detalhes, 5)) pedidos.push(...(await Promise.all(grupo.map(montar))));
  return { pedidos, cortado };
}
