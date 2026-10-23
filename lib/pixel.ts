/*
  Eventos do Pixel da Meta nos cliques que importam. Sem isso o Pixel so
  sabe que alguem visitou; com o evento, o anuncio otimiza para quem clica
  em comprar, e da para medir custo por clique de saida.

  Eventos padrao da Meta (nomes fixos, ela entende):
  - InitiateCheckout: clicou para comprar (Shopee, produto, checkout proprio)
  - Purchase: compra aprovada no checkout proprio (pagina de obrigado)
  - Contact: abriu o WhatsApp
  - Lead: entrou no grupo de achadinhos
  - ViewContent: abriu um produto
*/
export const PIXEL_ID = "1626260525596547";

export type EventoPixel = "InitiateCheckout" | "Purchase" | "Contact" | "Lead" | "ViewContent";

type Fbq = (
  acao: "track" | "trackCustom",
  evento: string,
  params?: Record<string, unknown>,
  opcoes?: { eventID: string },
) => void;

/*
  eventoId: o mesmo id que o servidor manda pela API de Conversoes, para a
  Meta juntar os dois disparos da mesma compra. Devolve false se o Pixel
  ainda nao carregou.
*/
export function pixel(evento: EventoPixel, params?: Record<string, unknown>, eventoId?: string): boolean {
  if (typeof window === "undefined") return false;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) return false;
  try {
    fbq("track", evento, { currency: "BRL", ...params }, eventoId ? { eventID: eventoId } : undefined);
  } catch {
    // o Pixel nunca pode derrubar o clique
  }
  return true;
}

/* preco "R$ 49,90" -> 49.9 */
export const precoNumero = (s?: string) => {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d,]/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
};
