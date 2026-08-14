/*
  Taxa do canal conforme o preco.

  As plataformas cobram por faixa: o TikTok Shop leva 10% + R$ 4 abaixo de R$ 50
  e 6% + R$ 6 a partir de R$ 50. Como os kits ficam em cima dessa linha, usar uma
  taxa unica deixaria a margem errada em toda venda.

  Canal sem faixas cadastradas continua usando taxa_pct e taxa_fixa.
*/

export type Faixa = { ate: number | null; pct: number; fixo: number };

export type CanalTaxas = {
  taxa_pct: number;
  taxa_fixa: number;
  faixas?: Faixa[] | null;
  taxa_fixa_por_item?: boolean | null;
};

/** Devolve a comissao e a tarifa fixa que valem para este preco. */
export function taxaDoPreco(canal: CanalTaxas | undefined, preco: number) {
  if (!canal) return { pct: 0.2, fixo: 0 };

  const faixas = Array.isArray(canal.faixas) ? canal.faixas : [];
  if (faixas.length === 0) {
    return { pct: canal.taxa_pct, fixo: canal.taxa_fixa };
  }

  // da menor para a maior; "ate: null" e a ultima, sem teto
  const ordenadas = [...faixas].sort((a, b) => {
    if (a.ate === null) return 1;
    if (b.ate === null) return -1;
    return a.ate - b.ate;
  });

  for (const f of ordenadas) {
    if (f.ate === null || preco < f.ate) return { pct: f.pct, fixo: f.fixo };
  }
  const ultima = ordenadas[ordenadas.length - 1];
  return { pct: ultima.pct, fixo: ultima.fixo };
}

export type ItemVenda = { precoUnit: number; qtd: number };

/*
  Taxa total do pedido.

  A tarifa fixa e cobrada POR ITEM do pedido ("Taxa por item vendido" no extrato
  da Shopee): item aqui e a quantidade pedida, nao a peca fisica, entao um
  produto que ja vem com 3 pecas dentro conta como um item so.

  A faixa e resolvida pelo PRECO DO ITEM, nao pelo total do pedido: a regra do
  TikTok fala em "itens com preco inferior a R$ 50".

  O desconto do vendedor reduz a base, rateado entre os itens.
*/
export function calcularTaxas(
  canal: CanalTaxas | undefined,
  itens: ItemVenda[],
  desconto = 0,
) {
  const subtotal = itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0);
  const proporcao = subtotal > 0 ? Math.max(0, subtotal - desconto) / subtotal : 1;
  const porItem = canal?.taxa_fixa_por_item ?? true;

  let comissao = 0;
  let fixa = 0;
  let unidades = 0;

  for (const i of itens) {
    const precoLiquido = i.precoUnit * proporcao;
    const t = taxaDoPreco(canal, precoLiquido);
    comissao += precoLiquido * i.qtd * t.pct;
    unidades += i.qtd;
    if (porItem) fixa += t.fixo * i.qtd;
  }

  // canal que cobra por pedido paga a tarifa uma vez, pela faixa do total
  if (!porItem && itens.length > 0) {
    fixa = taxaDoPreco(canal, subtotal * proporcao).fixo;
  }

  return {
    comissao: Math.round(comissao * 100) / 100,
    fixa: Math.round(fixa * 100) / 100,
    total: Math.round((comissao + fixa) * 100) / 100,
    unidades,
  };
}

/** Texto curto da regra, para explicar na tela de onde saiu a taxa. */
export function descreverFaixas(canal: CanalTaxas | undefined) {
  const faixas = canal && Array.isArray(canal.faixas) ? canal.faixas : [];
  if (faixas.length === 0) return null;
  return faixas
    .map((f) => {
      const onde = f.ate === null ? "acima disso" : `até R$ ${f.ate}`;
      return `${onde}: ${Math.round(f.pct * 1000) / 10}% + R$ ${f.fixo.toFixed(2).replace(".", ",")}`;
    })
    .join(" · ");
}
