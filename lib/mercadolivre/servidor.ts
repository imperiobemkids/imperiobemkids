import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemImportado, PedidoImportado, StatusImportado } from "../importacao";
import { ErroIntegracao, acessoValido, guardarTokens, type Tokens } from "../integracoesServidor";

/*
  API do Mercado Livre, lado do servidor. So as rotas de app/api/mercadolivre
  usam este arquivo: o Client Secret e os tokens da conta nunca chegam ao
  navegador. Quem chama, cofre e conexao sao comuns (lib/integracoesServidor.ts).

  Variaveis (no .env.local e na Vercel, nunca com NEXT_PUBLIC_):
    ML_CLIENT_ID      App ID da aplicacao (DevCenter > Minhas aplicacoes)
    ML_CLIENT_SECRET  Secret Key da aplicacao
    ML_REDIRECT_URI   o endereco de retorno cadastrado na aplicacao, igualzinho
                      (o ML exige HTTPS e o mesmo texto na autorizacao e na troca)

  Conferido na documentacao em 03/10/2026: autorizacao em
  auth.mercadolivre.com.br; token em api.mercadolibre.com/oauth/token
  (access 6 horas, refresh 6 meses e de uso unico); conta sem "multi origem"
  muda estoque por PUT /items; /shipments exige o cabecalho x-format-new.
  O ML nao tem sandbox separado: testa com a conta real ou usuario de teste.
*/

const API = "https://api.mercadolibre.com";
const AUTH = "https://auth.mercadolivre.com.br/authorization";

export function configML() {
  const clientId = process.env.ML_CLIENT_ID ?? "";
  const secret = process.env.ML_CLIENT_SECRET ?? "";
  const redirect = process.env.ML_REDIRECT_URI ?? "";
  return { ok: Boolean(clientId && secret && /^https:\/\//.test(redirect)), clientId, secret, redirect, ambiente: "producao" as const };
}

type Query = Record<string, string | number | boolean | undefined>;

export async function chamar<T>(
  caminho: string,
  op: { metodo?: "GET" | "PUT" | "POST"; query?: Query; corpo?: unknown; token?: string; cabecalhos?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(API + caminho);
  for (const [k, v] of Object.entries(op.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: op.metodo ?? "GET",
    headers: {
      Accept: "application/json",
      ...(op.token ? { Authorization: `Bearer ${op.token}` } : {}),
      ...(op.corpo ? { "Content-Type": "application/json" } : {}),
      ...op.cabecalhos,
    },
    body: op.corpo ? JSON.stringify(op.corpo) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { error?: string; message?: string; cause?: { message?: string }[] } | null;
  if (!res.ok || !json) {
    const causa = json?.cause?.map((c) => c.message).filter(Boolean).join("; ");
    throw new ErroIntegracao(json?.error || `http_${res.status}`, causa || json?.message || `o Mercado Livre respondeu ${res.status}`);
  }
  return json as T;
}

/* ---------- autorizacao (OAuth 2.0 com PKCE) ---------- */

const base64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/*
  PKCE: o servidor gera o verifier e manda o challenge (SHA-256) no link. O
  verifier volta para o navegador e fica na aba ate o retorno; sem ele o
  codigo da autorizacao nao vira token. Funciona com o PKCE ligado ou nao na
  aplicacao (ligado e o recomendado pelo ML).
*/
export function linkAutorizacao(state: string) {
  const c = configML();
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const u = new URL(AUTH);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", c.clientId);
  u.searchParams.set("redirect_uri", c.redirect);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return { url: u.toString(), verifier };
}

type RespostaToken = { access_token: string; refresh_token: string; expires_in: number; user_id: number };

// access_token do ML vale 6 horas; refresh_token, 6 meses
const paraTokens = (r: RespostaToken): Tokens => ({ access: r.access_token, refresh: r.refresh_token, expiraEmSeg: r.expires_in || 21600, refreshDias: 180 });

async function token(corpo: Record<string, string>): Promise<RespostaToken> {
  const c = configML();
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, ...corpo }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (RespostaToken & { error?: string; error_description?: string; message?: string }) | null;
  if (!res.ok || !json?.access_token) {
    throw new ErroIntegracao(json?.error || `http_${res.status}`, json?.error_description || json?.message || "o Mercado Livre recusou a autorizacao");
  }
  return json;
}

/* troca o codigo da autorizacao pelos tokens e grava a conta no canal */
export async function conectarConta(db: SupabaseClient, canalId: string, code: string, verifier: string) {
  const c = configML();
  const r = await token({ grant_type: "authorization_code", code, redirect_uri: c.redirect, ...(verifier ? { code_verifier: verifier } : {}) });
  const eu = await chamar<{ id: number; nickname?: string }>("/users/me", { token: r.access_token }).catch(() => null);
  await guardarTokens(
    db,
    { canal_id: canalId, plataforma: "mercadolivre", ambiente: c.ambiente, loja_id: String(r.user_id), extra: { apelido: eu?.nickname ?? null } },
    paraTokens(r),
    c.secret,
    true,
  );
  return { lojaId: r.user_id, apelido: eu?.nickname ?? null };
}

export async function tokenDaConta(db: SupabaseClient, canalId?: string): Promise<{ token: string; usuarioId: string; canalId: string }> {
  const c = configML();
  const { token: t, conexao } = await acessoValido(db, "mercadolivre", canalId, c.secret, c.ambiente, async (refresh) =>
    paraTokens(await token({ grant_type: "refresh_token", refresh_token: refresh })),
  );
  return { token: t, usuarioId: conexao.loja_id!, canalId: conexao.canal_id };
}

/* ---------- anuncios ---------- */

export type ModeloAnuncio = { idVariacao: string; nome: string; sku: string; estoque: number; reservado: number; preco: number };
export type Anuncio = { idAnuncio: string; titulo: string; sku: string; modelos: ModeloAnuncio[] };

type Atributo = { id?: string; name?: string; value_name?: string | null };
type Variacao = { id: number; attribute_combinations?: Atributo[]; available_quantity?: number; price?: number; seller_custom_field?: string | null; attributes?: Atributo[] };
type Item = { id: string; title: string; price?: number; available_quantity?: number; seller_custom_field?: string | null; attributes?: Atributo[]; variations?: Variacao[] };

// SKU no ML: o atributo SELLER_SKU (novo) ou o seller_custom_field (antigo)
const skuDe = (x: { seller_custom_field?: string | null; attributes?: Atributo[] }) =>
  x.attributes?.find((a) => a.id === "SELLER_SKU")?.value_name ?? x.seller_custom_field ?? "";

const lotes = <T,>(lista: T[], n: number) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));

export async function listarAnuncios(tk: string, usuarioId: string): Promise<Anuncio[]> {
  // 1) ids dos anuncios ativos, de 50 em 50
  const ids: string[] = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const r = await chamar<{ results?: string[]; paging?: { total?: number } }>(`/users/${usuarioId}/items/search`, {
      token: tk, query: { status: "active", limit: 50, offset },
    });
    ids.push(...(r.results ?? []));
    if (!r.results?.length || ids.length >= (r.paging?.total ?? 0)) break;
  }

  // 2) detalhes de 20 em 20 (limite do multiget)
  const out: Anuncio[] = [];
  for (const grupo of lotes(ids, 20)) {
    const r = await chamar<{ code: number; body: Item }[]>("/items", {
      token: tk,
      query: { ids: grupo.join(","), attributes: "id,title,price,available_quantity,seller_custom_field,attributes,variations" },
    });
    for (const { code, body: it } of r) {
      if (code !== 200 || !it) continue;
      const a: Anuncio = { idAnuncio: it.id, titulo: it.title, sku: skuDe(it), modelos: [] };
      if (it.variations?.length) {
        for (const v of it.variations) {
          const nome = (v.attribute_combinations ?? []).map((x) => x.value_name ?? "").filter(Boolean).join(", ");
          a.modelos.push({ idVariacao: String(v.id), nome, sku: skuDe(v), estoque: v.available_quantity ?? 0, reservado: 0, preco: v.price ?? it.price ?? 0 });
        }
      } else {
        a.modelos.push({ idVariacao: "", nome: "", sku: skuDe(it), estoque: it.available_quantity ?? 0, reservado: 0, preco: it.price ?? 0 });
      }
      out.push(a);
    }
  }
  return out;
}

/* ---------- estoque ---------- */

export type EstoqueEnviar = { idAnuncio: string; idVariacao: string; estoque: number };
export type ResultadoEstoque = EstoqueEnviar & { ok: boolean; motivo?: string };

/*
  Um PUT por anuncio. Sem variacao muda available_quantity do anuncio.
  Com variacao, ATENCAO: o ML apaga do anuncio toda variacao que nao vier na
  lista do PUT (aconteceu em 03/10/2026: mandar so as vinculadas apagou os
  tamanhos 1, 2 e 8 do moletom feminino). Por isso le o anuncio antes e manda
  TODAS as variacoes, mudando so o estoque das pedidas e repetindo o atual nas
  outras. Anuncio no Full ou conta em "multi origem" e recusado pelo ML: volta
  como falha com o motivo.
*/
export async function enviarEstoque(tk: string, itens: EstoqueEnviar[]): Promise<ResultadoEstoque[]> {
  const porAnuncio = new Map<string, EstoqueEnviar[]>();
  for (const i of itens) porAnuncio.set(i.idAnuncio, [...(porAnuncio.get(i.idAnuncio) ?? []), i]);
  const out: ResultadoEstoque[] = [];
  const qtd = (n: number) => Math.max(0, Math.floor(n));
  for (const [idAnuncio, lista] of porAnuncio) {
    try {
      const atual = await chamar<{ available_quantity?: number; variations?: { id: number; available_quantity?: number }[] }>(`/items/${idAnuncio}`, {
        token: tk,
        query: { attributes: "id,available_quantity,variations" },
      });
      const variacoes = atual.variations ?? [];
      if (!variacoes.length) {
        const alvo = lista.find((l) => !l.idVariacao);
        if (!alvo) {
          for (const l of lista) out.push({ ...l, ok: false, motivo: "o anúncio não tem mais variações; leia os anúncios e refaça o vínculo" });
          continue;
        }
        await chamar(`/items/${idAnuncio}`, { metodo: "PUT", token: tk, corpo: { available_quantity: qtd(alvo.estoque) } });
        for (const l of lista) out.push(l === alvo ? { ...l, ok: true } : { ...l, ok: false, motivo: "variação não existe no anúncio" });
        continue;
      }
      const existe = new Set(variacoes.map((v) => String(v.id)));
      const novo = new Map(lista.filter((l) => existe.has(l.idVariacao)).map((l) => [l.idVariacao, qtd(l.estoque)]));
      if (novo.size) {
        await chamar(`/items/${idAnuncio}`, {
          metodo: "PUT",
          token: tk,
          corpo: { variations: variacoes.map((v) => ({ id: v.id, available_quantity: novo.get(String(v.id)) ?? v.available_quantity ?? 0 })) },
        });
      }
      for (const l of lista) {
        out.push(novo.has(l.idVariacao) ? { ...l, ok: true } : { ...l, ok: false, motivo: "variação não existe mais no anúncio; leia os anúncios e refaça o vínculo" });
      }
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "erro";
      for (const l of lista) out.push({ ...l, ok: false, motivo });
    }
  }
  return out;
}

/* ---------- pedidos ---------- */

export type PedidoML = PedidoImportado & { repasse: number | null };

type Pedido = {
  id: number;
  status: string;
  date_created: string;
  buyer?: { nickname?: string };
  shipping?: { id?: number | null };
  order_items?: {
    item: { id: string; title: string; variation_id?: number | null; seller_sku?: string | null; variation_attributes?: Atributo[] };
    quantity: number;
    unit_price: number;
    full_unit_price?: number;
    sale_fee?: number;
  }[];
  payments?: { status?: string; marketplace_fee?: number; shipping_cost?: number }[];
};
type Envio = { status?: string; tracking_number?: string | null };
type Custos = { senders?: { cost?: number }[] };

// a data do pedido no fuso da loja
const dataLocal = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/* status do pedido + status do envio -> status daqui ("ignorar" = nao pago, ainda nao e venda) */
function statusDe(pedido: string, envio?: string): StatusImportado {
  if (pedido === "cancelled" || pedido === "invalid") return "cancelado";
  if (pedido !== "paid" && pedido !== "partially_refunded") return "ignorar";
  if (envio === "delivered") return "entregue";
  if (envio === "shipped") return "enviado";
  if (envio === "cancelled") return "cancelado";
  if (envio === "not_delivered") return "devolvido";
  return "aguardando";
}

/*
  Pedidos atualizados desde "desdeIso", do mais novo para o mais velho. Para
  cada pedido pago busca o envio (status e rastreio) e o custo do frete que a
  loja paga (frete gratis), que entra na venda como frete.
*/
export async function buscarPedidos(tk: string, usuarioId: string, desdeIso: string, limite = 150): Promise<{ pedidos: PedidoML[]; cortado: boolean }> {
  const lista: Pedido[] = [];
  let cortado = false;
  for (let offset = 0; ; offset += 50) {
    const r = await chamar<{ results?: Pedido[]; paging?: { total?: number } }>("/orders/search", {
      token: tk,
      query: { seller: usuarioId, "order.date_last_updated.from": desdeIso, sort: "date_desc", limit: 50, offset },
    });
    lista.push(...(r.results ?? []));
    if (lista.length >= limite) { cortado = lista.length < (r.paging?.total ?? 0); break; }
    if (!r.results?.length || lista.length >= (r.paging?.total ?? 0)) break;
  }

  const cab = { "x-format-new": "true" };
  // pago ou com reembolso parcial: ja e venda, tem envio e tarifa real
  const pago = (st: string) => st === "paid" || st === "partially_refunded";
  const montar = async (p: Pedido): Promise<PedidoML> => {
    let envio: Envio | null = null;
    let freteLoja = 0;
    if (p.shipping?.id && pago(p.status)) {
      envio = await chamar<Envio>(`/shipments/${p.shipping.id}`, { token: tk, cabecalhos: cab }).catch(() => null);
      const custos = await chamar<Custos>(`/shipments/${p.shipping.id}/costs`, { token: tk, cabecalhos: cab }).catch(() => null);
      freteLoja = (custos?.senders ?? []).reduce((s, x) => s + (x.cost ?? 0), 0);
    }
    const aprovados = (p.payments ?? []).filter((x) => x.status === "approved");
    const tarifaPagamentos = aprovados.reduce((s, x) => s + (x.marketplace_fee ?? 0), 0);
    // sem tarifa nos pagamentos, soma a do item (sale_fee por unidade)
    const tarifaItens = (p.order_items ?? []).reduce((s, x) => s + (x.sale_fee ?? 0) * x.quantity, 0);
    const itens: ItemImportado[] = (p.order_items ?? []).map((x) => ({
      produtoNome: x.item.title,
      variacaoNome: (x.item.variation_attributes ?? []).map((a) => a.value_name ?? "").filter(Boolean).join(", "),
      sku: x.item.seller_sku ?? "",
      skuPai: "",
      idAnuncio: x.item.id,
      idVariacao: x.item.variation_id ? String(x.item.variation_id) : "",
      qtd: Math.max(1, x.quantity || 1),
      preco: x.unit_price,
      precoOriginal: x.full_unit_price || x.unit_price,
      produtoId: null,
      como: null,
    }));
    return {
      pedido: String(p.id),
      status: statusDe(p.status, envio?.status),
      data: dataLocal(p.date_created),
      rastreio: envio?.tracking_number ?? "",
      comprador: p.buyer?.nickname ?? "",
      nf: "",
      freteComprador: aprovados.reduce((s, x) => s + (x.shipping_cost ?? 0), 0),
      freteLoja: Math.round(freteLoja * 100) / 100,
      taxas: Math.round((tarifaPagamentos || tarifaItens) * 100) / 100,
      temTaxas: pago(p.status),
      repasse: null,
      itens,
    };
  };
  // envio e custo de 5 pedidos por vez: em serie, 150 pedidos passariam do limite de 60 s da rota
  const pedidos: PedidoML[] = [];
  for (const grupo of lotes(lista.slice(0, limite), 5)) pedidos.push(...(await Promise.all(grupo.map(montar))));
  return { pedidos, cortado };
}
