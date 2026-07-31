import { supabase } from "./supabase";

/*
  Motor de estoque do ERP. Toda entrada e saida passa por aqui para que:
  1) o custo medio ponderado (CMP) seja recalculado na entrada
  2) a movimentacao fique registrada no kardex (ibk_estoque_mov)

  CMP na entrada: (qtd_atual * custo_atual + qtd_nova * custo_novo) / (qtd_atual + qtd_nova)
  Na saida o custo NAO muda, apenas o saldo.
*/

type Origem = "compra" | "venda" | "ajuste" | "devolucao" | "inicial";

/*
  Custo medio ponderado calculado em CENTAVOS INTEIROS.
  Fazer a conta em reais com float erra: 1342/80 devolve 16,774999... e o
  arredondamento derruba para 16,77 em vez de 16,78. Um centavo por unidade
  vira distorcao de custo (e de margem) conforme o estoque gira.
*/
export function custoMedioPonderado(
  qtdAtual: number,
  custoAtual: number,
  qtdNova: number,
  custoNovo: number,
): number {
  const saldo = qtdAtual + qtdNova;
  if (saldo <= 0) return custoNovo;
  if (qtdAtual <= 0) return custoNovo;
  const centavosAtual = Math.round(qtdAtual * custoAtual * 100);
  const centavosNovo = Math.round(qtdNova * custoNovo * 100);
  return Math.round((centavosAtual + centavosNovo) / saldo) / 100;
}

type Ref = {
  loteId?: string | null;
  vendaId?: string | null;
  data?: string;
  obs?: string;
};

async function lerProduto(produtoId: string) {
  const { data, error } = await supabase!
    .from("ibk_produtos")
    .select("id, qtd_atual, qtd_inicial, custo_unit")
    .eq("id", produtoId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "produto nao encontrado");
  return data as { id: string; qtd_atual: number; qtd_inicial: number; custo_unit: number };
}

async function gravarMov(args: {
  produtoId: string;
  tipo: "entrada" | "saida" | "ajuste" | "devolucao";
  origem: Origem;
  qtd: number;
  custoUnit: number;
  saldoDepois: number;
  custoMedioDepois: number;
  ref?: Ref;
}) {
  await supabase!.from("ibk_estoque_mov").insert({
    produto_id: args.produtoId,
    tipo: args.tipo,
    origem: args.origem,
    qtd: args.qtd,
    custo_unit: args.custoUnit,
    saldo_depois: args.saldoDepois,
    custo_medio_depois: args.custoMedioDepois,
    ref_lote_id: args.ref?.loteId ?? null,
    ref_venda_id: args.ref?.vendaId ?? null,
    obs: args.ref?.obs ?? null,
    ...(args.ref?.data ? { data: args.ref.data } : {}),
  });
}

/** Entrada de estoque com recalculo do custo medio ponderado. */
export async function entradaEstoque(
  produtoId: string,
  qtd: number,
  custoUnit: number,
  origem: Origem = "compra",
  ref?: Ref,
) {
  if (!supabase || qtd <= 0) return;
  const p = await lerProduto(produtoId);

  const saldo = p.qtd_atual + qtd;
  // se o saldo anterior era zero, o custo passa a ser o da nova compra
  const arredondado = custoMedioPonderado(p.qtd_atual, p.custo_unit, qtd, custoUnit);

  await supabase.from("ibk_produtos").update({
    qtd_atual: saldo,
    qtd_inicial: p.qtd_inicial + qtd,
    custo_unit: arredondado,
  }).eq("id", produtoId);

  await gravarMov({
    produtoId, tipo: "entrada", origem, qtd, custoUnit,
    saldoDepois: saldo, custoMedioDepois: arredondado, ref,
  });
}

/** Saida de estoque (venda). O custo medio nao muda. */
export async function saidaEstoque(
  produtoId: string,
  qtd: number,
  origem: Origem = "venda",
  ref?: Ref,
) {
  if (!supabase || qtd <= 0) return;
  const p = await lerProduto(produtoId);
  const saldo = Math.max(0, p.qtd_atual - qtd);

  await supabase.from("ibk_produtos").update({ qtd_atual: saldo }).eq("id", produtoId);

  await gravarMov({
    produtoId, tipo: origem === "devolucao" ? "devolucao" : "saida", origem,
    qtd: -qtd, custoUnit: p.custo_unit,
    saldoDepois: saldo, custoMedioDepois: p.custo_unit, ref,
  });
}

/*
  Devolucao: a peca volta para o estoque pelo mesmo custo com que saiu, entao
  o custo medio NAO muda. Tambem nao mexe em qtd_inicial, para o giro continuar
  medindo o que foi realmente vendido.
*/
export async function devolucaoEstoque(produtoId: string, qtd: number, ref?: Ref) {
  if (!supabase || qtd <= 0) return;
  const p = await lerProduto(produtoId);
  const saldo = p.qtd_atual + qtd;

  await supabase.from("ibk_produtos").update({ qtd_atual: saldo }).eq("id", produtoId);

  await gravarMov({
    produtoId, tipo: "devolucao", origem: "devolucao",
    qtd, custoUnit: p.custo_unit,
    saldoDepois: saldo, custoMedioDepois: p.custo_unit,
    ref: { ...ref, obs: ref?.obs ?? "retorno de venda devolvida" },
  });
}

/** Ajuste manual (correcao de contagem). Registra a diferenca no kardex. */
export async function ajusteEstoque(produtoId: string, novaQtd: number, obs?: string) {
  if (!supabase) return;
  const p = await lerProduto(produtoId);
  const delta = novaQtd - p.qtd_atual;
  if (delta === 0) return;

  await supabase.from("ibk_produtos").update({ qtd_atual: novaQtd }).eq("id", produtoId);

  await gravarMov({
    produtoId, tipo: "ajuste", origem: "ajuste",
    qtd: delta, custoUnit: p.custo_unit,
    saldoDepois: novaQtd, custoMedioDepois: p.custo_unit,
    ref: { obs: obs ?? "ajuste manual de contagem" },
  });
}
