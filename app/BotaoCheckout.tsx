"use client";

import { pixel } from "@/lib/pixel";

/*
  Botao de comprar do checkout proprio: form POST para /comprar/<oferta>,
  que cria a cobranca e leva para a AbacatePay. Dispara o InitiateCheckout
  antes de sair. Sem JavaScript continua funcionando, so nao mede.
  O form usa display: contents para o botao ficar no layout como antes.
*/
export function BotaoCheckout({
  oferta,
  params,
  className,
  children,
}: {
  oferta: string;
  params?: Record<string, unknown>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={`/comprar/${oferta}`} method="post" className="contents" onSubmit={() => pixel("InitiateCheckout", params)}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
