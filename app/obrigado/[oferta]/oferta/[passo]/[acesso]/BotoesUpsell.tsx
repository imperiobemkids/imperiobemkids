"use client";

import { useEffect, useState } from "react";

/*
  Os botoes da oferta de 1 clique. O script da Kiwify procura estes ids quando
  roda e liga o clique uma vez so: por isso ele entra depois que os botoes ja
  estao na tela, e os botoes nao mudam depois.

  - #kiwify-upsell-<link>: o bloco, com o destino do aceite e o da recusa
  - #kiwify-upsell-trigger-<link>: aceita (abre a confirmacao da Kiwify)
  - #kiwify-upsell-cancel-trigger-<link>: recusa (vai para o destino da recusa)

  Sao botoes e nao links: o script nao cancela a navegacao de um link.
*/
export function BotoesUpsell(p: {
  link: string;
  script: string;
  aoAceitar: string;
  aoRecusar: string;
  aceitar: string;
  recusar: string;
  pedido: string;
}) {
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (document.querySelector("script[data-upsell-kiwify]")) return;
    const s = document.createElement("script");
    s.src = p.script;
    s.async = true;
    s.dataset.upsellKiwify = "1";
    s.onerror = () => setFalhou(true);
    document.body.appendChild(s);
  }, [p.script]);

  return (
    <div id={`kiwify-upsell-${p.link}`} data-upsell-url={p.aoAceitar} data-downsell-url={p.aoRecusar} className="mt-6 text-center">
      <button
        type="button"
        id={`kiwify-upsell-trigger-${p.link}`}
        className="w-full rounded-full bg-[var(--purple)] px-6 py-4 text-lg font-extrabold leading-tight text-white shadow-[0_4px_0_var(--purple-dark)] transition-transform active:translate-y-[2px] active:shadow-[0_2px_0_var(--purple-dark)]"
      >
        {p.aceitar}
      </button>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/70">
        Você confirma na tela seguinte, sem preencher seus dados de novo. Pagamento único, com 7 dias de garantia.
      </p>
      <button
        type="button"
        id={`kiwify-upsell-cancel-trigger-${p.link}`}
        className="mt-5 w-full rounded-full border-2 border-[var(--purple)]/20 bg-white px-6 py-3 text-base font-extrabold text-[var(--purple-dark)]"
      >
        {p.recusar}
      </button>
      {falhou && (
        <p className="mt-4 rounded-2xl bg-[var(--yellow)]/60 px-4 py-3 text-sm leading-relaxed text-[var(--ink)]/85">
          Não deu para carregar esta oferta agora. O seu pedido está garantido: siga pelo link abaixo.
        </p>
      )}
      {/* saida que nao depende do script: ninguem fica presa nesta pagina */}
      <a href={p.pedido} className="mt-5 inline-block text-sm font-bold text-[var(--purple)] underline underline-offset-2">
        Ir direto para o meu pedido
      </a>
    </div>
  );
}
