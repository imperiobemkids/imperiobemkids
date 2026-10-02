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

/*
  Estoque parado: produto com peca e sem venda ha muitos dias. Conta por
  produto (as variacoes somadas no pai), porque a decisao e de produto: puxar
  na live, fazer oferta, parar de comprar. Venda antiga lancada no pai ou numa
  variacao ja desativada conta para o produto. Sem venda nenhuma, conta desde
  que o produto entrou no estoque.
*/
export type ProdutoParado = {
  id: string; // do produto pai, ou do produto simples
  nome: string;
  qtd: number;
  valor: number; // a preco de custo
  ultimaVenda: string | null; // ISO; null = nunca vendeu
  desde: string; // ultima venda ou entrada no estoque
  dias: number;
};

type ItemParado = Pick<ItemEstoque, "id" | "nome" | "linha" | "genero" | "qtd_atual" | "tem_variacoes" | "produto_pai_id"> & {
  custo_unit: number;
  created_at?: string | null;
};

/* ultimaVenda: chave = id do produto pai (ou do simples) -> data ISO da venda mais recente */
export function calcularParados(rows: ItemParado[], ultimaVenda: Map<string, string>, hoje: string): ProdutoParado[] {
  const grupos = new Map<string, { pai: ItemParado | null; membros: ItemParado[] }>();
  for (const r of rows) {
    const chave = r.produto_pai_id ?? r.id;
    const g = grupos.get(chave) ?? { pai: null, membros: [] };
    if (r.id === chave) g.pai = r;
    if (!r.tem_variacoes) g.membros.push(r);
    grupos.set(chave, g);
  }
  const dia = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").getTime();
  const out: ProdutoParado[] = [];
  for (const [chave, { pai, membros }] of grupos) {
    const qtd = membros.reduce((s, m) => s + m.qtd_atual, 0);
    if (qtd <= 0) continue;
    const valor = membros.reduce((s, m) => s + m.qtd_atual * m.custo_unit, 0);
    // entrada no estoque: o cadastro mais antigo do grupo (a grade nova herda a data do pai)
    const entradas = [pai, ...membros].map((x) => x?.created_at?.slice(0, 10)).filter(Boolean) as string[];
    const entrou = entradas.sort()[0] ?? hoje;
    const ultima = ultimaVenda.get(chave) ?? null;
    const desde = ultima && ultima > entrou ? ultima : entrou;
    out.push({
      id: chave,
      nome: nomeExibido(pai ?? membros[0]),
      qtd,
      valor,
      ultimaVenda: ultima,
      desde,
      dias: Math.max(0, Math.round((dia(hoje) - dia(desde)) / 86400000)),
    });
  }
  return out.sort((a, b) => b.dias - a.dias || b.valor - a.valor);
}
