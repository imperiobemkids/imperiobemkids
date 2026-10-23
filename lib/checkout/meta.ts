import { createHash } from "node:crypto";
import { PIXEL_ID } from "@/lib/pixel";

/*
  Compra pelo servidor (API de Conversoes da Meta), disparada pelo aviso de
  pagamento da AbacatePay. O Pixel da pagina de obrigado manda a mesma compra
  pelo navegador com o mesmo event_id (o id do checkout), e a Meta conta uma
  vez so. Pelo servidor a compra chega mesmo com bloqueador de anuncio ou com
  a aba fechada antes da confirmacao do Pix. Sem META_CAPI_TOKEN, nao faz nada.
*/
const VERSAO = "v25.0";

// a Meta pede e-mail normalizado e em SHA-256, nunca em texto puro
const hash = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export async function compraNaMeta(c: {
  eventoId: string;
  valor: number; // reais
  produto: string;
  url: string;
  email?: string;
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
}) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  const r = await fetch(`https://graph.facebook.com/${VERSAO}/${PIXEL_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: c.eventoId,
          action_source: "website",
          event_source_url: c.url,
          user_data: {
            em: c.email ? [hash(c.email)] : undefined,
            fbp: c.fbp,
            fbc: c.fbc,
            client_ip_address: c.ip,
            client_user_agent: c.ua,
          },
          custom_data: { currency: "BRL", value: c.valor, content_ids: [c.produto], content_type: "product" },
        },
      ],
    }),
  });
  if (!r.ok) console.error("meta capi", r.status, await r.text().catch(() => ""));
}
