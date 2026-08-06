"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/*
  Desdobra um produto que foi cadastrado com todos os tamanhos juntos em uma
  grade: o registro vira o produto pai (agrupador, sem estoque) e cada tamanho
  vira um filho com estoque proprio.

  O saldo do pai e distribuido entre os tamanhos e cada filho nasce com a entrada
  registrada no kardex, para o historico nao ficar com buraco.
*/

type Produto = {
  id: string;
  nome: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  categoria: string | null;
  custo_unit: number;
  preco_venda: number | null;
  qtd_atual: number;
  fornecedor_id: string | null;
  estoque_minimo: number | null;
};

type Item = { tamanho: string; qtd: string };

const SUGESTOES: Record<string, string[]> = {
  bebe: ["RN", "P", "M", "G", "GG"],
  infantil: ["1", "2", "3", "4", "6", "8", "10", "12"],
};

export function DesdobrarGrade({
  produto,
  onFechar,
  onPronto,
}: {
  produto: Produto;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const [itens, setItens] = useState<Item[]>([{ tamanho: "", qtd: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const total = itens.reduce((s, i) => s + (parseInt(i.qtd, 10) || 0), 0);
  const sobra = produto.qtd_atual - total;

  const mudar = (i: number, patch: Partial<Item>) =>
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const usarSugestao = (chave: string) =>
    setItens(SUGESTOES[chave].map((t) => ({ tamanho: t, qtd: "" })));

  const confirmar = async () => {
    if (!supabase) return;
    const validos = itens.filter((i) => i.tamanho.trim() && (parseInt(i.qtd, 10) || 0) >= 0);
    if (validos.length === 0) return setErro("informe ao menos um tamanho");
    if (total > produto.qtd_atual) {
      return setErro(`a soma dos tamanhos (${total}) passa do estoque atual (${produto.qtd_atual})`);
    }
    setErro("");
    setSalvando(true);

    // cria um filho por tamanho, herdando os dados do pai
    for (const it of validos) {
      const qtd = parseInt(it.qtd, 10) || 0;
      const { data: filho, error } = await supabase
        .from("ibk_produtos")
        .insert({
          nome: produto.nome,
          categoria: produto.categoria,
          linha: produto.linha,
          genero: produto.genero,
          tamanho: it.tamanho.trim(),
          custo_unit: produto.custo_unit,
          preco_venda: produto.preco_venda,
          qtd_inicial: qtd,
          qtd_atual: qtd,
          fornecedor_id: produto.fornecedor_id,
          estoque_minimo: produto.estoque_minimo ?? 3,
          produto_pai_id: produto.id,
        })
        .select("id")
        .single();
      if (error || !filho) {
        setErro(error?.message ?? "erro ao criar o tamanho");
        setSalvando(false);
        return;
      }
      await supabase.from("ibk_estoque_mov").insert({
        produto_id: filho.id,
        tipo: "entrada",
        origem: "inicial",
        qtd,
        custo_unit: produto.custo_unit,
        saldo_depois: qtd,
        custo_medio_depois: produto.custo_unit,
        obs: `desdobrado da grade ${produto.nome ?? ""}`.trim(),
      });
    }

    // o pai vira agrupador: zera o saldo e registra a saida no kardex
    const movido = total;
    if (movido > 0) {
      await supabase.from("ibk_estoque_mov").insert({
        produto_id: produto.id,
        tipo: "saida",
        origem: "ajuste",
        qtd: -movido,
        custo_unit: produto.custo_unit,
        saldo_depois: produto.qtd_atual - movido,
        custo_medio_depois: produto.custo_unit,
        obs: "saldo transferido para os tamanhos da grade",
      });
    }
    const { error: e2 } = await supabase
      .from("ibk_produtos")
      .update({ e_grade: true, qtd_atual: produto.qtd_atual - movido, tamanho: null })
      .eq("id", produto.id);
    if (e2) {
      setErro(e2.message);
      setSalvando(false);
      return;
    }

    setSalvando(false);
    onPronto();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="mt-6 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
          Desdobrar em tamanhos
        </h2>
        <p className="mt-1 text-sm text-[var(--ink)]/70">
          {produto.nome ?? "Produto"} tem <strong>{produto.qtd_atual} peças</strong> num registro só.
          Distribua entre os tamanhos: cada um passa a ter estoque próprio.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs font-bold text-[var(--ink)]/50">grade rápida:</span>
          <button onClick={() => usarSugestao("bebe")} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)]">
            bebê (RN a GG)
          </button>
          <button onClick={() => usarSugestao("infantil")} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1 text-xs font-bold text-[var(--purple)]">
            infantil (1 a 12)
          </button>
        </div>

        <div className="mt-4 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase text-[var(--ink)]/45">
                <th className="pb-1">Tamanho</th>
                <th className="pb-1">Quantidade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input value={it.tamanho} onChange={(e) => mudar(i, { tamanho: e.target.value })} placeholder="ex: 2" className={`${inp} w-24`} />
                  </td>
                  <td className="py-1 pr-2">
                    <input inputMode="numeric" value={it.qtd} onChange={(e) => mudar(i, { qtd: e.target.value })} placeholder="0" className={`${inp} w-20`} />
                  </td>
                  <td className="py-1">
                    {itens.length > 1 && (
                      <button onClick={() => setItens((a) => a.filter((_, idx) => idx !== i))} className="text-xs font-bold text-red-400 hover:text-red-600">
                        remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => setItens((a) => [...a, { tamanho: "", qtd: "" }])}
          className="mt-2 text-sm font-bold text-[var(--purple)] hover:text-[var(--purple-dark)]"
        >
          + adicionar tamanho
        </button>

        <div className="mt-4 rounded-xl bg-[var(--cream)] p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--ink)]/70">Distribuído</span>
            <span className="font-bold">{total} de {produto.qtd_atual}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink)]/70">Sobra no produto pai</span>
            <span className={`font-bold ${sobra < 0 ? "text-red-500" : "text-[var(--ink)]"}`}>{sobra}</span>
          </div>
        </div>

        {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={confirmar} disabled={salvando} className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
            {salvando ? "desdobrando..." : "desdobrar"}
          </button>
          <button onClick={onFechar} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)]">
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";
