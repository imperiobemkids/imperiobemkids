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
