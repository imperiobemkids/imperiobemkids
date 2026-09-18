"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PencilSimple, Trash, Check, X, Repeat, Plus } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonRows, btnPrimario, btnSecundario } from "../ui";
import { num, txt, brl, dataBr, hojeIso } from "@/lib/formato";

/*
  Caixa: entradas e saidas, contas a pagar por vencimento e o que se repete
  todo mes (DAS, pro-labore, ferramenta). Todo lancamento e editavel na
  propria linha. O que veio de uma venda pode ser corrigido aqui, mas a venda
  nao muda junto; o caminho certo pra isso e editar a venda.
*/

type Mov = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  categoria: string;
  valor: number;
  descricao: string | null;
  pago: boolean;
  vencimento: string | null;
  forma_pagamento: string | null;
  documento: string | null;
  data_pagamento: string | null;
  ref_venda_id: string | null;
  recorrencia_id: string | null;
  produto_id: string | null;
};

type ProdutoRef = { id: string; nome: string | null; tamanho: string | null; produto_pai_id: string | null };
const nomeProd = (p: ProdutoRef) => (p.nome?.trim() || "Produto") + (p.tamanho ? ` · ${p.tamanho}` : "");

type Recorrencia = {
  id: string;
  tipo: "entrada" | "saida";
  categoria: string;
  valor: number;
  descricao: string;
  dia_vencimento: number;
  forma_pagamento: string | null;
  proximo_em: string;
  ativo: boolean;
};

const CATEGORIAS = ["mercadoria", "insumo", "capex", "venda", "taxa_shopee", "frete", "ads", "imposto", "pro_labore", "servico", "outro"];
const ROTULO: Record<string, string> = {
  mercadoria: "Mercadoria",
  insumo: "Insumo",
  capex: "Equipamento",
  venda: "Venda",
  taxa_shopee: "Taxa de marketplace",
  frete: "Frete",
  ads: "Anúncios (Ads)",
  imposto: "Imposto (DAS)",
  pro_labore: "Pró-labore",
  servico: "Serviço / ferramenta",
  outro: "Outro",
};
const catLabel = (c: string) => ROTULO[c] ?? c;
const FORMAS = ["pix", "cartao", "boleto", "dinheiro", "transferencia", "debito_automatico"];

const diasAte = (iso: string) => Math.round((new Date(iso + "T12:00:00").getTime() - new Date(hojeIso() + "T12:00:00").getTime()) / 86400000);
const noMes = (iso: string) => iso.slice(0, 7) === hojeIso().slice(0, 7);
const somaMes = (d: string, meses: number) => {
  const x = new Date(d + "T12:00:00");
  const dia = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + meses);
  x.setDate(dia);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

export function FinanceiroClient() {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [recs, setRecs] = useState<Recorrencia[]>([]);
  const [produtos, setProdutos] = useState<ProdutoRef[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [mostrarRecs, setMostrarRecs] = useState(false);

  // form de lancamento
  const hoje = hojeIso();
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("outro");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [pago, setPago] = useState(true);
  const [vencimento, setVencimento] = useState("");
  const [data, setData] = useState(hoje);
  const [formaPagamento, setFormaPagamento] = useState("");
  const [documento, setDocumento] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [m, r, p] = await Promise.all([
      supabase.from("ibk_movimentos").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(300),
      supabase.from("ibk_recorrencias").select("*").order("dia_vencimento"),
      // so produto pai ou avulso: o anuncio e do produto, nao da variacao
      supabase.from("ibk_produtos").select("id, nome, tamanho, produto_pai_id").eq("ativo", true).is("produto_pai_id", null).order("nome"),
    ]);
    setProdutos((p.data as ProdutoRef[]) ?? []);
    if (m.error) setErro(m.error.message);
    else setMovs((m.data as Mov[]) ?? []);
    // se a 0023 ainda nao rodou, r.error vem e as recorrencias so nao aparecem
    setRecs(r.error ? [] : ((r.data as Recorrencia[]) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  // recorrencias cuja competencia ja chegou (ate o fim deste mes) e ainda nao foram lancadas
  const recsPendentes = useMemo(() => {
    const fimMes = `${hoje.slice(0, 7)}-31`;
    return recs.filter((r) => r.ativo && r.proximo_em <= fimMes);
  }, [recs, hoje]);

  if (!supabaseConfigured) return <SetupCard />;

  const adicionar = async () => {
    if (!supabase) return;
    const v = num(valor);
    if (!v) return setErro("informe o valor");
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("ibk_movimentos").insert({
      tipo,
      categoria,
      valor: v,
      data,
      descricao: descricao.trim() || null,
      pago,
      vencimento: !pago ? vencimento || null : null,
      forma_pagamento: formaPagamento || null,
      documento: documento.trim() || null,
      data_pagamento: pago ? data : null,
      produto_id: categoria === "ads" && produtoId ? produtoId : null,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    setValor("");
    setDescricao("");
    setVencimento("");
    setDocumento("");
    setData(hoje);
    carregar();
  };

  const marcarPago = async (m: Mov) => {
    if (!supabase) return;
    setMovs((r) => r.map((x) => (x.id === m.id ? { ...x, pago: true, data_pagamento: hoje } : x)));
    const { error } = await supabase.from("ibk_movimentos").update({ pago: true, data_pagamento: hoje }).eq("id", m.id);
    if (error) setErro(error.message);
  };

  const salvarEdicao = async (m: Mov, patch: Partial<Mov>) => {
    if (!supabase) return;
    setErro("");
    const { error } = await supabase.from("ibk_movimentos").update(patch).eq("id", m.id);
    if (error) return setErro(error.message);
    setEditando(null);
    carregar();
  };

  const remover = async (m: Mov) => {
    if (!supabase) return;
    const { error } = await supabase.from("ibk_movimentos").delete().eq("id", m.id);
    if (error) return setErro(error.message);
    setEditando(null);
    carregar();
  };

  /* gera o lancamento do mes de cada recorrencia pendente e empurra a proxima competencia */
  const lancarRecorrentes = async () => {
    if (!supabase || recsPendentes.length === 0) return;
    setSalvando(true);
    setErro("");
    for (const r of recsPendentes) {
      const { error } = await supabase.from("ibk_movimentos").insert({
        tipo: r.tipo,
        categoria: r.categoria,
        valor: r.valor,
        data: r.proximo_em,
        descricao: `${r.descricao} (${r.proximo_em.slice(5, 7)}/${r.proximo_em.slice(0, 4)})`,
        pago: false,
        vencimento: r.proximo_em,
        forma_pagamento: r.forma_pagamento,
        recorrencia_id: r.id,
      });
      if (error) { setErro(error.message); break; }
      await supabase.from("ibk_recorrencias").update({ proximo_em: somaMes(r.proximo_em, 1) }).eq("id", r.id);
    }
    setSalvando(false);
    carregar();
  };

  // somas
  const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const saidas = movs.filter((m) => m.tipo === "saida" && m.pago).reduce((s, m) => s + m.valor, 0);
  const saldo = entradas - saidas;
  const entradasMes = movs.filter((m) => m.tipo === "entrada" && noMes(m.data)).reduce((s, m) => s + m.valor, 0);
  const saidasMes = movs.filter((m) => m.tipo === "saida" && noMes(m.data)).reduce((s, m) => s + m.valor, 0);

  const porCategoria = CATEGORIAS.map((c) => {
    const e = movs.filter((m) => m.categoria === c && m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    const sd = movs.filter((m) => m.categoria === c && m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    return { categoria: c, entradas: e, saidas: sd, liquido: e - sd };
  }).filter((x) => x.entradas || x.saidas);

  // contas a pagar: vencidas primeiro, depois por vencimento; sem vencimento no fim
  const aPagar = [...movs.filter((m) => !m.pago)].sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999"));
  const totalAPagar = aPagar.reduce((s, m) => s + m.valor, 0);
  const vencidas = aPagar.filter((m) => m.vencimento && diasAte(m.vencimento) < 0);
  const semana = aPagar.filter((m) => m.vencimento && diasAte(m.vencimento) >= 0 && diasAte(m.vencimento) <= 7);

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
            Financeiro
          </h1>
          <p className="text-sm text-[var(--ink)]/65">Caixa, contas a pagar e o que se repete todo mês.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Kpi titulo="Saldo de caixa" valor={brl(saldo)} destaque={saldo >= 0} />
          <Kpi titulo="A pagar" valor={brl(totalAPagar)} destaque={vencidas.length === 0} sub={vencidas.length ? `${vencidas.length} vencida${vencidas.length > 1 ? "s" : ""}` : semana.length ? `${semana.length} nesta semana` : undefined} />
        </div>
      </div>

      {/* resultado do mes */}
      <div className="cascata mt-5 grid gap-3 sm:grid-cols-3">
        <Card titulo="Entradas do mês" valor={brl(entradasMes)} />
        <Card titulo="Saídas do mês" valor={brl(saidasMes)} />
        <Card titulo="Resultado do mês" valor={brl(entradasMes - saidasMes)} destaque={entradasMes - saidasMes >= 0} />
      </div>

      {/* recorrencias pendentes */}
      {recsPendentes.length > 0 && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 border-2 border-[var(--sun)] p-4">
          <Repeat size={22} weight="duotone" className="text-[var(--purple)]" />
          <div className="flex-1 text-sm">
            <b>{recsPendentes.length}</b> {recsPendentes.length === 1 ? "conta recorrente deste mês ainda não foi lançada" : "contas recorrentes deste mês ainda não foram lançadas"}:{" "}
            <span className="text-[var(--ink)]/65">{recsPendentes.map((r) => `${r.descricao} (dia ${r.dia_vencimento})`).join(", ")}</span>
          </div>
          <button onClick={lancarRecorrentes} disabled={salvando} className={btnPrimario}>
            {salvando ? "lançando..." : "lançar como a pagar"}
          </button>
        </div>
      )}

      {/* novo movimento */}
      <div className="card mt-4 flex flex-wrap items-end gap-2 p-4">
        <Campo label="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
        </Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "saida")} className={inp}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </Campo>
        <Campo label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
            {CATEGORIAS.map((c) => (<option key={c} value={c}>{catLabel(c)}</option>))}
          </select>
        </Campo>
        <Campo label="Valor">
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inp} num w-24`} />
        </Campo>
        <Campo label="Descrição">
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="opcional" className={`${inp} w-48`} onKeyDown={(e) => e.key === "Enter" && adicionar()} />
        </Campo>
        {categoria === "ads" && (
          <Campo label="Produto anunciado">
            <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={`${inp} max-w-[220px]`}>
              <option value="">loja inteira</option>
              {produtos.map((p) => (<option key={p.id} value={p.id}>{nomeProd(p)}</option>))}
            </select>
          </Campo>
        )}
        <Campo label="Forma">
          <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={inp}>
            <option value="">não informada</option>
            {FORMAS.map((f) => (<option key={f} value={f}>{f.replace("_", " ")}</option>))}
          </select>
        </Campo>
        <Campo label="Documento">
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="nota, recibo, pedido" className={`${inp} w-36`} />
        </Campo>
        <Campo label="Pago?">
          <select value={pago ? "s" : "n"} onChange={(e) => setPago(e.target.value === "s")} className={inp}>
            <option value="s">Pago</option>
            <option value="n">A pagar</option>
          </select>
        </Campo>
        {!pago && (
          <Campo label="Vencimento">
            <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inp} />
          </Campo>
        )}
        <button onClick={adicionar} disabled={salvando} className={btnPrimario}>
          {salvando ? "salvando..." : "lançar"}
        </button>
        <button onClick={() => setMostrarRecs((v) => !v)} className={`flex items-center gap-1.5 ${btnSecundario}`}>
          <Repeat size={14} weight="bold" /> recorrentes {recs.length > 0 && `(${recs.filter((r) => r.ativo).length})`}
        </button>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {mostrarRecs && <Recorrencias recs={recs} onMudou={carregar} />}

      {/* contas a pagar */}
      {aPagar.length > 0 && (
        <div className={`card mt-5 border-2 p-4 ${vencidas.length ? "border-red-300" : "border-[var(--sun)]"}`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Contas a pagar</h2>
            <span className="num text-sm font-bold text-[var(--ink)]/70">{brl(totalAPagar)}</span>
          </div>
          <div className="cascata space-y-1.5">
            {aPagar.map((m) => {
              const d = m.vencimento ? diasAte(m.vencimento) : null;
              const cor = d === null ? "bg-[var(--purple)]/5" : d < 0 ? "bg-red-50" : d <= 7 ? "bg-[var(--sun)]/30" : "bg-[var(--purple)]/5";
              return (
                <div key={m.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${cor}`}>
                  <span>
                    <strong className="num">{brl(m.valor)}</strong> · {m.descricao || catLabel(m.categoria)}
                    {d !== null && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${d < 0 ? "bg-red-100 text-red-600" : d <= 7 ? "bg-[var(--sun)]/60 text-[var(--ink)]" : "bg-white/70 text-[var(--ink)]/60"}`}>
                        {d < 0 ? `vencida há ${-d}d` : d === 0 ? "vence hoje" : d === 1 ? "vence amanhã" : `vence em ${d}d`}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => setEditando(m.id)} aria-label="editar" className="rounded-lg px-2 py-1 text-[var(--ink)]/65 hover:text-[var(--purple)]">
                      <PencilSimple size={14} weight="bold" />
                    </button>
                    <button onClick={() => marcarPago(m)} className="rounded-lg bg-[var(--purple)] px-3 py-1 text-xs font-extrabold text-white hover:bg-[var(--purple-dark)]">
                      marcar pago
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* extrato */}
      <div className="mt-5">
        <h2 className="mb-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Lançamentos</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                <th className="p-3">Data</th>
                <th className="p-3">Descrição</th>
                <th className="hidden p-3 sm:table-cell">Categoria</th>
                <th className="hidden p-3 lg:table-cell">Forma</th>
                <th className="p-3 text-right">Valor</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody className="cascata">
              {loading && <SkeletonRows cols={6} />}
              {!loading && movs.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-[var(--ink)]/70">nenhum lançamento ainda.</td></tr>
              )}
              {movs.slice(0, 60).map((m) =>
                editando === m.id ? (
                  <tr key={m.id} className="border-b border-[var(--purple)]/6 bg-[var(--purple)]/4">
                    <td colSpan={6} className="p-3">
                      <EditarMov mov={m} produtos={produtos} onSalvar={(patch) => salvarEdicao(m, patch)} onRemover={() => remover(m)} onCancelar={() => setEditando(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="group border-b border-[var(--purple)]/6 last:border-0">
                    <td className="whitespace-nowrap p-3">{dataBr(m.data)}</td>
                    <td className="p-3">
                      <div className="text-[var(--ink)]">{m.descricao || catLabel(m.categoria)}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink)]/70">
                        {m.documento && <span>{m.documento}</span>}
                        {m.ref_venda_id && <Link href="/admin/vendas" className="underline">da venda</Link>}
                        {m.recorrencia_id && <span className="flex items-center gap-0.5"><Repeat size={10} weight="bold" /> recorrente</span>}
                        {m.produto_id && <span>ads: {produtos.find((p) => p.id === m.produto_id) ? nomeProd(produtos.find((p) => p.id === m.produto_id)!) : "produto"}</span>}
                        {!m.pago && (
                          <span className="rounded-full bg-[var(--sun)]/40 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[var(--ink)]">a pagar</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden p-3 text-[var(--ink)]/70 sm:table-cell">{catLabel(m.categoria)}</td>
                    <td className="hidden p-3 capitalize text-[var(--ink)]/60 lg:table-cell">{m.forma_pagamento?.replace("_", " ") || "-"}</td>
                    <td className={`num whitespace-nowrap p-3 text-right font-bold ${m.tipo === "entrada" ? "text-emerald-600" : "text-red-500"}`}>
                      {m.tipo === "entrada" ? "+" : "−"} {brl(m.valor)}
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => setEditando(m.id)} aria-label="editar lançamento" className="rounded-lg p-1.5 text-[var(--ink)]/25 hover:bg-[var(--purple)]/8 hover:text-[var(--purple)] lg:opacity-0 lg:group-hover:opacity-100">
                        <PencilSimple size={16} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        {movs.length > 60 && <p className="mt-2 text-xs text-[var(--ink)]/70">mostrando os 60 mais recentes de {movs.length}.</p>}
      </div>

      {/* por categoria */}
      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
              <th className="p-3">Categoria</th>
              <th className="p-3 text-right">Entradas</th>
              <th className="p-3 text-right">Saídas</th>
              <th className="p-3 text-right">Líquido</th>
            </tr>
          </thead>
          <tbody className="cascata">
            {loading && <SkeletonRows cols={4} />}
            {porCategoria.map((c) => (
              <tr key={c.categoria} className="border-b border-[var(--purple)]/6 last:border-0">
                <td className="p-3 font-semibold">{catLabel(c.categoria)}</td>
                <td className="num p-3 text-right text-emerald-600">{c.entradas ? brl(c.entradas) : "-"}</td>
                <td className="num p-3 text-right text-red-500">{c.saidas ? brl(c.saidas) : "-"}</td>
                <td className={`num p-3 text-right font-bold ${c.liquido >= 0 ? "text-emerald-600" : "text-red-500"}`}>{brl(c.liquido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* edicao inline de um lancamento, com remover confirmado na propria linha */
function EditarMov({ mov, produtos, onSalvar, onRemover, onCancelar }: { mov: Mov; produtos: ProdutoRef[]; onSalvar: (p: Partial<Mov>) => void; onRemover: () => void; onCancelar: () => void }) {
  const [f, setF] = useState({
    produto_id: mov.produto_id ?? "",
    data: mov.data,
    tipo: mov.tipo,
    categoria: mov.categoria,
    valor: txt(mov.valor),
    descricao: mov.descricao ?? "",
    forma_pagamento: mov.forma_pagamento ?? "",
    documento: mov.documento ?? "",
    pago: mov.pago,
    vencimento: mov.vencimento ?? "",
  });
  const [confirmando, setConfirmando] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div>
      {mov.ref_venda_id && (
        <p className="mb-2 text-[11px] text-[var(--ink)]/75">
          este lançamento veio de uma venda: corrigir aqui não muda a venda. Se o valor da venda estiver errado, edite a venda.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} /></Campo>
        <Campo label="Tipo">
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={inp}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </Campo>
        <Campo label="Categoria">
          <select value={f.categoria} onChange={(e) => set("categoria", e.target.value)} className={inp}>
            {CATEGORIAS.map((c) => (<option key={c} value={c}>{catLabel(c)}</option>))}
          </select>
        </Campo>
        <Campo label="Valor"><input value={f.valor} onChange={(e) => set("valor", e.target.value)} inputMode="decimal" className={`${inp} num w-24`} /></Campo>
        <Campo label="Descrição"><input value={f.descricao} onChange={(e) => set("descricao", e.target.value)} className={`${inp} w-48`} /></Campo>
        {f.categoria === "ads" && (
          <Campo label="Produto anunciado">
            <select value={f.produto_id} onChange={(e) => set("produto_id", e.target.value)} className={`${inp} max-w-[220px]`}>
              <option value="">loja inteira</option>
              {produtos.map((p) => (<option key={p.id} value={p.id}>{nomeProd(p)}</option>))}
            </select>
          </Campo>
        )}
        <Campo label="Forma">
          <select value={f.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)} className={inp}>
            <option value="">não informada</option>
            {FORMAS.map((x) => (<option key={x} value={x}>{x.replace("_", " ")}</option>))}
          </select>
        </Campo>
        <Campo label="Documento"><input value={f.documento} onChange={(e) => set("documento", e.target.value)} className={`${inp} w-32`} /></Campo>
        <Campo label="Pago?">
          <select value={f.pago ? "s" : "n"} onChange={(e) => set("pago", e.target.value === "s")} className={inp}>
            <option value="s">Pago</option>
            <option value="n">A pagar</option>
          </select>
        </Campo>
        {!f.pago && (
          <Campo label="Vencimento"><input type="date" value={f.vencimento} onChange={(e) => set("vencimento", e.target.value)} className={inp} /></Campo>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            onSalvar({
              data: f.data,
              tipo: f.tipo as "entrada" | "saida",
              categoria: f.categoria,
              valor: num(f.valor),
              descricao: f.descricao.trim() || null,
              forma_pagamento: f.forma_pagamento || null,
              documento: f.documento.trim() || null,
              pago: f.pago,
              vencimento: !f.pago ? f.vencimento || null : null,
              data_pagamento: f.pago ? mov.data_pagamento ?? f.data : null,
              produto_id: f.categoria === "ads" && f.produto_id ? f.produto_id : null,
            })
          }
          className={`flex items-center gap-1 ${btnPrimario}`}
        >
          <Check size={14} weight="bold" /> salvar
        </button>
        <button onClick={onCancelar} className={`flex items-center gap-1 ${btnSecundario}`}>
          <X size={14} weight="bold" /> cancelar
        </button>
        <span className="ml-auto flex items-center gap-2 text-xs">
          {confirmando ? (
            <>
              <span className="text-[var(--ink)]/60">apagar este lançamento?</span>
              <button onClick={onRemover} className="rounded-lg bg-red-500 px-2.5 py-1 font-extrabold text-white">sim</button>
              <button onClick={() => setConfirmando(false)} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 font-bold text-[var(--purple)]">não</button>
            </>
          ) : (
            <button onClick={() => setConfirmando(true)} className="flex items-center gap-1 font-bold text-[var(--ink)]/60 hover:text-red-500">
              <Trash size={14} weight="bold" /> apagar
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/* o que se repete todo mes: lista, novo, pausar */
function Recorrencias({ recs, onMudou }: { recs: Recorrencia[]; onMudou: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("servico");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("10");
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const adicionar = async () => {
    if (!supabase) return;
    if (!descricao.trim()) return setErro("dê um nome (ex: DAS, pró-labore, Canva)");
    const d = Math.min(28, Math.max(1, parseInt(dia) || 10));
    // primeira competencia: este mes se o dia ainda nao passou, senao o proximo
    const h = new Date();
    const base = new Date(h.getFullYear(), h.getMonth(), d);
    if (base < new Date(h.getFullYear(), h.getMonth(), h.getDate())) base.setMonth(base.getMonth() + 1);
    const proximo = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    setErro("");
    setSalvando(true);
    const { error } = await supabase.from("ibk_recorrencias").insert({
      tipo: "saida",
      categoria,
      valor: num(valor),
      descricao: descricao.trim(),
      dia_vencimento: d,
      forma_pagamento: forma || null,
      proximo_em: proximo,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    setDescricao("");
    setValor("");
    onMudou();
  };

  const alternar = async (r: Recorrencia) => {
    if (!supabase) return;
    await supabase.from("ibk_recorrencias").update({ ativo: !r.ativo }).eq("id", r.id);
    onMudou();
  };

  const atualizarValor = async (r: Recorrencia, v: string) => {
    if (!supabase) return;
    const n = num(v);
    if (n === r.valor) return;
    await supabase.from("ibk_recorrencias").update({ valor: n }).eq("id", r.id);
    onMudou();
  };

  return (
    <div className="card mt-4 p-4">
      <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Contas recorrentes</h2>
      <p className="text-xs text-[var(--ink)]/75">
        O que vence todo mês. No começo do mês aparece o aviso pra lançar tudo de uma vez, já como a pagar. Valor zero (como o DAS, que muda) você preenche na hora.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Campo label="Nome"><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Pró-labore" className={`${inp} w-44`} /></Campo>
        <Campo label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
            {["imposto", "pro_labore", "servico", "ads", "insumo", "outro"].map((c) => (<option key={c} value={c}>{catLabel(c)}</option>))}
          </select>
        </Campo>
        <Campo label="Valor"><input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${inp} num w-24`} /></Campo>
        <Campo label="Dia"><input value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" className={`${inp} num w-16`} /></Campo>
        <Campo label="Forma">
          <select value={forma} onChange={(e) => setForma(e.target.value)} className={inp}>
            <option value="">não informada</option>
            {FORMAS.map((x) => (<option key={x} value={x}>{x.replace("_", " ")}</option>))}
          </select>
        </Campo>
        <button onClick={adicionar} disabled={salvando} className={`flex items-center gap-1 ${btnPrimario}`}>
          <Plus size={14} weight="bold" /> {salvando ? "salvando..." : "adicionar"}
        </button>
      </div>
      {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-3 divide-y divide-[var(--purple)]/8">
        {recs.length === 0 && <p className="py-3 text-sm text-[var(--ink)]/70">nenhuma ainda.</p>}
        {recs.map((r) => (
          <div key={r.id} className={`flex flex-wrap items-center gap-3 py-2 text-sm ${r.ativo ? "" : "opacity-50"}`}>
            <span className="flex-1 font-semibold">{r.descricao}</span>
            <span className="text-xs text-[var(--ink)]/75">{catLabel(r.categoria)} · dia {r.dia_vencimento} · próxima {dataBr(r.proximo_em)}</span>
            <input
              defaultValue={txt(r.valor)}
              onBlur={(e) => atualizarValor(r, e.target.value)}
              inputMode="decimal"
              aria-label="valor"
              className={`${inp} num w-24 text-right`}
            />
            <button onClick={() => alternar(r)} className="text-xs font-bold text-[var(--purple)] hover:underline">
              {r.ativo ? "pausar" : "reativar"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ titulo, valor, destaque, sub }: { titulo: string; valor: string; destaque?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-2 shadow-[0_3px_0_rgba(109,40,184,0.1)]">
      <div className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{titulo}</div>
      <div className={`num font-[family-name:var(--font-baloo)] text-lg font-extrabold ${destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"}`}>{valor}</div>
      {sub && <div className="text-[10px] text-[var(--ink)]/70">{sub}</div>}
    </div>
  );
}

function Card({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-bold uppercase text-[var(--ink)]/70">{titulo}</div>
      <div className={`num mt-1 font-[family-name:var(--font-baloo)] text-xl font-extrabold ${destaque === false ? "text-red-500" : "text-[var(--purple-dark)]"}`}>{valor}</div>
    </div>
  );
}
