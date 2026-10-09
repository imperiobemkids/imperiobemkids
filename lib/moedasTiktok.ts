/*
  Calculadora de moedas do TikTok (pagina /calculadora-moedas-tiktok).

  O TikTok nao publica uma tabela oficial de quanto vale a moeda nem de quanto
  repassa ao criador. As referencias abaixo sao as mais citadas: US$ 0,013 por
  moeda (media dos pacotes) e cerca de 50% do valor do presente para o TikTok.
  Na pagina as duas sao editaveis.

  A cotacao do dolar e buscada no servidor (a CSP do site nao deixa o navegador
  chamar dominio de fora), em fontes gratuitas e sem chave: ver cotacaoDolar().
*/

export const VALOR_MOEDA_USD = 0.013;
export const COMISSAO_TIKTOK = 0.5;

export type Cotacao = { valor: number; em: string };

const buscar = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(6000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

const valida = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* data no formato que a API do Banco Central pede: MM-DD-AAAA */
const mdy = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;

/*
  Cotacao guardada por 6 horas. A AwesomeAPI fica atras da Cloudflare, que
  barra servidor de nuvem (no build da Vercel ela falhou em 08/10/2026), entao
  ha duas reservas: open.er-api.com (diaria) e a PTAX do Banco Central (oficial,
  dias uteis). Se as tres falharem, a pessoa digita o valor.
*/
export async function cotacaoDolar(): Promise<Cotacao | null> {
  const awesome = await buscar<{ USDBRL?: { bid?: string; create_date?: string } }>(
    "https://economia.awesomeapi.com.br/json/last/USD-BRL",
  );
  const a = valida(awesome?.USDBRL?.bid);
  if (a) return { valor: a, em: awesome?.USDBRL?.create_date ?? "" };

  const er = await buscar<{ rates?: { BRL?: number }; time_last_update_utc?: string }>("https://open.er-api.com/v6/latest/USD");
  const e = valida(er?.rates?.BRL);
  if (e) return { valor: e, em: er?.time_last_update_utc ?? "" };

  const hoje = new Date();
  const semanaPassada = new Date(hoje.getTime() - 7 * 86400000);
  const bcb = await buscar<{ value?: { cotacaoVenda?: number; dataHoraCotacao?: string }[] }>(
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
      `?@dataInicial='${mdy(semanaPassada)}'&@dataFinalCotacao='${mdy(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`,
  );
  const ultima = bcb?.value?.at(-1);
  const b = valida(ultima?.cotacaoVenda);
  if (b) return { valor: b, em: ultima?.dataHoraCotacao ?? "" };

  return null;
}

export function calcularMoedas(moedas: number, valorMoedaUsd: number, comissao: number) {
  const total = Math.max(0, moedas) * Math.max(0, valorMoedaUsd);
  const taxa = total * Math.min(1, Math.max(0, comissao));
  return { total, taxa, criador: total - taxa };
}
