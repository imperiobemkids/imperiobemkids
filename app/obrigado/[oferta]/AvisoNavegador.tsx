"use client";

import { useEffect, useState } from "react";

/*
  Quem compra pelo anuncio costuma estar no navegador de dentro do Instagram ou
  do Facebook, onde imprimir e baixar podem falhar e o que foi preenchido pode
  se perder. Aqui so avisa como sair dele: nenhum app deixa abrir fora sozinho.
*/
const DENTRO_DE_APP = /Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|BytedanceWebview/i;

export function AvisoNavegador() {
  const [dentro, setDentro] = useState(false);
  useEffect(() => setDentro(DENTRO_DE_APP.test(navigator.userAgent)), []);
  if (!dentro) return null;
  return (
    <p className="mx-auto mb-6 max-w-md rounded-2xl bg-[var(--yellow)]/60 px-4 py-3 text-left text-sm leading-relaxed text-[var(--ink)]/85">
      <b className="text-[var(--purple-dark)]">Abra no navegador do celular.</b> Dentro do app, imprimir e baixar podem
      falhar, e o que você preencher pode se perder. Toque nos três pontinhos no canto da tela e escolha abrir no
      navegador (Chrome ou Safari).
    </p>
  );
}
