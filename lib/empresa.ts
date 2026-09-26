/*
  Dados legais da loja, num lugar so. Aparecem no rodape, no /sobre, na
  politica de privacidade e na de trocas. O Decreto 7.962/2013 (comercio
  eletronico) exige razao social, CNPJ e endereco em destaque no site.

  Endereco completo e CEP ainda nao informados: por enquanto so cidade/UF.
*/
export const EMPRESA = {
  nomeFantasia: "Império Bem Kids",
  razaoSocial: "Império Bem Kids",
  cnpj: "63.300.740/0001-63",
  endereco: "",
  cidadeUf: "São Paulo/SP",
  cep: "",
  email: "imperiobemkids@gmail.com",
  whatsapp: "+55 11 94795-6479",
  whatsappLink: "https://wa.me/5511947956479",
  grupoAchadinhos: "https://chat.whatsapp.com/GKQ58djmnyGHG2HMrPUxYb",
  // perfil da loja em cada marketplace (secao "Nossas lojas" do /pedido)
  lojas: {
    shopee: "https://s.shopee.com.br/2qUrOrWHk8",
    mercadoLivre: "https://lista.mercadolivre.com.br/_CustId_1044208642",
    kwai: "https://s.kw.ai/w/Pe5CgyXU",
  },
  // data da ultima revisao das politicas (aparece no rodape de cada uma)
  politicasRevisadasEm: "2026-09-17",
};

// endereco em uma linha, pulando o que estiver vazio
export const enderecoLinha = () =>
  [EMPRESA.endereco, EMPRESA.cidadeUf, EMPRESA.cep && `CEP ${EMPRESA.cep}`].filter(Boolean).join(", ");
