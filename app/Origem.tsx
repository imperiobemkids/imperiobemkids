"use client";

import { useEffect } from "react";
import { guardarOrigem } from "@/lib/origem";

/*
  Guarda a origem da visita na pagina em que a pessoa chegou (lib/origem.ts).
  Fica no layout, que so monta uma vez por carregamento: navegar pelo site
  nao troca a pagina de entrada.
*/
export function Origem() {
  useEffect(guardarOrigem, []);
  return null;
}
