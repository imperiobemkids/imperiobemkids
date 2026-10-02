"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured, buscarTodos } from "@/lib/supabase";
import { SetupCard } from "./SetupCard";
import { GRUPOS } from "./AdminNav";
import { SkeletonCards, Sparkline } from "./ui";
import { BarrasLista, GraficoColunas, type Linha, type Ponto } from "./graficos";
import { ArrowDownRight, ArrowUpRight, Check, Truck } from "@phosphor-icons/react";
import { situacaoDespacho, situacaoPagamento, valorAReceber, estornada, lucroDaVenda, STATUS, FIADO, type StatusPedido } from "@/lib/pedidos";
import { calcularReposicao, calcularParados } from "@/lib/reposicao";
import { brl, pct, num, txt } from "@/lib/formato";
import { grupoDoProduto, MOTIVOS_SAIDA } from "@/lib/estoque";

type Produto = {
  id: string;
  nome: string | null;
  linha: string | null;
  categoria: string | null;
  genero: string | null;
  tamanho: string | null;
  cor: string | null;
  custo_unit: number;
  qtd_atual: number;
  qtd_inicial: number;
  tem_variacoes: boolean | null;
  estoque_minimo: number | null;
  produto_pai_id: string | null;
  fornecedor_id: string | null;
  created_at: string | null;
};
type Mov = { tipo: "entrada" | "saida"; categoria: string; valor: number; data: string; pago: boolean };
type Item = {
  qtd: number;
  preco_unit: number | null;
  produto_id: string | null;
  produto: { custo_unit: number; nome: string | null; produto_pai_id: string | null } | null;
};
type Venda = {
  id: string;
  data: string;
  canal: string | null;
  canal_id: string | null;
  preco_venda: number;
  taxa_pct: number;
  taxa_fixa: number;
  insumo_custo: number;
  frete: number;
  devolvida: boolean;
  custo_devolucao: number;
  recebido: number | null;
  forma_pagamento: string | null;
  status: StatusPedido;
  pedido_externo: string | null;
  ibk_venda_itens: Item[];
};
// peca que saiu sem venda (presente, conteudo, perda): custo sai do lucro
type SaidaSemVenda = { data: string; origem: string; qtd: number; custo_unit: number };
type Canal = { id: string; nome: string };
type Rotina = { id: string; area: string; titulo: string; dias: number[] };

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

// datas sempre ao meio-dia local: new Date("2026-09-01") e UTC e cai no dia anterior no Brasil
const somaDias = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
const diasEntre = (de: string, ate: string) =>
  Math.round((new Date(ate + "T12:00:00").getTime() - new Date(de + "T12:00:00").getTime()) / 86400000);

/*
  Periodo: um filtro so, acima dos resultados, e tudo embaixo dele usa o
  mesmo recorte. A comparacao e com o periodo de mesmo tamanho logo antes.
*/
type Periodo = "7" | "30" | "90" | "mes" | "tudo";
const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "7", rotulo: "7 dias" },
  { id: "30", rotulo: "30 dias" },
  { id: "90", rotulo: "90 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "tudo", rotulo: "Tudo" },
];

function intervalo(p: Periodo, hoje: string, primeira: string | null) {
  if (p === "mes") {
    const de = hoje.slice(0, 8) + "01";
    const fimAnt = somaDias(de, -1);
    const iniAnt = fimAnt.slice(0, 8) + "01";
    // mesmo numero de dias do mes passado (ou o mes inteiro, se ele for mais curto)
    const ateAnt = Number(fimAnt.slice(8)) < Number(hoje.slice(8)) ? fimAnt : iniAnt.slice(0, 8) + hoje.slice(8);
    return { de, ate: hoje, anterior: { de: iniAnt, ate: ateAnt }, comparacao: "mesmo período do mês passado" };
  }
  if (p === "tudo") return { de: primeira && primeira < hoje ? primeira : hoje, ate: hoje, anterior: null, comparacao: "" };
  const n = Number(p);
  const de = somaDias(hoje, -(n - 1));
  return { de, ate: hoje, anterior: { de: somaDias(de, -n), ate: somaDias(de, -1) }, comparacao: `${n} dias anteriores` };
}

/* grao do grafico: dia ate um mes, semana ate seis meses, mes dai pra frente */
type Grao = "dia" | "semana" | "mes";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const segunda = (iso: string) => somaDias(iso, -((new Date(iso + "T12:00:00").getDay() + 6) % 7));
const chaveDe = (iso: string, g: Grao) => (g === "dia" ? iso : g === "semana" ? segunda(iso) : iso.slice(0, 7));
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function baldes(de: string, ate: string, g: Grao) {
  const out: { chave: string; curto: string; longo: string }[] = [];
  const vistos = new Set<string>();
  for (let d = de; d <= ate; d = somaDias(d, 1)) {
    const k = chaveDe(d, g);
    if (vistos.has(k)) continue;
    vistos.add(k);
    if (g === "dia") {
      const dia = new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      out.push({ chave: k, curto: ddmm(d), longo: `${dia}, ${ddmm(d)}` });
    } else if (g === "semana") {
      out.push({ chave: k, curto: ddmm(d), longo: `semana de ${ddmm(k)}` });
    } else {
      const m = Number(k.slice(5, 7)) - 1;
      out.push({ chave: k, curto: `${MESES[m]}/${k.slice(2, 4)}`, longo: `${MESES[m]} de ${k.slice(0, 4)}` });
    }
  }
  return out;
}

const custoDa = (v: Venda) => v.ibk_venda_itens.reduce((s, it) => s + (it.produto?.custo_unit ?? 0) * it.qtd, 0);
const taxaDa = (v: Venda) => v.preco_venda * v.taxa_pct + (v.taxa_fixa ?? 0);
const devolvida = (v: Venda) => v.devolvida || v.status === "devolvido";

/*
  Resumo do periodo. A conta fecha: faturamento menos custo, taxas,
  embalagem, frete e devolucoes da exatamente o lucro (a mesma regra de
  lucroDaVenda). Cancelada nao entra; devolvida entra so com o custo.
*/
function resumir(vendas: Venda[], movs: Mov[], semVenda: SaidaSemVenda[], de: string, ate: string) {
  const r = { faturamento: 0, pedidos: 0, pecas: 0, custo: 0, taxas: 0, embalagem: 0, frete: 0, devolucoes: 0, lucro: 0, ads: 0, semVenda: 0 };
  for (const v of vendas) {
    const d = v.data.slice(0, 10);
    if (d < de || d > ate || v.status === "cancelado") continue;
    r.lucro += lucroDaVenda(v);
    if (devolvida(v)) {
      r.devolucoes += v.custo_devolucao ?? 0;
      continue;
    }
    r.faturamento += v.preco_venda;
    r.pedidos += 1;
    r.pecas += v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0);
    r.custo += custoDa(v);
    r.taxas += taxaDa(v);
    r.embalagem += v.insumo_custo;
    r.frete += v.frete;
  }
  r.ads = movs
    .filter((m) => m.tipo === "saida" && m.categoria === "ads" && m.data >= de && m.data <= ate)
    .reduce((s, m) => s + m.valor, 0);
  r.semVenda = semVenda.filter((k) => k.data >= de && k.data <= ate).reduce((s, k) => s + Math.abs(k.qtd) * k.custo_unit, 0);
  return r;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PainelClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [semVenda, setSemVenda] = useState<SaidaSemVenda[]>([]);
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("30");
  // meta do mes (tabela ibk_metas, migration 0032); null = ainda nao definida
  const [meta, setMeta] = useState<{ faturamento: number; lucro: number } | null>(null);
  const [metaSemTabela, setMetaSemTabela] = useState(false);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaFat, setMetaFat] = useState("");
  const [metaLucro, setMetaLucro] = useState("");
  const [erroMeta, setErroMeta] = useState("");
  const [verTabela, setVerTabela] = useState(false);
  const hoje = isoLocal(new Date());
  const diaSemana = ((new Date().getDay() + 6) % 7) + 1; // 1 = segunda

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: p }, { data: m }, { data: v }, { data: cn }, { data: k }, { data: r }, { data: c }, mt] = await Promise.all([
        supabase!.from("ibk_produtos").select("*").eq("ativo", true),
        buscarTodos<Mov>((de, ate) => supabase!.from("ibk_movimentos").select("tipo, categoria, valor, data, pago").order("id").range(de, ate)),
        buscarTodos<Venda>((de, ate) =>
          supabase!
            .from("ibk_vendas")
            .select("*, ibk_venda_itens(qtd, preco_unit, produto_id, produto:ibk_produtos(custo_unit, nome, produto_pai_id))")
            .order("id")
            .range(de, ate),
        ),
        supabase!.from("ibk_canais").select("id, nome"),
        supabase!.from("ibk_estoque_mov").select("data, origem, qtd, custo_unit").in("origem", Object.keys(MOTIVOS_SAIDA)),
        // rotinas de hoje: se a migration 0019 ainda nao rodou, vem erro e o bloco some
        supabase!.from("ibk_rotinas").select("id, area, titulo, dias").eq("ativo", true).contains("dias", [diaSemana]).order("area").order("ordem"),
        supabase!.from("ibk_rotina_checks").select("rotina_id").eq("data", hoje),
        supabase!.from("ibk_metas").select("faturamento, lucro").eq("mes", hoje.slice(0, 7)).maybeSingle(),
      ]);
      // sem a migration 0032 a tabela nao existe: o card explica em vez de quebrar
      if (mt.error) setMetaSemTabela(true);
      else if (mt.data) setMeta({ faturamento: Number(mt.data.faturamento), lucro: Number(mt.data.lucro) });
      setProdutos((p as Produto[]) ?? []);
      setMovs(m);
      setVendas(v);
      setCanais((cn as Canal[]) ?? []);
      setSemVenda((k as SaidaSemVenda[]) ?? []);
      setRotinas((r as Rotina[]) ?? []);
      setFeitas(new Set(((c as { rotina_id: string }[]) ?? []).map((x) => x.rotina_id)));
      setLoading(false);
    })();
  }, []);

  if (!supabaseConfigured) return <SetupCard />;

  const salvarMeta = async () => {
    if (!supabase) return;
    const f = num(metaFat), l = num(metaLucro);
    if (f <= 0) return setErroMeta("informe a meta de faturamento");
    setErroMeta("");
    const { error } = await supabase
      .from("ibk_metas")
      .upsert({ mes: hoje.slice(0, 7), faturamento: f, lucro: l, updated_at: new Date().toISOString() }, { onConflict: "mes" });
    if (error) return setErroMeta(/ibk_metas/.test(error.message) ? "rode a migration 0032 no SQL Editor antes" : error.message);
    setMeta({ faturamento: f, lucro: l });
    setEditandoMeta(false);
  };

  const alternarRotina = async (r: Rotina) => {
    if (!supabase) return;
    const feito = feitas.has(r.id);
    setFeitas((f) => {
      const n = new Set(f);
      if (feito) n.delete(r.id);
      else n.add(r.id);
      return n;
    });
    const { error } = feito
      ? await supabase.from("ibk_rotina_checks").delete().eq("rotina_id", r.id).eq("data", hoje)
      : await supabase.from("ibk_rotina_checks").insert({ rotina_id: r.id, data: hoje });
    if (error)
      setFeitas((f) => {
        const n = new Set(f);
        if (feito) n.add(r.id);
        else n.delete(r.id);
        return n;
      });
  };

  /* ---------- agora: caixa, estoque e investimento (nao dependem do periodo) ---------- */

  const fisicos = produtos.filter((p) => !p.tem_variacoes);
  const unidades = fisicos.reduce((s, p) => s + p.qtd_atual, 0);
  const valorEstoque = fisicos.reduce((s, p) => s + p.qtd_atual * p.custo_unit, 0);
  // reposicao: a mesma regra da tela de Estoque (minimo rateado entre variacoes + giro de 30 dias)
  const vendidos30 = new Map<string, number>();
  const desde30 = somaDias(hoje, -30);
  for (const v of vendas) {
    if (estornada(v.status) || v.data < desde30) continue;
    for (const it of v.ibk_venda_itens) if (it.produto_id) vendidos30.set(it.produto_id, (vendidos30.get(it.produto_id) ?? 0) + it.qtd);
  }
  const baixos = calcularReposicao(produtos, vendidos30);

  // saldo real: so o que entrou e saiu de fato (fiado e conta a pagar ficam de fora)
  const entradas = movs.filter((m) => m.tipo === "entrada" && m.pago).reduce((s, m) => s + m.valor, 0);
  const saidas = movs.filter((m) => m.tipo === "saida" && m.pago).reduce((s, m) => s + m.valor, 0);
  const caixa = entradas - saidas;
  const aPagar = movs.filter((m) => m.tipo === "saida" && !m.pago).reduce((s, m) => s + m.valor, 0);
  const investido = movs
    .filter((m) => m.tipo === "saida" && ["mercadoria", "insumo", "capex"].includes(m.categoria))
    .reduce((s, m) => s + m.valor, 0);
  const lucroTotal = vendas.reduce((s, v) => s + lucroDaVenda(v), 0);
  const paybackPct = investido > 0 ? Math.max(0, Math.min(100, Math.round((lucroTotal / investido) * 100))) : 0;
  // dinheiro ja vendido que ainda nao entrou: repasse de plataforma e fiado
  // a mesma regra da coluna Pagamento em Vendas (lib/pedidos)
  const pendentes = vendas.filter((v) => ["a_receber", "repasse"].includes(situacaoPagamento(v)));
  const aReceber = pendentes.reduce((s, v) => s + valorAReceber(v), 0);
  const fiados = pendentes.filter((v) => v.forma_pagamento === FIADO).length;
  const repasses = pendentes.length - fiados;

  // expedicao: o que ainda nao foi postado, e o que ja estourou o prazo
  const aguardando = vendas.filter((v) => v.status === "aguardando");
  const atrasados = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "atrasado");
  const vencendo = aguardando.filter((v) => situacaoDespacho(v.data, v.status)?.nivel === "vence");

  const estoquePorGrupo = new Map<string, { valor: number; un: number; itens: number }>();
  for (const p of fisicos) {
    if (p.qtd_atual <= 0) continue;
    const g = grupoDoProduto(p);
    const a = estoquePorGrupo.get(g) ?? { valor: 0, un: 0, itens: 0 };
    estoquePorGrupo.set(g, { valor: a.valor + p.qtd_atual * p.custo_unit, un: a.un + p.qtd_atual, itens: a.itens + 1 });
  }
  // estoque parado: produto com peca e sem venda ha 30 dias ou mais (variacoes somadas no pai)
  const ultimaVenda = new Map<string, string>();
  for (const v of vendas) {
    if (estornada(v.status)) continue;
    for (const it of v.ibk_venda_itens) {
      const chave = it.produto?.produto_pai_id ?? it.produto_id;
      if (chave && (ultimaVenda.get(chave) ?? "") < v.data.slice(0, 10)) ultimaVenda.set(chave, v.data.slice(0, 10));
    }
  }
  const parados = calcularParados(produtos, ultimaVenda, hoje).filter((x) => x.dias >= 30);
  const valorParado = parados.reduce((s, x) => s + x.valor, 0);
  const linhasParado: Linha[] = [...parados]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6)
    .map((x) => ({
      chave: x.id,
      rotulo: x.nome,
      valor: x.valor,
      texto: brl(x.valor),
      sub: `${x.qtd} un · ${x.ultimaVenda ? `sem venda há ${x.dias} dias` : `nunca vendeu, entrou há ${x.dias} dias`}`,
      tom: x.dias >= 90 ? ("forte" as const) : ("serie" as const),
    }));

  const linhasEstoque: Linha[] = [...estoquePorGrupo.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([g, a]) => ({
      chave: g,
      rotulo: g,
      valor: a.valor,
      texto: brl(a.valor),
      sub: `${a.un} ${a.un === 1 ? "unidade" : "unidades"} · ${valorEstoque > 0 ? pct(a.valor / valorEstoque) : "0%"} do estoque`,
    }));

  /*
    Meta do mes: o que ja foi feito no mes corrente (nao segue o filtro de
    periodo), quanto falta por dia contando hoje e a projecao. O ritmo e a
    media diaria dos ultimos 30 dias: no comeco do mes, dois dias de venda
    projetados para o mes inteiro davam numeros sem sentido.
  */
  const inicioMes = hoje.slice(0, 8) + "01";
  const doMes = resumir(vendas, movs, semVenda, inicioMes, hoje);
  const diasNoMes = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0).getDate();
  const diaHoje = Number(hoje.slice(8, 10));
  const diasRestantes = diasNoMes - diaHoje + 1;
  const ult30 = resumir(vendas, movs, semVenda, somaDias(hoje, -29), hoje);
  const projecao = (feito: number, em30: number) => feito + (em30 / 30) * (diasNoMes - diaHoje);
  const nomeMes = new Date(hoje + "T12:00:00").toLocaleDateString("pt-BR", { month: "long" });

  /* ---------- resultados do periodo ---------- */

  const primeira = vendas.reduce<string | null>((m, v) => (m === null || v.data < m ? v.data.slice(0, 10) : m), null);
  const iv = intervalo(periodo, hoje, primeira);
  const atual = resumir(vendas, movs, semVenda, iv.de, iv.ate);
  const anterior = iv.anterior ? resumir(vendas, movs, semVenda, iv.anterior.de, iv.anterior.ate) : null;
  const margem = atual.faturamento > 0 ? atual.lucro / atual.faturamento : 0;
  const ticket = atual.pedidos > 0 ? atual.faturamento / atual.pedidos : 0;
  const roas = atual.ads > 0 ? atual.faturamento / atual.ads : null;

  const noPeriodo = vendas.filter((v) => v.data.slice(0, 10) >= iv.de && v.data.slice(0, 10) <= iv.ate);
  const validas = noPeriodo.filter((v) => !estornada(v.status) && !devolvida(v));

  // serie do grafico
  const dias = diasEntre(iv.de, iv.ate) + 1;
  const grao: Grao = dias <= 31 ? "dia" : dias <= 186 ? "semana" : "mes";
  const porBalde = new Map<string, { fat: number; pedidos: number; lucro: number }>();
  for (const v of validas) {
    const k = chaveDe(v.data.slice(0, 10), grao);
    const a = porBalde.get(k) ?? { fat: 0, pedidos: 0, lucro: 0 };
    porBalde.set(k, { fat: a.fat + v.preco_venda, pedidos: a.pedidos + 1, lucro: a.lucro + lucroDaVenda(v) });
  }
  const pontos: Ponto[] = baldes(iv.de, iv.ate, grao).map((b) => {
    const a = porBalde.get(b.chave) ?? { fat: 0, pedidos: 0, lucro: 0 };
    return {
      ...b,
      valor: a.fat,
      detalhes: [
        { rotulo: "Pedidos", valor: String(a.pedidos) },
        { rotulo: "Lucro", valor: brl(a.lucro) },
      ],
    };
  });
  const tituloGrafico = grao === "dia" ? "Faturamento por dia" : grao === "semana" ? "Faturamento por semana" : "Faturamento por mês";

  // canais
  const nomeCanal = new Map(canais.map((c) => [c.id, c.nome]));
  const porCanal = new Map<string, { fat: number; pedidos: number; lucro: number }>();
  for (const v of validas) {
    const nome = (v.canal_id && nomeCanal.get(v.canal_id)) || capital(v.canal ?? "outro");
    const a = porCanal.get(nome) ?? { fat: 0, pedidos: 0, lucro: 0 };
    porCanal.set(nome, { fat: a.fat + v.preco_venda, pedidos: a.pedidos + 1, lucro: a.lucro + lucroDaVenda(v) });
  }
  const linhasCanal: Linha[] = [...porCanal.entries()]
    .sort((a, b) => b[1].fat - a[1].fat)
    .map(([nome, a]) => ({
      chave: nome,
      rotulo: nome,
      valor: a.fat,
      texto: brl(a.fat),
      sub: `${a.pedidos} ${a.pedidos === 1 ? "pedido" : "pedidos"} · lucro ${brl(a.lucro)} · margem ${a.fat > 0 ? pct(a.lucro / a.fat) : "0%"}`,
    }));

  // para onde foi o dinheiro: cada linha em proporcao ao faturamento
  const partes = (v: number) => (atual.faturamento > 0 ? `${pct(v / atual.faturamento)} do faturamento` : undefined);
  const linhasDinheiro: Linha[] = [
    { chave: "fat", rotulo: "Faturamento", valor: atual.faturamento, texto: brl(atual.faturamento), tom: "serie" },
    { chave: "custo", rotulo: "Custo das peças", valor: atual.custo, texto: `− ${brl(atual.custo)}`, sub: partes(atual.custo), tom: "contexto" },
    { chave: "taxas", rotulo: "Taxas das plataformas", valor: atual.taxas, texto: `− ${brl(atual.taxas)}`, sub: partes(atual.taxas), tom: "contexto" },
    ...(atual.embalagem > 0 ? [{ chave: "emb", rotulo: "Embalagem", valor: atual.embalagem, texto: `− ${brl(atual.embalagem)}`, sub: partes(atual.embalagem), tom: "contexto" as const }] : []),
    ...(atual.frete > 0 ? [{ chave: "frete", rotulo: "Frete pago pela loja", valor: atual.frete, texto: `− ${brl(atual.frete)}`, sub: partes(atual.frete), tom: "contexto" as const }] : []),
    ...(atual.devolucoes > 0 ? [{ chave: "dev", rotulo: "Devoluções", valor: atual.devolucoes, texto: `− ${brl(atual.devolucoes)}`, sub: partes(atual.devolucoes), tom: "contexto" as const }] : []),
    {
      chave: "lucro",
      rotulo: "Lucro das vendas",
      valor: atual.lucro,
      texto: brl(atual.lucro),
      sub: atual.lucro < 0 ? "prejuízo no período" : `margem de ${pct(margem)}`,
      tom: atual.lucro < 0 ? "negativo" : "forte",
    },
    ...(atual.ads > 0 ? [{ chave: "ads", rotulo: "Anúncios (ads)", valor: atual.ads, texto: `− ${brl(atual.ads)}`, sub: partes(atual.ads), tom: "contexto" as const }] : []),
    ...(atual.semVenda > 0
      ? [{ chave: "semvenda", rotulo: "Presentes, conteúdo e perdas", valor: atual.semVenda, texto: `− ${brl(atual.semVenda)}`, sub: "custo das peças que saíram sem venda", tom: "contexto" as const }]
      : []),
    ...(atual.ads > 0 || atual.semVenda > 0
      ? [
          {
            chave: "liq",
            rotulo: "Resultado do período",
            valor: atual.lucro - atual.ads - atual.semVenda,
            texto: brl(atual.lucro - atual.ads - atual.semVenda),
            tom: atual.lucro - atual.ads - atual.semVenda < 0 ? ("negativo" as const) : ("forte" as const),
          },
        ]
      : []),
  ];
  const maxDinheiro = Math.max(atual.faturamento, ...linhasDinheiro.map((l) => Math.abs(l.valor)));

  // mais vendidos: variacao conta no produto pai (o "Conjunto Verao", nao o "tam 4")
  const nomeProduto = new Map(produtos.map((p) => [p.id, p.nome]));
  const porProduto = new Map<string, { nome: string; pecas: number; fat: number }>();
  for (const v of validas) {
    const totalQtd = v.ibk_venda_itens.reduce((s, it) => s + it.qtd, 0) || 1;
    for (const it of v.ibk_venda_itens) {
      const pai = it.produto?.produto_pai_id ?? null;
      const chave = pai ?? it.produto_id ?? "sem-produto";
      const nome = (pai && nomeProduto.get(pai)) || it.produto?.nome || "Produto sem cadastro";
      // item antigo sem preco proprio: rateia o total da venda pela quantidade
      const fat = it.preco_unit != null ? it.preco_unit * it.qtd : (v.preco_venda * it.qtd) / totalQtd;
      const a = porProduto.get(chave) ?? { nome, pecas: 0, fat: 0 };
      porProduto.set(chave, { nome, pecas: a.pecas + it.qtd, fat: a.fat + fat });
    }
  }
  const linhasProduto: Linha[] = [...porProduto.entries()]
    .sort((a, b) => b[1].pecas - a[1].pecas || b[1].fat - a[1].fat)
    .slice(0, 6)
    .map(([k, a]) => ({
      chave: k,
      rotulo: a.nome,
      valor: a.pecas,
      texto: `${a.pecas} ${a.pecas === 1 ? "unidade" : "unidades"}`,
      sub: brl(a.fat),
    }));

  const porStatus = (Object.keys(STATUS) as StatusPedido[])
    .map((s) => ({ s, n: noPeriodo.filter((v) => v.status === s).length }))
    .filter((x) => x.n > 0);
  const ultimas = [...noPeriodo].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).slice(0, 6);

  if (loading)
    return (
      <div className="page-in">
        <div className="skel h-3 w-20" />
        <div className="skel mt-2 h-8 w-56" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SkeletonCards n={4} />
        </div>
        <div className="skel mt-8 h-9 w-80" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <SkeletonCards n={6} />
        </div>
        <div className="skel mt-4 h-64" />
      </div>
    );

  const dataLonga = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const rotinasFeitas = rotinas.filter((r) => feitas.has(r.id)).length;
  const frasePeriodo = periodo === "tudo" ? "em todo o histórico" : periodo === "mes" ? "neste mês" : `nos últimos ${periodo} dias`;

  return (
    <div className="page-in">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--ink)]/70">{dataLonga}</p>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
        {saudacao()}, Império 🧸
      </h1>

      {/* expedicao: a Shopee cobra postagem em 2 dias uteis; atrasado derruba a loja */}
      {aguardando.length > 0 && (
        <Link
          href="/admin/vendas"
          className={`card card-hover mt-4 flex items-center gap-3 p-4 ${atrasados.length > 0 ? "border-2 border-red-300" : vencendo.length > 0 ? "border-2 border-[var(--sun)]" : ""}`}
        >
          <Truck size={26} weight="duotone" className={atrasados.length > 0 ? "text-red-500" : "text-[var(--purple)]"} />
          <div className="flex-1">
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold leading-tight text-[var(--purple-dark)]">
              <span className="num">{aguardando.length}</span> {aguardando.length === 1 ? "pedido pra postar" : "pedidos pra postar"}
            </div>
            <div className="text-xs text-[var(--ink)]/75">
              {atrasados.length > 0
                ? `${atrasados.length} fora do prazo de 2 dias úteis`
                : vencendo.length > 0
                  ? `${vencendo.length} ${vencendo.length === 1 ? "vence" : "vencem"} hoje`
                  : "tudo dentro do prazo"}
            </div>
          </div>
          <span className="text-sm font-bold text-[var(--purple)]">ver vendas</span>
        </Link>
      )}

      {/* agora: fotografia do caixa e do estoque, independente do periodo */}
      <div className="cascata mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile rotulo="Saldo de caixa" valor={brl(caixa)} negativo={caixa < 0} sub={aPagar > 0 ? `${brl(aPagar)} a pagar` : "sem contas abertas"} />
        <Tile
          rotulo="A receber"
          valor={brl(aReceber)}
          sub={
            pendentes.length > 0
              ? [repasses > 0 && `${repasses} ${repasses === 1 ? "repasse" : "repasses"}`, fiados > 0 && `${fiados} ${fiados === 1 ? "fiado" : "fiados"}`].filter(Boolean).join(" · ")
              : "tudo recebido"
          }
        />
        <Tile rotulo="Valor em estoque" valor={brl(valorEstoque)} sub={`${unidades} unidades a preço de custo`} />
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]/70">Payback</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">{paybackPct}%</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--purple)]/10" role="meter" aria-valuenow={paybackPct} aria-valuemin={0} aria-valuemax={100} aria-label="Payback do investimento">
            <div className="h-full rounded-full bg-[var(--purple)]" style={{ width: `${paybackPct}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-[var(--ink)]/70">
            {investido > 0 && lucroTotal < investido ? `faltam ${brl(investido - lucroTotal)} de ${brl(investido)}` : `investido ${brl(investido)}`}
          </div>
        </div>
      </div>

      {/* meta do mes: progresso, quanto falta por dia e projecao */}
      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Meta de {nomeMes}</h2>
            <p className="text-xs text-[var(--ink)]/70">
              {meta ? `faltam ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}, contando hoje` : "defina quanto quer faturar e lucrar este mês"}
            </p>
          </div>
          {!metaSemTabela && !editandoMeta && (
            <button
              onClick={() => { setMetaFat(meta ? txt(meta.faturamento) : ""); setMetaLucro(meta ? txt(meta.lucro) : ""); setEditandoMeta(true); }}
              className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple-dark)] hover:bg-[var(--purple)]/15"
            >
              {meta ? "editar meta" : "definir meta"}
            </button>
          )}
        </div>
        {metaSemTabela ? (
          <p className="mt-2 text-sm text-[var(--ink)]/70">Para usar a meta, rode a migration 0032 no SQL Editor do Supabase.</p>
        ) : editandoMeta ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Faturamento</span>
              <input value={metaFat} onChange={(e) => setMetaFat(e.target.value)} inputMode="decimal" placeholder="1.500,00" className="w-32 rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]" autoFocus />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Lucro das vendas</span>
              <input value={metaLucro} onChange={(e) => setMetaLucro(e.target.value)} inputMode="decimal" placeholder="400,00" className="w-32 rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]" onKeyDown={(e) => e.key === "Enter" && salvarMeta()} />
            </label>
            <button onClick={salvarMeta} className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)]">salvar</button>
            <button onClick={() => { setEditandoMeta(false); setErroMeta(""); }} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2 text-sm font-bold text-[var(--purple)]">cancelar</button>
            {erroMeta && <p className="w-full text-sm font-semibold text-red-500">{erroMeta}</p>}
          </div>
        ) : meta ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <MetaLinha rotulo="Faturamento" feito={doMes.faturamento} alvo={meta.faturamento} dias={diasRestantes} projetado={projecao(doMes.faturamento, ult30.faturamento)} />
            {meta.lucro > 0 && <MetaLinha rotulo="Lucro das vendas" feito={doMes.lucro} alvo={meta.lucro} dias={diasRestantes} projetado={projecao(doMes.lucro, ult30.lucro)} />}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--ink)]/70">
            Neste mês: {brl(doMes.faturamento)} faturados e {brl(doMes.lucro)} de lucro das vendas.
          </p>
        )}
      </div>

      {/* hoje: as rotinas do dia, marcaveis daqui mesmo */}
      {rotinas.length > 0 && (
        <div className="mt-4 card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              Hoje
            </h2>
            <span
              className={`num rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                rotinasFeitas === rotinas.length ? "bg-emerald-100 text-emerald-700" : "bg-[var(--purple)]/8 text-[var(--purple)]"
              }`}
            >
              {rotinasFeitas}/{rotinas.length}
            </span>
          </div>
          <ul className="cascata mt-2 grid gap-1 sm:grid-cols-2">
            {rotinas.map((r) => {
              const feito = feitas.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => alternarRotina(r)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold ${
                      feito ? "bg-emerald-50 text-emerald-800" : "bg-[var(--purple)]/5 text-[var(--ink)] hover:bg-[var(--purple)]/10"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-extrabold ${
                        feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--purple)]/30"
                      }`}
                    >
                      {feito && <Check size={10} weight="bold" />}
                    </span>
                    <span className={`flex-1 ${feito ? "line-through opacity-70" : ""}`}>{r.titulo}</span>
                    <span className="text-[10px] font-bold uppercase text-[var(--ink)]/60">{r.area}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/tarefas" className="mt-3 inline-block text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">
            ver a semana
          </Link>
        </div>
      )}

      {/* estoque agora: onde o dinheiro esta parado e o que precisa voltar */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Bloco titulo="Estoque por linha" sub="valor a preço de custo" link={{ href: "/admin/estoque", rotulo: "ver estoque" }}>
          {linhasEstoque.length > 0 ? <BarrasLista linhas={linhasEstoque} /> : <Nada texto="nenhuma peça em estoque" />}
        </Bloco>
        <Bloco
          titulo="Estoque parado"
          sub={parados.length > 0 ? `sem venda há 30 dias ou mais · ${brl(valorParado)} parado` : "com peça e sem venda há 30 dias ou mais"}
          link={{ href: "/admin/estoque", rotulo: "ver no estoque" }}
        >
          {linhasParado.length > 0 ? <BarrasLista linhas={linhasParado} /> : <Nada texto="nada parado há mais de 30 dias" />}
        </Bloco>
        <Bloco
          titulo={baixos.length > 0 ? `Reposição (${baixos.length})` : "Reposição"}
          sub="abaixo do mínimo ou girando rápido"
          link={{ href: "/admin/estoque", rotulo: "ver o que comprar" }}
          destaque={baixos.length > 0}
        >
          {baixos.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {baixos.slice(0, 12).map((r) => (
                <span key={r.p.id} className={`rounded-full px-3 py-1 text-xs font-bold ${r.p.qtd_atual === 0 ? "bg-red-100 text-red-600" : "bg-[var(--sun)]/30 text-[var(--ink)]"}`}>
                  {r.nome}: {r.p.qtd_atual === 0 ? "esgotado" : `${r.p.qtd_atual} un`}
                </span>
              ))}
            </div>
          ) : (
            <Nada texto="nada abaixo do mínimo" />
          )}
        </Bloco>
      </div>

      {/* ---------- resultados: tudo daqui pra baixo segue o periodo ---------- */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">Resultados</h2>
          {iv.anterior && <span className="text-xs text-[var(--ink)]/70">comparado com {iv.comparacao}</span>}
        </div>
        <div role="radiogroup" aria-label="Período" className="mt-2 flex flex-wrap gap-1.5">
          {PERIODOS.map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={periodo === x.id}
              onClick={() => setPeriodo(x.id)}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-bold transition-colors ${
                periodo === x.id ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/80 shadow-[0_1px_0_rgba(109,40,184,0.12)] hover:bg-[var(--purple)]/8"
              }`}
            >
              {x.rotulo}
            </button>
          ))}
        </div>

        <div className="cascata mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile
            rotulo="Faturamento"
            valor={brl(atual.faturamento)}
            delta={variacao(atual.faturamento, anterior?.faturamento)}
            grafico={pontos.length > 1 && pontos.some((p) => p.valor > 0) ? <Sparkline valores={pontos.map((p) => p.valor)} /> : null}
          />
          <Tile
            rotulo="Lucro das vendas"
            valor={brl(atual.lucro)}
            negativo={atual.lucro < 0}
            sub={atual.faturamento > 0 ? `margem de ${pct(margem)}` : "sem vendas no período"}
            delta={variacao(atual.lucro, anterior?.lucro)}
          />
          <Tile
            rotulo="Pedidos"
            valor={String(atual.pedidos)}
            sub={atual.pedidos > 0 ? `ticket médio ${brl(ticket)}` : "nenhum pedido"}
            delta={variacao(atual.pedidos, anterior?.pedidos)}
          />
          <Tile
            rotulo="Itens vendidos"
            valor={String(atual.pecas)}
            sub={atual.pedidos > 0 ? `${(atual.pecas / atual.pedidos).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por pedido` : "nenhum item"}
          />
          <Tile
            rotulo="Taxas das plataformas"
            valor={brl(atual.taxas)}
            sub={atual.faturamento > 0 ? `${pct(atual.taxas / atual.faturamento)} do faturamento` : "sem vendas no período"}
          />
          <Tile
            rotulo="Anúncios (ads)"
            valor={brl(atual.ads)}
            sub={roas ? `ROAS ${roas.toFixed(1).replace(".", ",")}x` : "sem gasto no período"}
          />
        </div>

        {porStatus.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-[var(--ink)]/70">Pedidos no período:</span>
            {porStatus.map(({ s, n }) => (
              <span key={s} className={`rounded-full px-2.5 py-1 font-bold ${STATUS[s].cor}`}>
                <span className="num">{n}</span> {STATUS[s].rotulo}
              </span>
            ))}
          </div>
        )}

        {/* faturamento no tempo, com tabela como alternativa ao grafico */}
        <div className="card mt-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{tituloGrafico}</h3>
              <p className="text-xs text-[var(--ink)]/70">
                {brl(atual.faturamento)} {frasePeriodo}
              </p>
            </div>
            <button
              onClick={() => setVerTabela((t) => !t)}
              className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple-dark)] hover:bg-[var(--purple)]/15"
              aria-pressed={verTabela}
            >
              {verTabela ? "ver gráfico" : "ver tabela"}
            </button>
          </div>
          <div className="mt-3">
            {atual.faturamento <= 0 ? (
              <Nada texto={`nenhuma venda ${frasePeriodo}`} alto />
            ) : verTabela ? (
              <TabelaSerie pontos={pontos} grao={grao} />
            ) : (
              <GraficoColunas pontos={pontos} formatar={brl} rotuloAria={`${tituloGrafico} ${frasePeriodo}: total ${brl(atual.faturamento)}`} />
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Bloco titulo="Vendas por canal" sub="faturamento, pedidos e margem de cada canal">
            {linhasCanal.length > 0 ? <BarrasLista linhas={linhasCanal} /> : <Nada texto="nenhuma venda no período" />}
          </Bloco>
          <Bloco titulo="Para onde foi o dinheiro" sub="do faturamento até o lucro">
            {atual.faturamento > 0 || atual.devolucoes > 0 || atual.semVenda > 0 ? <BarrasLista linhas={linhasDinheiro} max={maxDinheiro} /> : <Nada texto="nenhuma venda no período" />}
          </Bloco>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Bloco titulo="Mais vendidos" sub="unidades vendidas e faturamento por produto">
            {linhasProduto.length > 0 ? <BarrasLista linhas={linhasProduto} /> : <Nada texto="nenhum produto vendido no período" />}
          </Bloco>
          <Bloco titulo="Últimas vendas" sub="as mais recentes do período" link={{ href: "/admin/vendas", rotulo: "ver todas" }}>
            {ultimas.length > 0 ? (
              <ul className="divide-y divide-[var(--purple)]/8">
                {ultimas.map((v) => {
                  const lucro = lucroDaVenda(v);
                  const canal = (v.canal_id && nomeCanal.get(v.canal_id)) || capital(v.canal ?? "outro");
                  return (
                    <li key={v.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="num w-11 shrink-0 text-xs font-bold text-[var(--ink)]/70">{ddmm(v.data.slice(0, 10))}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--ink)]">{canal}</div>
                        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[v.status]?.cor ?? ""}`}>
                          {STATUS[v.status]?.rotulo ?? v.status}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="num font-extrabold text-[var(--ink)]">{brl(v.preco_venda)}</div>
                        <div className={`num text-[11px] font-bold ${lucro < 0 ? "text-red-600" : "text-emerald-700"}`}>
                          {lucro < 0 ? "prejuízo " : "lucro "}
                          {brl(lucro)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Nada texto="nenhuma venda no período" />
            )}
          </Bloco>
        </div>
      </section>

      {/* atalhos so no celular: no desktop o menu lateral ja faz esse papel */}
      <div className="mt-8 flex flex-col gap-5 lg:hidden">
        {GRUPOS.map((g) => (
          <div key={g.nome}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--ink)]/65">
              {g.nome}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.itens.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="flex items-center gap-3 card card-hover p-3"
                >
                  <c.icone size={22} weight="duotone" className="text-[var(--purple)]" />
                  <span className="font-[family-name:var(--font-baloo)] font-bold text-[var(--purple-dark)]">{c.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
  Uma linha da meta: barra no mesmo roxo do payback (verde quando bate),
  quanto falta por dia ate o fim do mes e onde o ritmo dos ultimos 30 dias termina.
*/
function MetaLinha({ rotulo, feito, alvo, dias, projetado }: { rotulo: string; feito: number; alvo: number; dias: number; projetado: number }) {
  const p = alvo > 0 ? Math.max(0, Math.min(100, Math.round((feito / alvo) * 100))) : 0;
  const falta = Math.max(0, alvo - feito);
  const batida = feito >= alvo;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-[var(--ink)]">{rotulo}</span>
        <span className="num font-extrabold text-[var(--ink)]">
          {brl(feito)} <span className="font-semibold text-[var(--ink)]/60">de {brl(alvo)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--purple)]/10" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`${rotulo}: ${p}% da meta`}>
        <div className={`h-full rounded-full ${batida ? "bg-emerald-500" : "bg-[var(--purple)]"}`} style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--ink)]/75">
        {batida
          ? `meta batida: ${p}%`
          : `${p}% · faltam ${brl(falta)}, ${brl(falta / Math.max(1, dias))} por dia`}
        {" · "}no ritmo dos últimos 30 dias fecha o mês em <b className="num">{brl(projetado)}</b> ({alvo > 0 ? Math.round((projetado / alvo) * 100) : 0}% da meta)
      </p>
    </div>
  );
}

/* variacao contra o periodo anterior; sem base para comparar, nao inventa percentual */
function variacao(atual: number, antes: number | undefined) {
  if (antes === undefined) return undefined;
  if (antes === 0) return atual === 0 ? { texto: "igual ao período anterior", sobe: null } : { texto: "sem base no período anterior", sobe: null };
  const d = (atual - antes) / Math.abs(antes);
  if (Math.abs(d) < 0.005) return { texto: "igual ao período anterior", sobe: null };
  return { texto: `${d > 0 ? "+" : "−"}${pct(Math.abs(d))} vs anterior`, sobe: d > 0 };
}

/*
  Indicador: rotulo, valor grande na fonte do texto (sem algarismo tabular,
  que deixa numero grande espacado), variacao com seta e palavra, nunca so cor.
*/
function Tile({
  rotulo,
  valor,
  sub,
  negativo,
  delta,
  grafico,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  negativo?: boolean;
  delta?: { texto: string; sobe: boolean | null };
  grafico?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]/70">{rotulo}</div>
      <div className={`mt-1 text-2xl font-extrabold tracking-tight ${negativo ? "text-red-600" : "text-[var(--purple-dark)]"}`}>{valor}</div>
      {delta && (
        <div
          className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold ${
            delta.sobe === null ? "text-[var(--ink)]/70" : delta.sobe ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {delta.sobe === true && <ArrowUpRight size={12} weight="bold" aria-hidden />}
          {delta.sobe === false && <ArrowDownRight size={12} weight="bold" aria-hidden />}
          {delta.texto}
        </div>
      )}
      {sub && <div className="mt-0.5 text-[11px] text-[var(--ink)]/70">{sub}</div>}
      {grafico}
    </div>
  );
}

function Bloco({
  titulo,
  sub,
  link,
  destaque,
  children,
}: {
  titulo: string;
  sub?: string;
  link?: { href: string; rotulo: string };
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`card p-4 ${destaque ? "border-2 border-[var(--sun)]" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold leading-tight text-[var(--purple-dark)]">{titulo}</h3>
          {sub && <p className="text-xs text-[var(--ink)]/70">{sub}</p>}
        </div>
        {link && (
          <Link href={link.href} className="shrink-0 text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]">
            {link.rotulo}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Nada({ texto, alto }: { texto: string; alto?: boolean }) {
  return (
    <p className={`flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--purple)]/15 px-4 text-center text-sm text-[var(--ink)]/70 ${alto ? "h-[218px]" : "py-6"}`}>
      {texto}
    </p>
  );
}

/* a mesma serie do grafico em tabela: so os periodos com venda, mais o total */
function TabelaSerie({ pontos, grao }: { pontos: Ponto[]; grao: Grao }) {
  const com = pontos.filter((p) => p.valor > 0);
  const total = com.reduce((s, p) => s + p.valor, 0);
  return (
    <div className="max-h-[218px] overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--purple)]/10 text-[10px] uppercase text-[var(--ink)]/70">
            <th className="py-2 font-bold">{grao === "dia" ? "Dia" : grao === "semana" ? "Semana" : "Mês"}</th>
            <th className="py-2 text-right font-bold">Faturamento</th>
            {com[0]?.detalhes.map((d) => (
              <th key={d.rotulo} className="py-2 text-right font-bold">{d.rotulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {com.map((p) => (
            <tr key={p.chave} className="border-b border-[var(--purple)]/6">
              <td className="py-1.5 text-[var(--ink)]">{p.longo}</td>
              <td className="py-1.5 text-right font-bold text-[var(--ink)]">{brl(p.valor)}</td>
              {p.detalhes.map((d) => (
                <td key={d.rotulo} className="py-1.5 text-right text-[var(--ink)]/80">{d.valor}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="py-1.5 font-extrabold text-[var(--purple-dark)]">Total</td>
            <td className="py-1.5 text-right font-extrabold text-[var(--purple-dark)]">{brl(total)}</td>
            <td colSpan={com[0]?.detalhes.length ?? 0} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
