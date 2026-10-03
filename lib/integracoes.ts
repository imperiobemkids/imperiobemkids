import { supabase } from "./supabase";

/*
  Integracoes por API com os marketplaces, lado do navegador. Quem fala com a
  plataforma e o servidor (app/api/<plataforma>/[acao]); aqui ficam a chamada
  com o login do ERP e as regras que valem para todas: vinculo do anuncio com o
  estoque, conta do estoque de cada anuncio e a baixa automatica depois de uma
  saida. Toda rota de plataforma responde as mesmas acoes com os mesmos
  formatos (status, conectar, token, anuncios, pedidos, estoque).
*/

export type Plataforma = "shopee" | "mercadolivre" | "tiktok" | "kwai";

// api: ja tem rota no servidor. As outras entram quando o app delas for aprovado
export const PLATAFORMAS: Record<Plataforma, { rotulo: string; canal: RegExp; api: boolean }> = {
  shopee: { rotulo: "Shopee", canal: /shopee/i, api: true },
  mercadolivre: { rotulo: "Mercado Livre", canal: /mercado\s*livre/i, api: true },
  tiktok: { rotulo: "TikTok Shop", canal: /tiktok/i, api: false },
  kwai: { rotulo: "Kwai Shop", canal: /kwai/i, api: false },
};

export async function chamarApi<T>(plataforma: Plataforma, acao: string, corpo: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error("banco nao configurado");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("entre no ERP de novo");
  const res = await fetch(`/api/${plataforma}/${acao}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  const json = (await res.json().catch(() => ({}))) as T & { erro?: string };
  if (!res.ok || json.erro) throw new Error(json.erro || `erro ${res.status}`);
  return json;
}

/* canal do ERP que e a loja da plataforma: o da conexao, senao o canal com o nome dela */
export async function canalDaPlataforma(plataforma: Plataforma): Promise<string | null> {
  if (!supabase) return null;
  const con = await supabase.from("ibk_integracoes").select("canal_id").eq("plataforma", plataforma).limit(1);
  const conectado = (con.data?.[0] as { canal_id: string } | undefined)?.canal_id;
  if (conectado) return conectado;
  const { data } = await supabase.from("ibk_canais").select("id, nome").order("ordem");
  return ((data ?? []) as { id: string; nome: string }[]).find((c) => PLATAFORMAS[plataforma].canal.test(c.nome))?.id ?? null;
}

export type Vinculo = {
  id: string;
  canal_id: string;
  id_anuncio: string;
  id_variacao: string;
  produto_id: string;
  conjuntos: number;
  titulo: string | null;
  variacao: string | null;
  sku: string | null;
  estoque_enviado: number | null;
  enviado_em: string | null;
};

export type ResultadoEstoque = { idAnuncio: string; idVariacao: string; estoque: number; ok: boolean; motivo?: string };

/* o que cada anuncio pode mostrar: o saldo do tamanho dividido pelos conjuntos que cada unidade leva */
export const estoqueDoAnuncio = (saldo: number, conjuntos: number) => Math.max(0, Math.floor(saldo / Math.max(1, conjuntos)));

/*
  Envia o estoque calculado pelo ERP para os anuncios vinculados de um canal.
  soBaixar: so manda quando o numero novo e MENOR que o ultimo enviado. E o
  modo automatico depois de uma venda: enquanto um pedido da plataforma ainda
  nao foi importado, o ERP nao sabe dele, e subir o estoque poderia vender
  peca que ja saiu. Subir fica para o envio manual, depois de importar os pedidos.
*/
export async function enviarEstoque(
  plataforma: Plataforma,
  op: { canalId?: string; produtoIds?: string[]; soBaixar?: boolean } = {},
): Promise<ResultadoEstoque[]> {
  if (!supabase || !PLATAFORMAS[plataforma].api) return [];
  const canalId = op.canalId ?? (await canalDaPlataforma(plataforma));
  if (!canalId) return [];
  let q = supabase.from("ibk_anuncio_vinculos").select("*").eq("canal_id", canalId);
  if (op.produtoIds?.length) q = q.in("produto_id", op.produtoIds);
  const { data: vs, error } = await q;
  if (error || !vs?.length) return [];
  const vinculos = vs as Vinculo[];

  const ids = [...new Set(vinculos.map((v) => v.produto_id))];
  const { data: ps, error: e2 } = await supabase.from("ibk_produtos").select("id, qtd_atual").in("id", ids);
  // sem o saldo nao manda nada: tratar como zero zeraria todos os anuncios
  if (e2 || !ps) throw new Error(`nao consegui ler o estoque: ${e2?.message ?? "sem resposta"}`);
  const saldo = new Map((ps as { id: string; qtd_atual: number | null }[]).filter((p) => p.qtd_atual != null).map((p) => [p.id, p.qtd_atual as number]));

  const enviar = vinculos
    .filter((v) => saldo.has(v.produto_id))
    .map((v) => ({ v, estoque: estoqueDoAnuncio(saldo.get(v.produto_id)!, v.conjuntos) }))
    .filter(({ v, estoque }) => (op.soBaixar ? v.estoque_enviado != null && estoque < v.estoque_enviado : true));
  if (!enviar.length) return [];

  const { resultados } = await chamarApi<{ resultados: ResultadoEstoque[] }>(plataforma, "estoque", {
    canalId,
    itens: enviar.map(({ v, estoque }) => ({ idAnuncio: v.id_anuncio, idVariacao: v.id_variacao, estoque })),
  });

  // guarda o que a plataforma aceitou, para o modo automatico comparar da proxima vez
  const agora = new Date().toISOString();
  for (const r of resultados.filter((x) => x.ok)) {
    const v = enviar.find((e) => e.v.id_anuncio === r.idAnuncio && e.v.id_variacao === r.idVariacao)?.v;
    if (v) await supabase.from("ibk_anuncio_vinculos").update({ estoque_enviado: r.estoque, enviado_em: agora }).eq("id", v.id);
  }
  return resultados;
}

/*
  Chamado pelo motor de estoque depois de qualquer saida (venda em qualquer
  canal, saida sem venda, ajuste para menos): baixa os anuncios vinculados em
  TODAS as lojas conectadas. Nao trava quem chamou: sem integracao, sem vinculo
  ou com a plataforma fora do ar, simplesmente nao faz nada.

  Uma fila so, um envio de cada vez: importar 20 pedidos dispara 20 saidas, e
  envios em paralelo podiam chegar fora de ordem (a plataforma ficar com o
  numero mais alto) e disputar o refresh token, que e de uso unico. Os produtos
  que chegam enquanto um envio roda vao juntos no proximo, que le o saldo novo.
*/
const pendentes = new Set<string>();
let fila: Promise<void> = Promise.resolve();

async function processarPendentes() {
  if (!pendentes.size || !supabase) return;
  const produtoIds = [...pendentes];
  pendentes.clear();
  const { data, error } = await supabase.from("ibk_integracoes").select("canal_id, plataforma").not("cofre", "is", null);
  if (error || !data) return;
  for (const c of data as { canal_id: string; plataforma: Plataforma }[]) {
    if (!PLATAFORMAS[c.plataforma]?.api) continue;
    await enviarEstoque(c.plataforma, { canalId: c.canal_id, produtoIds, soBaixar: true }).catch(() => undefined);
  }
}

export function aposSaidaDeEstoque(produtoIds: string[]) {
  if (!produtoIds.length || !supabase) return;
  for (const id of produtoIds) pendentes.add(id);
  fila = fila.then(processarPendentes).catch(() => undefined);
}
