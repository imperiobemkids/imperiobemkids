"use client";

import { useEffect } from "react";
import { pixel } from "@/lib/pixel";

/*
  Compra no Pixel, uma vez por pedido neste navegador (quem volta para baixar
  de novo nao conta outra venda). O eventoId e o id do checkout, o mesmo que
  o servidor manda pela API de Conversoes, e a Meta junta os dois. O Pixel
  carrega depois da pagina, entao tenta por alguns segundos.
*/
export function CompraPixel({ eventoId, valor, produto }: { eventoId: string; valor: number; produto: string }) {
  useEffect(() => {
    const chave = `ibk-compra:${eventoId}`;
    try {
      if (localStorage.getItem(chave)) return;
    } catch {}
    let tentativas = 0;
    let t: ReturnType<typeof setTimeout>;
    const disparar = () => {
      const foi = pixel("Purchase", { value: valor, content_ids: [produto], content_type: "product", num_items: 1 }, eventoId);
      if (foi) {
        try {
          localStorage.setItem(chave, "1");
        } catch {}
      } else if (++tentativas < 20) {
        t = setTimeout(disparar, 500);
      }
    };
    disparar();
    return () => clearTimeout(t);
  }, [eventoId, valor, produto]);
  return null;
}
