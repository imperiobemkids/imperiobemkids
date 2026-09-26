/*
  Reposicao: o que esta abaixo do minimo ou zerado, com o giro dos ultimos
  30 dias. Uma regra so para o Estoque e o Painel (antes o Painel contava
  qualquer SKU com ate 3 unidades e dava 22 alertas contra 4 da Reposicao).

  Sugestao de compra = o que falta pra cobrir 30 dias de venda com folga
  (1,5x) ou pra voltar ao dobro do minimo, o que for maior.
*/
export type ItemEstoque = {
  id: string;
  nome: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  cor: string | null;
  qtd_atual: number;
  estoque_minimo: number | null;
  tem_variacoes: boolean | null;
  produto_pai_id: string | null;
  fornecedor_id: string | null;
};

export type LinhaReposicao<P extends ItemEstoque> = {
  p: P;
  nome: string;
  minimo: number;
  giro: number; // unidades vendidas nos ultimos 30 dias
  comprar: number;
  dias: number | null; // dias de estoque no ritmo atual
  fornecedor: string | null;
};

export const nomeExibido = (p: Pick<ItemEstoque, "nome" | "linha" | "genero">) => {
  if (p.nome && p.nome.trim()) return p.nome.trim();
  const linha = p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "";
  const base = [linha, p.genero].filter(Boolean).join(" ");
  return base || "Produto";
};

export function calcularReposicao<P extends ItemEstoque>(rows: P[], vendidos30: Map<string, number>): LinhaReposicao<P>[] {
  const porId = new Map(rows.map((r) => [r.id, r]));
  const irmasDe = new Map<string, number>();
  for (const r of rows) if (r.produto_pai_id) irmasDe.set(r.produto_pai_id, (irmasDe.get(r.produto_pai_id) ?? 0) + 1);

  return rows
    .filter((p) => !p.tem_variacoes)
    .map((p) => {
      // variacao: o minimo do pai e do produto inteiro, entao rateia entre as variacoes
      // (nunca abaixo de 1). O gerador copiou o minimo do pai em cada variacao; valor
      // igual ao do pai conta como herdado, so um valor diferente e proprio da variacao.
      const pai = p.produto_pai_id ? porId.get(p.produto_pai_id) ?? null : null;
      const irmas = pai ? irmasDe.get(pai.id) || 1 : 1;
      const proprio = pai && p.estoque_minimo != null && p.estoque_minimo !== (pai.estoque_minimo ?? null);
      const minimo = pai ? (proprio ? p.estoque_minimo! : Math.max(1, Math.ceil((pai.estoque_minimo ?? 0) / irmas))) : (p.estoque_minimo ?? 0);
      const giro = vendidos30.get(p.id) ?? 0;
      const alvo = Math.max(Math.ceil(giro * 1.5), minimo * 2, giro > 0 || minimo > 0 ? 1 : 0);
      const comprar = Math.max(0, alvo - p.qtd_atual);
      const nome = pai ? `${nomeExibido(pai)} · ${[p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ")}` : nomeExibido(p);
      const dias = giro > 0 ? Math.floor(p.qtd_atual / (giro / 30)) : null;
      return { p, nome, minimo, giro, comprar, dias, fornecedor: (pai ?? p).fornecedor_id };
    })
    .filter((r) => r.p.qtd_atual === 0 || r.p.qtd_atual < r.minimo || (r.dias !== null && r.dias < 15))
    .filter((r) => r.comprar > 0 || r.p.qtd_atual === 0)
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999) || a.p.qtd_atual - b.p.qtd_atual);
}
