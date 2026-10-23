import { createHmac, timingSafeEqual } from "node:crypto";

/*
  Cliente da API v2 da AbacatePay, so para o servidor (app/comprar, app/obrigado
  e app/api). A chave define o ambiente: a de desenvolvimento cria cobrancas de
  teste (cartao 4242 4242 4242 4242), a de producao cobra de verdade. O Pix e o
  cartao acontecem na pagina da AbacatePay: o site nunca ve dado de cartao.
*/

const API = "https://api.abacatepay.com/v2";

export const abacatepayConfigurado = Boolean(process.env.ABACATEPAY_API_KEY);

export type StatusCheckout = "PENDING" | "EXPIRED" | "CANCELLED" | "PAID" | "REFUNDED" | "REDEEMED";

export type Checkout = {
  id: string;
  externalId: string | null;
  url: string;
  amount: number; // centavos
  paidAmount: number | null;
  items: { id: string; quantity: number }[];
  status: StatusCheckout;
  devMode: boolean;
  metadata: Record<string, unknown> | null;
};

export type Produto = {
  id: string;
  externalId: string;
  name: string;
  price: number;
  status: "ACTIVE" | "INACTIVE";
};

export class ErroAbacatePay extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
  const chave = process.env.ABACATEPAY_API_KEY;
  if (!chave) throw new ErroAbacatePay(500, "ABACATEPAY_API_KEY nao configurada");
  const r = await fetch(`${API}${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
  });
  const json = (await r.json().catch(() => null)) as { data?: T; error?: string | null } | null;
  if (!r.ok || !json || json.error || json.data === undefined) {
    throw new ErroAbacatePay(r.status, json?.error ?? `HTTP ${r.status}`);
  }
  return json.data;
}

/* ---------- produtos ---------- */

export async function buscarProduto(externalId: string): Promise<Produto | null> {
  const lista = await chamar<Produto[]>(`/products/list?status=ACTIVE&externalId=${encodeURIComponent(externalId)}`);
  return lista.find((p) => p.externalId === externalId) ?? null;
}

/*
  A conta de teste e a de producao tem produtos separados, entao o produto
  nasce na primeira compra de cada uma, pelo externalId. A API nao edita
  produto: preco novo pede externalId novo (ver lib/checkout/ofertas.ts).
*/
export async function garantirProduto(p: {
  externalId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}): Promise<Produto> {
  return (await buscarProduto(p.externalId)) ?? chamar<Produto>("/products/create", { ...p, currency: "BRL" });
}

/* ---------- checkout ---------- */

export function criarCheckout(corpo: {
  items: { id: string; quantity: number }[];
  methods: ("PIX" | "CARD")[];
  card?: { maxInstallments: number };
  externalId: string;
  returnUrl: string;
  completionUrl: string;
  metadata?: Record<string, string | undefined>;
}): Promise<Checkout> {
  return chamar<Checkout>("/checkouts/create", corpo);
}

export async function buscarCheckout(externalId: string): Promise<Checkout | null> {
  try {
    return await chamar<Checkout>(`/checkouts/get?externalId=${encodeURIComponent(externalId)}`);
  } catch (e) {
    if (e instanceof ErroAbacatePay && e.status === 404) return null;
    throw e;
  }
}

/* ---------- aviso de pagamento (webhook) ---------- */

export type AvisoAbacatePay = {
  id: string;
  event: string;
  devMode: boolean;
  data: {
    checkout?: { id: string; externalId: string | null; isUpSell?: boolean };
    customer?: { name?: string; email?: string } | null;
  };
};

/*
  O aviso precisa trazer as duas provas:
  - webhookSecret na URL igual ao segredo cadastrado no webhook
    (ABACATEPAY_WEBHOOK_SECRET): prova que veio da AbacatePay;
  - X-Webhook-Signature igual ao HMAC-SHA256 do corpo bruto, em base64, com a
    chave publica da AbacatePay (ABACATEPAY_CHAVE_PUBLICA, copiada da doc de
    webhooks): prova que o corpo nao foi alterado no caminho.
*/
export function avisoAutentico(corpoBruto: string, segredoNaUrl: string | null, assinatura: string | null): boolean {
  const segredo = process.env.ABACATEPAY_WEBHOOK_SECRET;
  const chavePublica = process.env.ABACATEPAY_CHAVE_PUBLICA;
  if (!segredo || !chavePublica || !segredoNaUrl || !assinatura) return false;
  const esperada = createHmac("sha256", chavePublica).update(corpoBruto, "utf8").digest("base64");
  return iguais(segredoNaUrl, segredo) && iguais(assinatura, esperada);
}

// comparacao em tempo constante, para o tempo de resposta nao entregar o segredo
function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
