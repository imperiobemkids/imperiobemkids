/*
  Eventos do Pixel da Meta nos cliques que importam. Sem isso o Pixel so
  sabe que alguem visitou; com o evento, o anuncio otimiza para quem clica
  em comprar, e da para medir custo por clique de saida.

  Eventos padrao da Meta (nomes fixos, ela entende):
  - InitiateCheckout: clicou para comprar (Shopee, produto)
  - Contact: abriu o WhatsApp
  - Lead: entrou no grupo de achadinhos
  - ViewContent: abriu um produto
*/
export type EventoPixel = "InitiateCheckout" | "Contact" | "Lead" | "ViewContent";

type Fbq = (acao: "track" | "trackCustom", evento: string, params?: Record<string, unknown>) => void;

export function pixel(evento: EventoPixel, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) return;
  try {
    fbq("track", evento, { currency: "BRL", ...params });
  } catch {
    // o Pixel nunca pode derrubar o clique
  }
}

/* preco "R$ 49,90" -> 49.9 */
export const precoNumero = (s?: string) => {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d,]/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
};
