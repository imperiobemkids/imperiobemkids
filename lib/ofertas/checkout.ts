/*
  Link de compra do Enxoval na Medida. Vem da Vercel (NEXT_PUBLIC_CHECKOUT_ENXOVAL)
  para trocar de plataforma de checkout sem mexer no codigo.

  Enquanto a variavel nao existir, a pagina /enxoval vende pelo WhatsApp e fica
  fora do Google (noindex e fora do sitemap). Configurou o checkout, ela entra no ar.
*/
export const CHECKOUT_ENXOVAL = process.env.NEXT_PUBLIC_CHECKOUT_ENXOVAL || "";

export const ENXOVAL_NO_AR = CHECKOUT_ENXOVAL !== "";
