"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/*
  Pixel da Meta. Carrega apenas nas paginas publicas: o /admin e o /portal ficam
  de fora porque rastrear a operacao interna nao serve para anuncio e ainda
  mandaria para a Meta a navegacao do dono da loja.

  O Pixel tambem precisa registrar PageView a cada troca de pagina: como o Next
  navega sem recarregar, o disparo automatico do script so contaria a primeira.
*/

const PIXEL_ID = "1626260525596547";

const PRIVADO = ["/admin", "/portal"];

export function MetaPixel() {
  const pathname = usePathname();
  const publico = !PRIVADO.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!publico) return;
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (fbq) fbq("track", "PageView");
  }, [pathname, publico]);

  if (!publico) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
