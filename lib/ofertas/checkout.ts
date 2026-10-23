import { vendaAtiva } from "@/lib/checkout/ofertas";

/*
  O Enxoval na Medida vende pelo checkout proprio (AbacatePay) quando
  VENDA_ATIVA inclui "ibk-enxoval" e ABACATEPAY_API_KEY existe (ver
  lib/checkout/ofertas.ts). Enquanto isso, a pagina /enxoval vende pelo
  WhatsApp e fica fora do Google (noindex e fora do sitemap e do llms.txt).
*/
export const ENXOVAL_NO_AR = vendaAtiva("ibk-enxoval");
