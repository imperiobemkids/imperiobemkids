import { supabase } from "./supabase";

/*
  Clientes e filhos. O tamanho sugerido sai da idade, com a mesma tabela do
  post do blog (a altura manda, mas sem medida a idade e o melhor palpite).
*/
export type Crianca = {
  id: string;
  cliente_id: string;
  nome: string | null;
  nascimento: string | null;
  genero: string | null;
  tamanho_atual: string | null;
};

export type Cliente = {
  id: string;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  origem: string | null;
  obs: string | null;
  created_at: string;
  ibk_criancas: Crianca[];
};

export const ORIGENS = ["shopee", "grupo", "indicação", "instagram", "tiktok", "loja", "site"];

export function idadeTexto(nascimento: string | null): string {
  if (!nascimento) return "";
  const n = new Date(nascimento + "T12:00:00");
  const h = new Date();
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
  if (h.getDate() < n.getDate()) meses--;
  if (meses < 0) return "";
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export function tamanhoSugerido(nascimento: string | null): string {
  if (!nascimento) return "";
  const n = new Date(nascimento + "T12:00:00");
  const h = new Date();
  let meses = (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth());
  if (h.getDate() < n.getDate()) meses--;
  if (meses < 0) return "";
  if (meses < 1) return "RN";
  if (meses < 3) return "P";
  if (meses < 6) return "M";
  if (meses < 9) return "G";
  if (meses < 12) return "GG";
  const anos = meses / 12;
  if (anos < 2) return "1";
  if (anos < 3) return "2";
  if (anos < 4) return "3";
  if (anos < 5) return "4";
  if (anos < 7) return "6";
  if (anos < 9) return "8";
  if (anos < 11) return "10";
  return "12";
}

/* so digitos, com 55 na frente, pro link do WhatsApp */
export function linkWhatsapp(numero: string | null): string | null {
  if (!numero) return null;
  let d = numero.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}`;
}

/*
  Acha o cliente pelo nome (sem diferenciar maiuscula) ou cria um novo.
  Usado pelo caixa e pela importacao: a venda sempre aponta para alguem.
*/
export async function acharOuCriarCliente(nome: string, origem?: string): Promise<string | null> {
  if (!supabase) return null;
  const limpo = nome.trim();
  if (!limpo) return null;
  // "_" e "%" sao curinga no ilike: "ana_silva" casaria com "ana.silva"
  const escapado = limpo.replace(/[\%_]/g, (c) => "\\" + c);
  const { data } = await supabase.from("ibk_clientes").select("id").ilike("nome", escapado).limit(1);
  if (data && data[0]) return data[0].id;
  const { data: novo } = await supabase
    .from("ibk_clientes")
    .insert({ nome: limpo, origem: origem ?? null })
    .select("id")
    .single();
  return novo?.id ?? null;
}
