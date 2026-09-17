import { supabase } from "./supabase";
import { devolucaoEstoque } from "./estoque";

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

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

  for (const it of v.ibk_venda_itens) {
    if (it.produto_id) await devolucaoEstoque(it.produto_id, it.qtd, { vendaId: v.id, data });
  }

  const rotulo = motivo === "cancelado" ? "cancelada" : "devolvida";
  const movs: Record<string, unknown>[] = [
    { data, tipo: "saida", categoria: "venda", valor: v.preco_venda, descricao: `Estorno de venda ${rotulo}`, ref_venda_id: v.id },
  ];
  const taxa = v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0);
  if (taxa > 0) {
    movs.push({ data, tipo: "entrada", categoria: "taxa_shopee", valor: taxa, descricao: `Estorno da taxa (venda ${rotulo})`, ref_venda_id: v.id });
  }
  if (custo > 0) {
    movs.push({ data, tipo: "saida", categoria: "frete", valor: custo, descricao: "Custo da devolução (frete reverso e taxa retida)", ref_venda_id: v.id });
  }
  const { error: e1 } = await supabase.from("ibk_movimentos").insert(movs);
  if (e1) return e1.message;

  const { error: e2 } = await supabase
    .from("ibk_vendas")
    .update(
      motivo === "cancelado"
        ? { status: "cancelado", cancelado_em: data }
        : { status: "devolvido", devolvida: true, data_devolucao: data, custo_devolucao: custo },
    )
    .eq("id", v.id);
  return e2?.message ?? null;
}
