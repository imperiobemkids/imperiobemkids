"use client";

import { pixel, type EventoPixel } from "@/lib/pixel";

/*
  Link de saida do site (Shopee, WhatsApp, grupo) que dispara o evento do
  Pixel antes de abrir. E um <a> normal: sem JavaScript o link continua
  funcionando, so nao mede.
*/
export function Saida({
  href,
  evento,
  params,
  children,
  ...rest
}: {
  href: string;
  evento: EventoPixel;
  params?: Record<string, unknown>;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => pixel(evento, params)}
      {...rest}
    >
      {children}
    </a>
  );
}
