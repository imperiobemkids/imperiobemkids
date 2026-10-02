import { supabase } from "./supabase";
import { devolucaoEstoque, saidaEstoque } from "./estoque";
import { hojeIso } from "./formato";
export { hojeIso };

/*
  Ciclo do pedido. A venda nasce "aguardando" (envio), vai a "enviado" quando
  ganha rastreio, "entregue" quando o comprador recebe. Sai do ciclo por
  "cancelado" (antes de entregar: estoque volta, caixa estorna, sem custo) ou
  "devolvido" (depois de entregue: estoque volta, caixa estorna, e sobra o
  custo do frete reverso e da taxa que a plataforma retem).
*/
export type StatusPedido = "aguardando" | "enviado" | "entregue" | "cancelado" | "devolvido";

export const STATUS: Record<StatusPedido, { rotulo: string; cor: string; ordem: number }> = {
  aguardando: { rotulo: "aguardando envio", cor: "bg-[var(--sun)]/40 text-[var(--ink)]", ordem: 1 },
  enviado: { rotulo: "enviado", cor: "bg-sky-100 text-sky-800", ordem: 2 },
  entregue: { rotulo: "entregue", cor: "bg-emerald-100 text-emerald-700", ordem: 3 },
  cancelado: { rotulo: "cancelado", cor: "bg-[var(--ink)]/8 text-[var(--ink)]/60", ordem: 4 },
  devolvido: { rotulo: "devolvido", cor: "bg-red-100 text-red-600", ordem: 5 },
};

// venda que ja saiu do faturamento (nao conta em vendido nem em lucro positivo)
export const estornada = (s: StatusPedido) => s === "cancelado" || s === "devolvido";

/* dias uteis (seg a sex) entre duas datas ISO, sem contar o dia inicial */
export function diasUteisEntre(deIso: string, ateIso: string): number {
  const de = new Date(deIso + "T12:00:00");
  const ate = new Date(ateIso + "T12:00:00");
  let n = 0;
  const d = new Date(de);
  while (d < ate) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/*
  Prazo de despacho: a Shopee exige postar em ate 2 dias uteis. Aviso a partir
  de 1 dia util sem envio, atraso a partir de 2.
*/
export function situacaoDespacho(dataVenda: string, status: StatusPedido) {
  if (status !== "aguardando") return null;
  const dias = diasUteisEntre(dataVenda, hojeIso());
  if (dias >= 2) return { nivel: "atrasado" as const, dias };
  if (dias >= 1) return { nivel: "vence" as const, dias };
  return { nivel: "ok" as const, dias };
}

type VendaEstorno = {
  id: string;
  preco_venda: number;
  taxa_pct: number;
  taxa_fixa: number;
  ibk_venda_itens: { produto_id: string | null; qtd: number }[];
};

/*
  Estorna uma venda: pecas voltam ao estoque (custo medio nao muda), o caixa
  recebe o estorno da venda e a devolucao da taxa, e o custo (se houver) sai.
  Serve para cancelamento (custo 0) e devolucao (custo do frete reverso etc).
*/
export async function estornarVenda(
  v: VendaEstorno,
  motivo: "cancelado" | "devolvido",
  custo: number,
): Promise<string | null> {
  if (!supabase) return "banco nao configurado";
  const data = hojeIso();

  /*
    Primeiro troca o status, e so se a venda ainda estiver no ciclo. Assim um
    clique duplo ou a mesma venda aberta em duas abas nao devolve a peca e
    estorna o caixa duas vezes: a segunda tentativa nao acha a venda e para aqui.
  */
  const { data: trocou, error: e0 } = await supabase
    .from("ibk_vendas")
    .update(
      motivo === "cancelado"
        ? { status: "cancelado", cancelado_em: data }
        : { status: "devolvido", devolvida: true, data_devolucao: data, custo_devolucao: custo },
    )
    .eq("id", v.id)
    .not("status", "in", "(cancelado,devolvido)")
    .select("id");
  if (e0) return e0.message;
  if (!trocou || trocou.length === 0) return "essa venda já foi cancelada ou devolvida";

  for (const it of v.ibk_venda_itens) {
    if (it.produto_id) await devolucaoEstoque(it.produto_id, it.qtd, { vendaId: v.id, data });
  }

  const rotulo = motivo === "cancelado" ? "cancelada" : "devolvida";
  const movs: Record<string, unknown>[] = [];

  /*
    Fiado que ainda nao foi pago: o dinheiro nunca entrou, entao nao ha venda
    para estornar, so a conta a receber sai. A taxa do canal, se houve, foi
    lancada como paga no registro da venda e volta nos dois casos.
  */
  const { data: pendentes } = await supabase
    .from("ibk_movimentos")
    .select("id")
    .eq("ref_venda_id", v.id)
    .eq("tipo", "entrada")
    .eq("pago", false);
  if (pendentes && pendentes.length > 0) {
    await supabase.from("ibk_movimentos").delete().in("id", pendentes.map((p) => p.id));
  } else {
    movs.push({ data, tipo: "saida", categoria: "venda", valor: v.preco_venda, descricao: `Estorno de venda ${rotulo}`, ref_venda_id: v.id });
  }
  const taxa = v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0);
  if (taxa > 0) {
    movs.push({ data, tipo: "entrada", categoria: "taxa_shopee", valor: taxa, descricao: `Estorno da taxa (venda ${rotulo})`, ref_venda_id: v.id });
  }
  if (custo > 0) {
    movs.push({ data, tipo: "saida", categoria: "frete", valor: custo, descricao: "Custo da devolução (frete reverso e taxa retida)", ref_venda_id: v.id });
  }
  if (movs.length === 0) return null;
  const { error: e1 } = await supabase.from("ibk_movimentos").insert(movs);
  return e1?.message ?? null;
}

/*
  Troca o produto de um item ja vendido (lancado no tamanho ou modelo errado).
  A peca errada volta ao estoque e a certa sai, as duas com a venda no kardex.
  Preco e quantidade do item ficam; o lucro acompanha o custo do produto novo.
*/
export async function trocarItemVenda(vendaId: string, itemId: string, novoProdutoId: string): Promise<string | null> {
  if (!supabase) return "banco nao configurado";
  const { data: it, error: e0 } = await supabase
    .from("ibk_venda_itens")
    .select("id, produto_id, qtd")
    .eq("id", itemId)
    .eq("venda_id", vendaId)
    .single();
  if (e0 || !it) return e0?.message ?? "item não encontrado";
  if (it.produto_id === novoProdutoId) return null;
  const { data: novo, error: e1 } = await supabase.from("ibk_produtos").select("qtd_atual, tem_variacoes").eq("id", novoProdutoId).single();
  if (e1 || !novo) return e1?.message ?? "produto não encontrado";
  if (novo.tem_variacoes) return "escolha o tamanho (a variação), não o produto principal";

  /*
    Venda de antes da grade de tamanhos aponta para o produto principal, que
    hoje so agrupa. A peca ja saiu do saldo que foi dividido entre os tamanhos,
    entao a troca so corrige o rotulo: devolver ao principal criaria estoque
    que nao existe.
  */
  const soRotulo = it.produto_id ? await ehAgrupador(it.produto_id) : false;
  if (!soRotulo && novo.qtd_atual < it.qtd) return `estoque insuficiente do produto novo: tem ${novo.qtd_atual}`;

  const data = hojeIso();
  if (soRotulo) {
    const { error } = await supabase.from("ibk_venda_itens").update({ produto_id: novoProdutoId }).eq("id", itemId);
    return error?.message ?? null;
  }
  /*
    Sem transacao no REST, a ordem e o que protege: primeiro sai a peca certa,
    depois o item muda, por ultimo a errada volta. Se algo falhar, para ali e
    a mensagem diz em que passo, para corrigir pelo ajuste do estoque.
  */
  try {
    await saidaEstoque(novoProdutoId, it.qtd, "venda", { vendaId, data, obs: "troca de item: produto certo da venda" });
  } catch (e) {
    return e instanceof Error ? e.message : "erro ao baixar o produto novo";
  }
  const { error: e2 } = await supabase.from("ibk_venda_itens").update({ produto_id: novoProdutoId }).eq("id", itemId);
  if (e2) return `a peça nova já saiu do estoque, mas o item não mudou: ${e2.message}`;
  if (it.produto_id) {
    try {
      await devolucaoEstoque(it.produto_id, it.qtd, { vendaId, data, obs: "troca de item: lançado no produto errado, voltou ao estoque" });
    } catch (e) {
      return `o item mudou, mas a peça antiga não voltou ao estoque: ${e instanceof Error ? e.message : "erro"}`;
    }
  }
  return null;
}

async function ehAgrupador(produtoId: string) {
  const { data } = await supabase!.from("ibk_produtos").select("tem_variacoes").eq("id", produtoId).single();
  return !!data?.tem_variacoes;
}

/*
  Fiado: venda entregue que a cliente paga depois. A receita e o custo contam
  no dia da venda (DRE), mas o dinheiro so entra no caixa quando ela paga:
  ate la a entrada fica com pago = false e aparece em "A receber".
*/
export const FIADO = "fiado";
export const fiadoAberto = (v: { forma_pagamento?: string | null; recebido?: number | null; status?: StatusPedido | null }) =>
  v.forma_pagamento === FIADO && v.recebido == null && !(v.status && estornada(v.status));

/*
  Pagamento, separado da entrega: o pedido pode estar entregue e ainda nao
  pago (fiado), ou pago e ainda nao enviado (marketplace). Venda de
  marketplace fica "repasse pendente" ate a conciliacao; venda direta sem taxa
  e recebida no ato. Verde nas duas colunas quer dizer concluido.
*/
export type SituacaoPagamento = "pago" | "a_receber" | "repasse" | "estornado";
export const PAGAMENTO: Record<SituacaoPagamento, { rotulo: string; cor: string; explica: string }> = {
  pago: { rotulo: "pago", cor: "bg-emerald-100 text-emerald-700", explica: "o dinheiro já entrou" },
  a_receber: { rotulo: "a receber", cor: "bg-amber-100 text-amber-800", explica: "fiado: a cliente paga depois" },
  repasse: { rotulo: "repasse pendente", cor: "bg-[var(--purple)]/10 text-[var(--purple-dark)]", explica: "vendeu no marketplace e a plataforma ainda não depositou" },
  estornado: { rotulo: "estornado", cor: "bg-[var(--ink)]/8 text-[var(--ink)]/60", explica: "cancelado ou devolvido, o valor voltou" },
};
export function situacaoPagamento(v: {
  status: StatusPedido;
  forma_pagamento?: string | null;
  recebido?: number | null;
  taxa_pct: number;
  taxa_fixa?: number | null;
}): SituacaoPagamento {
  if (estornada(v.status)) return "estornado";
  if (v.recebido != null) return "pago";
  if (v.forma_pagamento === FIADO) return "a_receber";
  if (v.taxa_pct > 0 || (v.taxa_fixa ?? 0) > 0) return "repasse";
  return "pago"; // venda direta sem taxa: recebida no ato
}

/*
  Quanto ainda vai entrar desta venda. Fiado: o total, que e o que a cliente
  deve e o que a entrada do caixa espera. Marketplace: o repasse, liquido de
  taxa e do frete pago pela loja.
*/
export const valorAReceber = (v: { preco_venda: number; taxa_pct: number; taxa_fixa?: number | null; frete: number; forma_pagamento?: string | null }) =>
  v.forma_pagamento === FIADO ? v.preco_venda : v.preco_venda * (1 - v.taxa_pct) - (v.taxa_fixa ?? 0) - v.frete;

/* quitacao do fiado: a entrada do caixa vira paga hoje e a venda fica recebida */
export async function receberFiado(vendaId: string, data = hojeIso()): Promise<string | null> {
  if (!supabase) return "banco nao configurado";
  const { data: venda, error: e0 } = await supabase.from("ibk_vendas").select("preco_venda, frete").eq("id", vendaId).single();
  if (e0 || !venda) return e0?.message ?? "venda nao encontrada";
  const { error: e1 } = await supabase
    .from("ibk_movimentos")
    .update({ pago: true, data_pagamento: data })
    .eq("ref_venda_id", vendaId)
    .eq("tipo", "entrada")
    .eq("pago", false);
  if (e1) return e1.message;
  const { error: e2 } = await supabase
    .from("ibk_vendas")
    .update({
      recebido: Math.round((venda.preco_venda - (venda.frete ?? 0)) * 100) / 100,
      data_recebimento: data,
      obs_conciliacao: "fiado recebido",
    })
    .eq("id", vendaId)
    .is("recebido", null);
  return e2?.message ?? null;
}

/*
  Registra uma venda inteira: cabecalho, itens, baixa de estoque e caixa
  (entrada da venda, saida da comissao e da fixa). E a UNICA sequencia; o
  caixa manual e a importacao chamam daqui, senao cada tela derivava a sua.
  Devolve o id da venda ou a mensagem de erro.
*/
export type NovaVendaDados = {
  data: string;
  canalNome: string;
  canalId: string | null;
  itens: { produtoId: string; qtd: number; precoUnit: number }[];
  total: number;
  desconto?: number;
  comissao: number; // em reais, ja calculada pelo canal
  taxaFixa: number;
  insumo: number;
  freteCobrado?: number;
  frete?: number;
  cliente?: string | null;
  clienteId?: string | null;
  pedidoExterno?: string | null;
  status: StatusPedido;
  formaPagamento?: string | null;
  vencimento?: string | null; // so no fiado: quando a cliente combinou de pagar
  rastreio?: string | null;
  enviadoEm?: string | null;
  entregueEm?: string | null;
  nfNumero?: string | null;
  obs?: string | null;
  descricaoCaixa?: string; // ex: "Venda Shopee #123"
};

export async function registrarVenda(v: NovaVendaDados): Promise<{ id: string } | { erro: string }> {
  if (!supabase) return { erro: "banco nao configurado" };
  const unidades = v.itens.reduce((s, i) => s + i.qtd, 0);
  const fiado = v.formaPagamento === FIADO;
  const { data: venda, error: e1 } = await supabase
    .from("ibk_vendas")
    .insert({
      data: v.data,
      canal: v.canalNome.toLowerCase().slice(0, 20),
      canal_id: v.canalId,
      tipo: unidades > 1 ? "kit" : "avulso",
      cliente: v.cliente ?? null,
      cliente_id: v.clienteId ?? null,
      pedido_externo: v.pedidoExterno ?? null,
      status: v.status,
      forma_pagamento: v.formaPagamento ?? null,
      preco_venda: Math.round(v.total * 100) / 100,
      desconto: Math.round((v.desconto ?? 0) * 100) / 100,
      taxa_pct: v.total > 0 ? v.comissao / v.total : 0,
      taxa_fixa: v.taxaFixa,
      insumo_custo: v.insumo,
      frete_cobrado: v.freteCobrado ?? 0,
      frete: v.frete ?? 0,
      qtd_itens: unidades,
      rastreio: v.rastreio ?? null,
      enviado_em: v.enviadoEm ?? null,
      entregue_em: v.entregueEm ?? null,
      nf_numero: v.nfNumero ?? null,
      obs: v.obs ?? null,
      // canal sem taxa (loja fisica, WhatsApp/Pix) recebe no ato: nao tem repasse a conciliar.
      // Fiado e a excecao: so fica recebido quando a cliente paga (receberFiado)
      ...(v.comissao === 0 && v.taxaFixa === 0 && !fiado
        ? { recebido: Math.round((v.total - (v.frete ?? 0)) * 100) / 100, data_recebimento: v.data, obs_conciliacao: "recebido no ato" }
        : {}),
    })
    .select("id")
    .single();
  if (e1 || !venda) return { erro: e1?.message ?? "erro ao criar a venda" };

  const { error: e2 } = await supabase.from("ibk_venda_itens").insert(
    v.itens.map((i) => ({ venda_id: venda.id, produto_id: i.produtoId, qtd: i.qtd, preco_unit: i.precoUnit })),
  );
  if (e2) {
    // sem itens a venda fica orfa: apaga o cabecalho pra nao sobrar venda vazia
    await supabase.from("ibk_vendas").delete().eq("id", venda.id);
    return { erro: e2.message };
  }

  for (const i of v.itens) {
    await saidaEstoque(i.produtoId, i.qtd, "venda", { vendaId: venda.id, data: v.data });
  }

  const desc = v.descricaoCaixa ?? `Venda ${v.canalNome}${v.cliente ? ` para ${v.cliente}` : ""}`;
  const movs: Record<string, unknown>[] = [
    fiado
      ? { data: v.data, tipo: "entrada", categoria: "venda", valor: v.total, descricao: `${desc} (fiado)`, ref_venda_id: venda.id, pago: false, vencimento: v.vencimento ?? null, forma_pagamento: FIADO }
      : { data: v.data, tipo: "entrada", categoria: "venda", valor: v.total, descricao: desc, ref_venda_id: venda.id },
  ];
  if (v.comissao > 0) movs.push({ data: v.data, tipo: "saida", categoria: "taxa_shopee", valor: v.comissao, descricao: `Comissão ${v.canalNome}`, ref_venda_id: venda.id });
  if (v.taxaFixa > 0) movs.push({ data: v.data, tipo: "saida", categoria: "taxa_shopee", valor: v.taxaFixa, descricao: `Tarifa fixa ${v.canalNome}`, ref_venda_id: venda.id });
  const { error: e3 } = await supabase.from("ibk_movimentos").insert(movs);
  if (e3) return { erro: e3.message };
  return { id: venda.id };
}

/*
  Lucro de uma venda, uma regra so: cancelada nao lucra nem perde; devolvida
  perde o custo da devolucao; o resto e preco menos taxas, embalagem, frete e
  custo dos produtos.
*/
export function lucroDaVenda(v: {
  status?: StatusPedido | null;
  devolvida?: boolean | null;
  custo_devolucao?: number | null;
  preco_venda: number;
  taxa_pct: number;
  taxa_fixa?: number | null;
  insumo_custo: number;
  frete: number;
  ibk_venda_itens: { qtd: number; produto: { custo_unit: number } | null }[];
}): number {
  if (v.status === "cancelado") return 0;
  if (v.devolvida || v.status === "devolvido") return -(v.custo_devolucao ?? 0);
  const custo = v.ibk_venda_itens.reduce((s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd, 0);
  return v.preco_venda * (1 - v.taxa_pct) - custo - v.insumo_custo - (v.taxa_fixa ?? 0) - v.frete;
}
