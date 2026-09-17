/*
  Dados legais da loja, num lugar so. Aparecem no rodape, no /sobre, na
  politica de privacidade e na de trocas. O Decreto 7.962/2013 (comercio
  eletronico) exige razao social, CNPJ e endereco em destaque no site.

  PREENCHER antes de publicar: os campos com "[...]" sao placeholder.
*/
export const EMPRESA = {
  nomeFantasia: "Império Bem Kids",
  razaoSocial: "[RAZÃO SOCIAL]",
  cnpj: "[00.000.000/0001-00]",
  endereco: "[Rua, número, bairro]",
  cidadeUf: "[Cidade/UF]",
  cep: "[00000-000]",
  email: "[contato@imperiobemkids.com.br]",
  whatsapp: "+55 11 94795-6479",
  whatsappLink: "https://wa.me/5511947956479",
  // data da ultima revisao das politicas (aparece no rodape de cada uma)
  politicasRevisadasEm: "2026-09-17",
};

export const preenchido = (v: string) => !v.startsWith("[");
