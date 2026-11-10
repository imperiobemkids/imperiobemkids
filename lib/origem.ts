/*
  Origem da visita, para o checkout da Kiwify saber de onde veio cada venda: o
  relatorio de vendas de la mostra utm_source, utm_campaign e src.

  Guarda na primeira pagina da visita (nesta aba) os parametros de campanha da
  URL e a pagina de entrada, que vai em `src`. Sem UTM, a origem sai do site
  que trouxe a pessoa (Google, Instagram). Um link novo com UTM ou clique de
  anuncio na mesma aba troca a origem. O fbclid segue junto para o Pixel da
  pagina de pagamento ligar a compra ao anuncio.

  Vale so para o link de saida: link interno continua sem UTM, para nao
  quebrar a atribuicao do Analytics.
*/
const CHAVE = "ibk-origem";
const DA_URL = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
const CAMPOS = [...DA_URL, "src"];
// as mesmas areas sem medicao do Pixel e do Analytics
const PRIVADO = ["/admin", "/portal", "/obrigado"];
const BUSCADOR = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\.|^search\.brave\.com$/;

type Origem = Record<string, string>;

const pagina = (caminho: string) => caminho.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9/_-]/gi, "").slice(0, 100) || "home";

function doSiteAnterior(): Origem {
  if (!document.referrer) return {};
  const host = new URL(document.referrer).hostname.replace(/^www\./, "");
  if (host === window.location.hostname.replace(/^www\./, "")) return {};
  return { utm_source: host, utm_medium: BUSCADOR.test(host) ? "organic" : "referral" };
}

export function guardarOrigem() {
  try {
    const url = new URL(window.location.href);
    if (PRIVADO.some((p) => url.pathname.startsWith(p))) return;
    const daUrl: Origem = {};
    for (const campo of DA_URL) {
      const valor = url.searchParams.get(campo);
      if (valor) daUrl[campo] = valor.slice(0, 200);
    }
    // sem parametro novo, continua valendo a primeira pagina da visita
    if (sessionStorage.getItem(CHAVE) && Object.keys(daUrl).length === 0) return;
    const origem: Origem = { ...(daUrl.utm_source ? {} : doSiteAnterior()), ...daUrl, src: pagina(url.pathname) };
    sessionStorage.setItem(CHAVE, JSON.stringify(origem));
  } catch {
    // navegador sem armazenamento: o link sai sem origem
  }
}

/* o link de saida com a origem guardada; sem origem, devolve o link como veio */
export function comOrigem(href: string): string {
  try {
    guardarOrigem();
    const origem = JSON.parse(sessionStorage.getItem(CHAVE) ?? "null") as Origem | null;
    if (!origem) return href;
    const url = new URL(href);
    for (const campo of CAMPOS) {
      if (typeof origem[campo] === "string" && origem[campo]) url.searchParams.set(campo, origem[campo]);
    }
    return url.toString();
  } catch {
    return href;
  }
}
