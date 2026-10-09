/*
  Calculadora de moedas do TikTok (pagina /calculadora-moedas-tiktok).

  O TikTok nao publica uma tabela oficial de quanto vale a moeda nem de quanto
  repassa ao criador. As referencias abaixo sao as mais citadas: US$ 0,013 por
  moeda (media dos pacotes) e cerca de 50% do valor do presente para o TikTok.
  Na pagina as duas sao editaveis.

  A cotacao do dolar vem da AwesomeAPI (dolar comercial, gratuita e sem chave),
  buscada no servidor: a CSP do site nao deixa o navegador chamar dominio de fora.
*/

export const VALOR_MOEDA_USD = 0.013;
export const COMISSAO_TIKTOK = 0.5;

export type Cotacao = { valor: number; em: string };

/* cotacao guardada por 6 horas; se a API falhar, a pessoa digita o valor */
export async function cotacaoDolar(): Promise<Cotacao | null> {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { next: { revalidate: 21600 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { USDBRL?: { bid?: string; create_date?: string } };
    const valor = Number(j.USDBRL?.bid);
    if (!Number.isFinite(valor) || valor <= 0) return null;
    return { valor, em: j.USDBRL?.create_date ?? "" };
  } catch {
    return null;
  }
}

export function calcularMoedas(moedas: number, valorMoedaUsd: number, comissao: number) {
  const total = Math.max(0, moedas) * Math.max(0, valorMoedaUsd);
  const taxa = total * Math.min(1, Math.max(0, comissao));
  return { total, taxa, criador: total - taxa };
}
