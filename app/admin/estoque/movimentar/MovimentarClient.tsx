"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { ajusteEstoque, compraRapida, grupoDoProduto, saidaSemVenda, MOTIVOS_SAIDA, type MotivoSaida } from "@/lib/estoque";
import { nomeExibido } from "@/lib/reposicao";
import { ordemTamanho } from "@/lib/contagem";
import { brl, dataBr, num, txt } from "@/lib/formato";
import { SetupCard } from "../../SetupCard";

type Produto = {
  id: string;
  nome: string | null;
  categoria: string | null;
  linha: "verao" | "inverno" | null;
  genero: "menino" | "menina" | "unissex" | null;
  tamanho: string | null;
  cor: string | null;
  qtd_atual: number;
  custo_unit: number;
  produto_pai_id: string | null;
  tem_variacoes: boolean | null;
};

type Mov = {
  id: string;
  data: string;
  tipo: string;
  origem: string;
  qtd: number;
  obs: string | null;
  produto: Pick<Produto, "nome" | "linha" | "genero" | "tamanho" | "cor" | "produto_pai_id"> | null;
};

type Tipo = "entrada" | "baixa";
type Motivo = "compra" | "acerto" | MotivoSaida;

const MOTIVOS: Record<Tipo, { id: Motivo; rotulo: string; dica: string }[]> = {
  entrada: [
    { id: "compra", rotulo: "Compra", dica: "chegou mercadoria; entra no caixa como compra" },
    { id: "acerto", rotulo: "Acerto de contagem", dica: "achou mais peças do que o sistema tinha" },
  ],
  baixa: [
    ...(Object.keys(MOTIVOS_SAIDA) as MotivoSaida[]).map((m) => ({ id: m as Motivo, rotulo: MOTIVOS_SAIDA[m].rotulo, dica: MOTIVOS_SAIDA[m].dica })),
    { id: "acerto", rotulo: "Acerto de contagem", dica: "achou menos peças do que o sistema tinha" },
  ],
};

const ROTULO_ORIGEM: Record<string, string> = {
  compra: "compra", venda: "venda", ajuste: "acerto", devolucao: "devolução", inicial: "cadastro",
  presente: "presente", conteudo: "conteúdo", perda: "perda",
};

/*
  Movimentar estoque pelo celular: entrada ou baixa de uma peca em poucos
  toques, sem passar por Compras, pela tabela do Estoque e pela Saida sem venda.
  Venda nao entra aqui: e lancada em Vendas, que ja da baixa sozinha.
*/
export function MovimentarClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [busca, setBusca] = useState("");
  const [paiId, setPaiId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState<Motivo>("compra");
  const [custoTxt, setCustoTxt] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase
        .from("ibk_produtos")
        .select("id, nome, categoria, linha, genero, tamanho, cor, qtd_atual, custo_unit, produto_pai_id, tem_variacoes")
        .eq("ativo", true),
      supabase
        .from("ibk_estoque_mov")
        .select("id, data, tipo, origem, qtd, obs, produto:ibk_produtos(nome, linha, genero, tamanho, cor, produto_pai_id)")
        // pela data do movimento: venda importada da Shopee entra depois com data antiga
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    setProdutos((ps as Produto[]) ?? []);
    setMovs((ms as unknown as Mov[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
  }, [carregar]);

  // trocar entrada/baixa volta para o primeiro motivo daquele tipo
  const trocarTipo = (t: Tipo) => {
    setTipo(t);
    setMotivo(MOTIVOS[t][0].id);
    setErro("");
  };

  const filhosDe = useCallback(
    (id: string) => produtos.filter((p) => p.produto_pai_id === id).sort((a, b) => ordemTamanho(a.tamanho ?? "", b.tamanho ?? "") || (a.cor ?? "").localeCompare(b.cor ?? "")),
    [produtos],
  );

  const pais = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos
      .filter((p) => !p.produto_pai_id)
      .map((p) => {
        const filhos = filhosDe(p.id);
        return { p, filhos, total: filhos.length ? filhos.reduce((s, f) => s + f.qtd_atual, 0) : p.qtd_atual, grupo: grupoDoProduto(p) };
      })
      .filter((x) => !termo || `${nomeExibido(x.p)} ${x.grupo}`.toLowerCase().includes(termo))
      .sort((a, b) => a.grupo.localeCompare(b.grupo, "pt-BR") || nomeExibido(a.p).localeCompare(nomeExibido(b.p), "pt-BR"));
  }, [produtos, busca, filhosDe]);

  const pai = produtos.find((p) => p.id === paiId) ?? null;
  const filhosDoPai = pai ? filhosDe(pai.id) : [];
  const item = produtos.find((p) => p.id === itemId) ?? null;
  const nomeItem = item
    ? `${nomeExibido(pai ?? item)}${item.produto_pai_id ? ` · ${[item.tamanho && `tam ${item.tamanho}`, item.cor].filter(Boolean).join(" · ")}` : ""}`
    : "";

  const escolherPai = (id: string) => {
    setPaiId(id);
    const filhos = filhosDe(id);
    // produto sem variacao ja e a peca; com variacao, espera o tamanho
    setItemId(filhos.length ? "" : id);
    if (!filhos.length) {
      const p = produtos.find((x) => x.id === id);
      setCustoTxt(p?.custo_unit ? txt(p.custo_unit) : "");
    }
    setErro("");
    setFeito("");
  };

  const escolherItem = (p: Produto) => {
    setItemId(p.id);
    setCustoTxt(p.custo_unit ? txt(p.custo_unit) : "");
    setErro("");
  };

  const registrar = async () => {
    if (!item) return;
    setErro("");
    setFeito("");
    if (qtd < 1) return setErro("a quantidade precisa ser pelo menos 1");
    if (tipo === "baixa" && qtd > item.qtd_atual) return setErro(`só tem ${item.qtd_atual} no sistema; confira a contagem`);
    setSalvando(true);
    try {
      if (tipo === "entrada" && motivo === "compra") {
        await compraRapida(item.id, nomeItem, qtd, num(custoTxt));
      } else if (motivo === "acerto") {
        const novo = tipo === "entrada" ? item.qtd_atual + qtd : item.qtd_atual - qtd;
        await ajusteEstoque(item.id, novo, `acerto de contagem (${tipo === "entrada" ? "+" : "-"})${obs.trim() ? `: ${obs.trim()}` : ""}`);
      } else {
        await saidaSemVenda(item.id, qtd, motivo as MotivoSaida, obs);
      }
      const agora = tipo === "entrada" ? item.qtd_atual + qtd : item.qtd_atual - qtd;
      setFeito(`${tipo === "entrada" ? "+" : "-"}${qtd} ${nomeItem}. Agora tem ${agora}.`);
      setQtd(1);
      setObs("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não deu para registrar");
    }
    setSalvando(false);
  };

  if (!supabaseConfigured) return <SetupCard />;

  const chip = (ativo: boolean) =>
    `rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
      ativo ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/6 text-[var(--ink)] hover:bg-[var(--purple)]/12"
    }`;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">Movimentar estoque</h1>
      <p className="text-sm text-[var(--ink)]/70">
        Entrada ou baixa de peça em poucos toques. Venda é em{" "}
        <Link href="/admin/vendas" className="font-bold text-[var(--purple)] underline">Vendas</Link>, que já dá baixa sozinha.
      </p>

      {/* 1. entrada ou baixa */}
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de movimento">
        {(["entrada", "baixa"] as Tipo[]).map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={tipo === t}
            onClick={() => trocarTipo(t)}
            className={`rounded-2xl py-3.5 text-base font-extrabold transition-colors ${
              tipo === t ? "bg-[var(--purple)] text-white shadow-[0_3px_0_rgba(76,29,128,0.35)]" : "bg-white text-[var(--purple-dark)] ring-1 ring-[var(--purple)]/15"
            }`}
          >
            {t === "entrada" ? "+ Entrada" : "− Baixa"}
          </button>
        ))}
      </div>

      {/* 2. produto */}
      <div className="card mt-4 p-4">
        <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">Produto</div>
        {pai ? (
          <button onClick={() => { setPaiId(""); setItemId(""); }} className="mt-2 flex w-full items-center justify-between rounded-2xl bg-[var(--purple)]/6 px-3 py-3 text-left">
            <span className="font-bold text-[var(--purple-dark)]">{nomeExibido(pai)}</span>
            <span className="text-xs font-bold text-[var(--purple)]">trocar</span>
          </button>
        ) : (
          <>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar: verão, squishy, bomba..."
              className="mt-2 w-full rounded-2xl border border-[var(--purple)]/20 bg-white px-3 py-3 text-base outline-none focus:border-[var(--purple)]"
            />
            {loading ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-[var(--purple)]/5 px-3 py-3">
                    <div className="skel h-3.5" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
                    <div className="skel mt-2 h-2.5 w-1/4" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {pais.map(({ p, total, grupo }) => (
                  <button key={p.id} onClick={() => escolherPai(p.id)} className="flex items-center justify-between rounded-2xl bg-[var(--purple)]/5 px-3 py-3 text-left hover:bg-[var(--purple)]/10">
                    <span>
                      <span className="block font-bold text-[var(--ink)]">{nomeExibido(p)}</span>
                      <span className="text-xs text-[var(--ink)]/60">{grupo}</span>
                    </span>
                    <span className={`text-sm font-extrabold ${total === 0 ? "text-red-500" : "text-[var(--purple-dark)]"}`}>{total}</span>
                  </button>
                ))}
                {pais.length === 0 && <p className="py-3 text-center text-sm text-[var(--ink)]/60">nenhum produto com esse nome</p>}
              </div>
            )}
          </>
        )}

        {/* 3. tamanho / cor */}
        {pai && filhosDoPai.length > 0 && (
          <>
            <div className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">Tamanho</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {filhosDoPai.map((f) => (
                <button key={f.id} onClick={() => escolherItem(f)} className={chip(itemId === f.id)}>
                  <span className="block text-base">{[f.tamanho, f.cor].filter(Boolean).join(" · ") || "única"}</span>
                  <span className={`text-xs ${itemId === f.id ? "text-white/80" : f.qtd_atual === 0 ? "text-red-500" : "text-[var(--ink)]/60"}`}>tem {f.qtd_atual}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. quantidade, motivo e confirmacao */}
      {item && (
        <div className="card fade-in mt-4 p-4">
          <div className="text-sm text-[var(--ink)]/70">
            <b className="text-[var(--purple-dark)]">{nomeItem}</b> · tem {item.qtd_atual} no sistema
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <button onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="menos um" className="h-14 w-14 rounded-2xl bg-[var(--purple)]/10 text-2xl font-extrabold text-[var(--purple-dark)]">−</button>
            <input
              inputMode="numeric"
              value={qtd}
              onChange={(e) => setQtd(Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
              aria-label="quantidade"
              className="h-14 w-24 rounded-2xl border border-[var(--purple)]/20 text-center text-2xl font-extrabold text-[var(--ink)] outline-none focus:border-[var(--purple)]"
            />
            <button onClick={() => setQtd((q) => q + 1)} aria-label="mais um" className="h-14 w-14 rounded-2xl bg-[var(--purple)]/10 text-2xl font-extrabold text-[var(--purple-dark)]">+</button>
          </div>

          <div className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">Motivo</div>
          <div className="mt-2 grid gap-1.5" role="radiogroup" aria-label="Motivo">
            {MOTIVOS[tipo].map((m) => (
              <button key={m.id} role="radio" aria-checked={motivo === m.id} onClick={() => setMotivo(m.id)} className={chip(motivo === m.id)}>
                {m.rotulo}
                <span className={`block text-[11px] font-semibold ${motivo === m.id ? "text-white/80" : "text-[var(--ink)]/60"}`}>{m.dica}</span>
              </button>
            ))}
          </div>

          {tipo === "entrada" && motivo === "compra" && (
            <label className="mt-3 block text-sm font-bold text-[var(--ink)]/80">
              Custo por peça (R$)
              <input
                inputMode="decimal"
                value={custoTxt}
                onChange={(e) => setCustoTxt(e.target.value)}
                placeholder="ex: 14,90"
                className="mt-1 w-full rounded-2xl border border-[var(--purple)]/20 bg-white px-3 py-3 text-base outline-none focus:border-[var(--purple)]"
              />
              {num(custoTxt) > 0 && <span className="mt-1 block text-xs font-semibold text-[var(--ink)]/60">total da compra: {brl(num(custoTxt) * qtd)}</span>}
            </label>
          )}

          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="observação (opcional)"
            className="mt-3 w-full rounded-2xl border border-[var(--purple)]/20 bg-white px-3 py-3 text-base outline-none focus:border-[var(--purple)]"
          />

          <button
            onClick={registrar}
            disabled={salvando}
            className="mt-4 w-full rounded-2xl bg-[var(--purple)] py-4 text-base font-extrabold text-white shadow-[0_3px_0_rgba(76,29,128,0.35)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {salvando ? "registrando..." : `Registrar ${tipo} de ${qtd} ${qtd === 1 ? "peça" : "peças"}`}
          </button>
          {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}
        </div>
      )}

      {feito && <p className="fade-in mt-3 rounded-2xl bg-[var(--mint)]/30 px-3 py-2.5 text-sm font-bold text-[var(--ink)]">Feito: {feito}</p>}

      {/* ultimas movimentacoes, para conferir o que acabou de entrar ou sair */}
      <div className="mt-6">
        <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">Últimas movimentações</div>
        <div className="mt-2 flex flex-col gap-1">
          {movs.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[var(--ink)]">
                  {m.produto ? nomeExibido(produtos.find((p) => p.id === m.produto!.produto_pai_id) ?? m.produto) : "produto"}
                  {m.produto?.tamanho ? ` · tam ${m.produto.tamanho}` : ""}
                  {m.produto?.cor ? ` · ${m.produto.cor}` : ""}
                </span>
                <span className="text-xs text-[var(--ink)]/60">{ROTULO_ORIGEM[m.origem] ?? m.origem} · {dataBr(m.data)}</span>
              </span>
              <span className={`ml-2 shrink-0 font-extrabold ${m.qtd > 0 ? "text-emerald-700" : "text-red-500"}`}>{m.qtd > 0 ? `+${m.qtd}` : m.qtd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
