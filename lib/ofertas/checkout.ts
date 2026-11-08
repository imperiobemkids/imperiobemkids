/*
  Links de compra do Enxoval na Medida na Kiwify. Sao publicos (vao no botao da
  pagina), entao ficam aqui e nao em variavel de ambiente. O link da promo so
  vale enquanto a promo esta ativa. Para pausar a venda, deixe CHECKOUT_NORMAL
  vazio: a pagina /enxoval volta a vender pelo WhatsApp e CONTINUA no Google.

  Tirar a pagina do Google (noindex, fora do sitemap e do llms.txt) e outra
  decisao, com chave propria: ENXOVAL_OCULTO. Antes as duas coisas andavam
  juntas, e a pagina ficou fora do indice de 23/10 a 06/11 sem ninguem querer.
*/
const CHECKOUT_NORMAL: string = "https://pay.kiwify.com.br/lXH7CII";
const CHECKOUT_PROMO = "https://pay.kiwify.com.br/qnJu7ro";

export const ENXOVAL_NO_AR = CHECKOUT_NORMAL !== "";
export const ENXOVAL_OCULTO: boolean = false;

export const linkDeCompra = (promoAtiva: boolean) => (promoAtiva && CHECKOUT_PROMO) || CHECKOUT_NORMAL;
