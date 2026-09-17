/*
  Importacao da planilha de pedidos do marketplace (Seller Center da Shopee,
  Centro do Vendedor do TikTok). O arquivo tem uma linha por item; as colunas
  do pedido (numero, status, taxas, rastreio) repetem em cada linha.

  Nada aqui depende do nome exato da coluna: `detectarMapa` reconhece os
  nomes usuais e a tela deixa corrigir. O produto e encontrado pelo SKU do
  anuncio (ibk_produto_canais.sku_canal), depois pelo id da variacao, e por
  fim pelo nome do produto + nome da variacao.
*/

export type Campo =
  | "pedido"
  | "status"
  | "data"
  | "rastreio"
  | "comprador"
  | "sku"
  | "sku_pai"
  | "id_variacao"
  | "produto"
  | "variacao"
  | "qtd"
  | "preco"
  | "preco_original"
  | "frete_comprador"
  | "taxa_comissao"
  | "taxa_servico"
  | "taxa_transacao"
  | "taxa_item"
  | "nf";

export const CAMPOS: { campo: Campo; rotulo: string; obrigatorio?: boolean }[] = [
  { campo: "pedido", rotulo: "Nº do pedido", obrigatorio: true },
  { campo: "status", rotulo: "Status do pedido" },
  { campo: "data", rotulo: "Data do pedido", obrigatorio: true },
  { campo: "produto", rotulo: "Nome do produto", obrigatorio: true },
  { campo: "variacao", rotulo: "Nome da variação" },
  { campo: "sku", rotulo: "SKU da variação" },
  { campo: "sku_pai", rotulo: "SKU principal" },
  { campo: "id_variacao", rotulo: "ID da variação" },
  { campo: "qtd", rotulo: "Quantidade", obrigatorio: true },
  { campo: "preco", rotulo: "Preço acordado (unit.)", obrigatorio: true },
  { campo: "preco_original", rotulo: "Preço original (unit.)" },
  { campo: "frete_comprador", rotulo: "Frete pago pelo comprador" },
  { campo: "taxa_comissao", rotulo: "Taxa de comissão" },
  { campo: "taxa_servico", rotulo: "Taxa de serviço" },
  { campo: "taxa_transacao", rotulo: "Taxa de transação" },
  { campo: "taxa_item", rotulo: "Taxa por item" },
  { campo: "rastreio", rotulo: "Nº de rastreamento" },
  { campo: "comprador", rotulo: "Comprador" },
  { campo: "nf", rotulo: "Nota fiscal" },
];

// nomes que cada campo costuma ter nas planilhas (minusculo, sem acento)
const SINONIMOS: Record<Campo, string[]> = {
  pedido: ["id do pedido", "numero do pedido", "n do pedido", "order id", "order sn", "pedido"],
  status: ["status do pedido", "order status", "status"],
  data: ["data de criacao do pedido", "data do pedido", "order creation date", "created time", "hora do pedido", "data"],
  rastreio: ["n de rastreamento", "numero de rastreamento", "codigo de rastreio", "tracking number", "tracking id", "rastreio"],
  comprador: ["nome de usuario (comprador)", "nome do destinatario", "comprador", "buyer username", "recipient", "username"],
  sku: ["n de referencia do sku", "numero de referencia do sku", "sku reference no", "seller sku", "sku"],
  sku_pai: ["n de referencia do sku principal", "sku principal", "parent sku reference no", "parent sku"],
  id_variacao: ["id da variacao", "variation id", "model id", "sku id"],
  produto: ["nome do produto", "product name", "produto"],
  variacao: ["nome da variacao", "variation name", "variacao", "variation"],
  qtd: ["quantidade", "quantity", "qtd", "qty"],
  preco: ["preco acordado", "deal price", "preco de venda", "preco unitario", "unit price", "preco"],
  preco_original: ["preco original", "original price"],
  frete_comprador: ["taxa de envio pagas pelo comprador", "taxa de envio paga pelo comprador", "shipping fee paid by buyer", "frete pago pelo comprador"],
  taxa_comissao: ["taxa de comissao", "commission fee", "comissao"],
  taxa_servico: ["taxa de servico", "service fee"],
  taxa_transacao: ["taxa de transacao", "transaction fee"],
  taxa_item: ["taxa por item vendido", "taxa por item", "per item fee"],
  nf: ["nota fiscal", "numero da nota", "nf", "invoice"],
};

export const normalizar = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/[^a-z0-9()]+/g, " ")
    .trim();

/* acha a coluna de cada campo pelo nome; exato primeiro, depois "comeca com" */
export function detectarMapa(cabecalhos: string[]): Partial<Record<Campo, string>> {
  const norm = cabecalhos.map((c) => ({ original: c, n: normalizar(c) }));
  const mapa: Partial<Record<Campo, string>> = {};
  const usados = new Set<string>();
  for (const campo of Object.keys(SINONIMOS) as Campo[]) {
    let achou: string | undefined;
    for (const sin of SINONIMOS[campo]) {
      const exato = norm.find((c) => c.n === sin && !usados.has(c.original));
      if (exato) { achou = exato.original; break; }
    }
    if (!achou) {
      for (const sin of SINONIMOS[campo]) {
        if (sin.length < 6) continue; // sinonimo curto so vale exato
        const parcial = norm.find((c) => c.n.startsWith(sin) && !usados.has(c.original));
        if (parcial) { achou = parcial.original; break; }
      }
    }
    if (achou) { mapa[campo] = achou; usados.add(achou); }
  }
  return mapa;
}

/* le xlsx/xls/csv no navegador e devolve cabecalhos + linhas como objetos */
export async function lerArquivo(file: File): Promise<{ cabecalhos: string[]; linhas: Record<string, unknown>[] }> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  // raw: sem isso o leitor entende "49,90" como 4990 (virgula de milhar)
  const wb = XLSX.read(buf, { type: "array", raw: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  const cabecalhos = linhas.length ? Object.keys(linhas[0]) : [];
  return { cabecalhos, linhas };
}

export const numero = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  // "1.234,56" -> 1234.56 ; "1234.56" fica ; "49,90" -> 49.90
  const semMilhar = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return parseFloat(semMilhar) || 0;
};

export const dataIso = (v: unknown): string => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // serial do Excel (dias desde 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
};

export type StatusImportado = "aguardando" | "enviado" | "entregue" | "cancelado" | "devolvido" | "ignorar";

/* status da plataforma -> status daqui. "ignorar" e pedido nao pago, que ainda nao e venda */
export function mapearStatus(v: unknown): StatusImportado {
  const s = normalizar(v);
  if (!s) return "aguardando";
  if (/cancel/.test(s)) return "cancelado";
  if (/devol|reembols|return|refund/.test(s)) return "devolvido";
  if (/conclu|complet|entreg|deliver|finaliz/.test(s)) return "entregue";
  if (/enviad|shipped|a caminho|em transito|in transit|transporte/.test(s)) return "enviado";
  if (/nao pag|unpaid|aguardando pagamento|pending payment/.test(s)) return "ignorar";
  return "aguardando"; // "a enviar", "to ship", "processando"
}

export type ItemImportado = {
  produtoNome: string;
  variacaoNome: string;
  sku: string;
  skuPai: string;
  idVariacao: string;
  qtd: number;
  preco: number;
  precoOriginal: number;
  produtoId: string | null; // resolvido
  como: "sku" | "id" | "nome" | null;
};

export type PedidoImportado = {
  pedido: string;
  status: StatusImportado;
  data: string;
  rastreio: string;
  comprador: string;
  nf: string;
  freteComprador: number;
  taxas: number; // soma das colunas de taxa presentes (por pedido)
  temTaxas: boolean;
  itens: ItemImportado[];
};

export function agruparPedidos(linhas: Record<string, unknown>[], mapa: Partial<Record<Campo, string>>): PedidoImportado[] {
  const g = (l: Record<string, unknown>, c: Campo) => (mapa[c] ? l[mapa[c] as string] : "");
  const por = new Map<string, PedidoImportado>();
  for (const l of linhas) {
    const pedido = String(g(l, "pedido") ?? "").trim();
    if (!pedido) continue;
    let p = por.get(pedido);
    if (!p) {
      const colunasTaxa: Campo[] = ["taxa_comissao", "taxa_servico", "taxa_transacao", "taxa_item"];
      const presentes = colunasTaxa.filter((c) => mapa[c]);
      p = {
        pedido,
        status: mapearStatus(g(l, "status")),
        data: dataIso(g(l, "data")),
        rastreio: String(g(l, "rastreio") ?? "").trim(),
        comprador: String(g(l, "comprador") ?? "").trim(),
        nf: String(g(l, "nf") ?? "").trim(),
        freteComprador: numero(g(l, "frete_comprador")),
        taxas: Math.abs(presentes.reduce((s, c) => s + numero(g(l, c)), 0)),
        temTaxas: presentes.length > 0,
        itens: [],
      };
      por.set(pedido, p);
    }
    p.itens.push({
      produtoNome: String(g(l, "produto") ?? "").trim(),
      variacaoNome: String(g(l, "variacao") ?? "").trim(),
      sku: String(g(l, "sku") ?? "").trim(),
      skuPai: String(g(l, "sku_pai") ?? "").trim(),
      idVariacao: String(g(l, "id_variacao") ?? "").trim(),
      qtd: Math.max(1, Math.round(numero(g(l, "qtd")) || 1)),
      preco: numero(g(l, "preco")),
      precoOriginal: numero(g(l, "preco_original")) || numero(g(l, "preco")),
      produtoId: null,
      como: null,
    });
  }
  return [...por.values()];
}

export type CodigoCanal = { produto_id: string; id_anuncio: string | null; id_variacao: string | null; sku_canal: string | null };
export type ProdutoRef = { id: string; nome: string | null; tamanho: string | null; cor: string | null; produto_pai_id: string | null; tem_variacoes: boolean };

const GENERO: Record<string, string> = { menina: "feminino", feminina: "feminino", menino: "masculino", masculina: "masculino" };
const VAZIAS = new Set(["de", "do", "da", "e", "com", "para", "kit", "conjunto", "infantil", "pecas", "peca"]);

// palavras que identificam um produto, sem as que aparecem em todo anuncio
const palavras = (s: unknown) =>
  normalizar(s)
    .split(" ")
    .map((w) => GENERO[w] ?? w)
    .filter((w) => w && !VAZIAS.has(w) && !/^\d+$/.test(w));

/*
  Acha o produto de cada item. Ordem: SKU do anuncio (cadastrado na ficha),
  id da variacao, e por fim nome do produto + nome da variacao (tamanho/cor
  contidos no texto da variacao). Produto pai com variacoes nunca e escolhido
  por nome, porque o estoque esta nas variacoes.
*/
export function resolverItens(pedidos: PedidoImportado[], codigos: CodigoCanal[], produtos: ProdutoRef[]) {
  const porSku = new Map(codigos.filter((c) => c.sku_canal).map((c) => [normalizar(c.sku_canal), c.produto_id]));
  const porIdVar = new Map(codigos.filter((c) => c.id_variacao).map((c) => [String(c.id_variacao), c.produto_id]));

  for (const p of pedidos) {
    for (const it of p.itens) {
      it.produtoId = null;
      it.como = null;
      if (it.sku && porSku.has(normalizar(it.sku))) {
        it.produtoId = porSku.get(normalizar(it.sku))!;
        it.como = "sku";
        continue;
      }
      if (it.idVariacao && porIdVar.has(it.idVariacao)) {
        it.produtoId = porIdVar.get(it.idVariacao)!;
        it.como = "id";
        continue;
      }
      // por nome: todas as palavras do nome do produto aparecem no nome do anuncio
      // (menina = feminino, menino = masculino); depois tamanho e cor pela variacao
      const palavrasAnuncio = new Set(palavras(it.produtoNome));
      const variacao = normalizar(it.variacaoNome);
      const candidatos = produtos.filter((pr) => {
        if (pr.tem_variacoes) return false;
        const ps = palavras(pr.nome);
        return ps.length > 0 && ps.every((w) => palavrasAnuncio.has(w));
      });
      const bateTam = (pr: ProdutoRef) => {
        const tam = normalizar(pr.tamanho);
        if (!tam) return true;
        const toks = variacao.split(" ");
        return toks.includes(tam) || toks.includes(`t${tam}`) || variacao.includes(`tam ${tam}`) || variacao.includes(`tamanho ${tam}`);
      };
      const bateCor = (pr: ProdutoRef) => {
        const cor = normalizar(pr.cor);
        return !cor || variacao.includes(cor);
      };
      let lista = candidatos.filter(bateTam);
      if (lista.length > 1) lista = lista.filter(bateCor);
      if (lista.length === 1) {
        it.produtoId = lista[0].id;
        it.como = "nome";
      }
    }
  }
  return pedidos;
}
