"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/*
  Google Tag Manager e Google Analytics (GA4). Os IDs sao publicos: vao no HTML
  de qualquer forma. O Analytics carrega direto aqui, entao NAO criar tag do GA4
  dentro do GTM: cada visita contaria em dobro (em 06/11/2026 o conteiner esta
  vazio). Tag nova no GTM que chame outro dominio precisa de excecao na CSP
  (next.config.ts), senao o navegador bloqueia.

  Fora do /admin e do /portal, como o Pixel, e tambem do /obrigado: a URL de la
  leva o codigo de acesso aos arquivos pagos, que nao pode ir para o relatorio
  do Analytics. Trocas de pagina sem recarregar o GA4 ja mede sozinho (medicao
  otimizada), entao aqui nao ha disparo manual de page_view.

  So em producao, para o servidor local nao sujar os numeros.
*/
export const GTM_ID = "GTM-WP9NKVJZ";
export const GA_ID = "G-7XSG9J13ZV";

const PRIVADO = ["/admin", "/portal", "/obrigado"];

export function GoogleTags() {
  const pathname = usePathname();
  const publico = !PRIVADO.some((p) => pathname.startsWith(p));

  // navegou sem recarregar para uma area privada: desliga o GA (chave oficial do gtag)
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !publico;
  }, [publico]);

  if (!publico || process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          title="Google Tag Manager"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
