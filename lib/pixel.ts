/*
  Eventos do Pixel da Meta nos cliques que importam. Sem isso o Pixel so
  sabe que alguem visitou; com o evento, o anuncio otimiza para quem clica
  em comprar, e da para medir custo por clique de saida.

  Eventos padrao da Meta (nomes fixos, ela entende):
  - InitiateCheckout: clicou para comprar (Shopee, produto, Kiwify)
  - Contact: abriu o WhatsApp
  - Lead: entrou no grupo de achadinhos
  - ViewContent: abriu um produto

  O mesmo clique vira evento no Google Analytics, com o nome que o GA4 usa.
*/
export const PIXEL_ID = "1626260525596547";

export type EventoPixel = "InitiateCheckout" | "Contact" | "Lead" | "ViewContent";

type Fbq = (acao: "track" | "trackCustom", evento: string, params?: Record<string, unknown>) => void;

const EVENTO_GA4: Record<EventoPixel, string> = {
  InitiateCheckout: "begin_checkout",
  Contact: "contact",
  Lead: "generate_lead",
  ViewContent: "view_item",
};

export function pixel(evento: EventoPixel, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const { fbq, gtag } = window as unknown as { fbq?: Fbq; gtag?: (...a: unknown[]) => void };
  try {
    fbq?.("track", evento, { currency: "BRL", ...params });
    gtag?.("event", EVENTO_GA4[evento], { currency: "BRL", ...params });
  } catch {
    // a medicao nunca pode derrubar o clique
  }
}

/* preco "R$ 49,90" -> 49.9 */
export const precoNumero = (s?: string) => {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d,]/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
};
