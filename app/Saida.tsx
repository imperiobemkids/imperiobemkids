"use client";

import { useEffect, useState } from "react";
import { comOrigem } from "@/lib/origem";
import { pixel, type EventoPixel } from "@/lib/pixel";

/*
  Link de saida do site (Shopee, WhatsApp, grupo, checkout) que dispara o
  evento do Pixel antes de abrir. E um <a> normal: sem JavaScript o link
  continua funcionando, so nao mede.

  Com `origem`, o link leva junto de onde a visita veio (lib/origem.ts). Isso
  so existe no navegador: o link nasce igual ao do servidor e ganha os
  parametros depois de montar.
*/
export function Saida({
  href,
  evento,
  params,
  origem,
  children,
  ...rest
}: {
  href: string;
  evento: EventoPixel;
  params?: Record<string, unknown>;
  origem?: boolean;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const [destino, setDestino] = useState(href);
  useEffect(() => {
    setDestino(origem ? comOrigem(href) : href);
  }, [href, origem]);

  return (
    <a
      href={destino}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => pixel(evento, params)}
      {...rest}
    >
      {children}
    </a>
  );
}
