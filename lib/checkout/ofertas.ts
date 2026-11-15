import manifesto from "@/entregaveis/manifesto.json";

/*
  O que cada oferta low ticket entrega pelo site. A venda, o pagamento, o order
  bump e o login da compradora ficam na Kiwify; as aulas da area de membros
  trazem os links para a Minha lista e os arquivos, e a pagina de obrigado da
  Kiwify cai direto em /obrigado/<oferta>.

  Cada oferta tem um codigo de acesso numa variavel de ambiente: o link so
  funciona com ele. Trocar a variavel (e os links das aulas) derruba os links
  antigos. Oferta nova entra aqui, com os arquivos em entregaveis/manifesto.json.
*/

export type Arquivo = { id: string; nome: string; rotulo: string; tipo: string };

export type OfertaEntrega = {
  slug: string;
  nome: string;
  pagina: string;
  variavelAcesso: string;
  arquivos: Arquivo[];
  temLista?: boolean; // a oferta tem a pagina Minha lista (/obrigado/<oferta>/lista)
  guardaRoupa?: string[]; // tamanhos da pagina Meu guarda-roupa (/obrigado/<oferta>/guarda-roupa)
};

// o que e interno (dados.json) nao aparece nem baixa: so o servidor le
const arquivosDe = (slug: string): Arquivo[] =>
  (manifesto as Record<string, (Arquivo & { interno?: boolean })[]>)[slug].filter((a) => !a.interno);

export const OFERTAS_ENTREGA: Record<string, OfertaEntrega> = {
  "ibk-enxoval": {
    slug: "ibk-enxoval",
    nome: "Enxoval na Medida",
    pagina: "/enxoval",
    variavelAcesso: "ACESSO_ENXOVAL",
    arquivos: arquivosDe("ibk-enxoval"),
    temLista: true,
  },
  "ibk-mala": {
    slug: "ibk-mala",
    nome: "Mala da maternidade",
    pagina: "/enxoval",
    variavelAcesso: "ACESSO_MALA",
    arquivos: arquivosDe("ibk-mala"),
  },
  // upsell do enxoval
  "ibk-guarda-roupa": {
    slug: "ibk-guarda-roupa",
    nome: "Guarda-roupa até os 3 anos",
    pagina: "/enxoval",
    variavelAcesso: "ACESSO_GUARDA_ROUPA",
    arquivos: arquivosDe("ibk-guarda-roupa"),
    guardaRoupa: ["1", "2", "3"],
  },
  // downsell: so o primeiro tamanho
  "ibk-guarda-roupa-1": {
    slug: "ibk-guarda-roupa-1",
    nome: "Guarda-roupa do tamanho 1",
    pagina: "/enxoval",
    variavelAcesso: "ACESSO_GUARDA_ROUPA_1",
    arquivos: arquivosDe("ibk-guarda-roupa-1"),
    guardaRoupa: ["1"],
  },
};

/*
  So no `next dev`: ?acesso=demo abre o enxoval e ?acesso=demo-guarda-roupa abre
  a oferta ibk-guarda-roupa, para conferir as telas. O build de producao troca
  NODE_ENV por "production" e esse caminho some.
*/
export function ofertaDoAcesso(acesso: unknown): OfertaEntrega | null {
  if (typeof acesso !== "string" || !acesso) return null;
  if (process.env.NODE_ENV === "development" && acesso.startsWith("demo")) {
    return OFERTAS_ENTREGA[acesso === "demo" ? "ibk-enxoval" : `ibk-${acesso.slice(5)}`] ?? null;
  }
  return Object.values(OFERTAS_ENTREGA).find((o) => process.env[o.variavelAcesso] === acesso) ?? null;
}
