/*
  Promocao com data para acabar (ex.: Promo 11.11), vinda de preco.promocao da
  oferta. Vale ate o fim do dia `ate` no horario de Brasilia; depois disso a
  pagina e o checkout voltam sozinhos ao preco normal, sem publicar de novo.
  O "de" mostrado e o preco normal, o que a pagina ja praticava.
*/

type Promocao = { nome: string; preco: number; precoTexto: string; ate: string };
type ComPreco = { preco: number; precoTexto: string; promocao: Promocao | null };

export type PrecoVigente = {
  preco: number;
  precoTexto: string;
  de: string | null; // preco normal riscado, so durante a promo
  promo: (Promocao & { fim: Date; ateCurto: string; ateLongo: string }) | null;
};

// Brasil sem horario de verao desde 2019: -03:00 o ano todo
const fimDaPromo = (ate: string) => new Date(`${ate}T23:59:59.999-03:00`);

export function precoVigente(o: ComPreco, agora = new Date()): PrecoVigente {
  const p = o.promocao;
  if (!p || agora > fimDaPromo(p.ate)) return { preco: o.preco, precoTexto: o.precoTexto, de: null, promo: null };
  const meio = new Date(`${p.ate}T12:00:00-03:00`);
  return {
    preco: p.preco,
    precoTexto: p.precoTexto,
    de: o.precoTexto,
    promo: {
      ...p,
      fim: fimDaPromo(p.ate),
      ateCurto: meio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
      ateLongo: meio.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }),
    },
  };
}
