"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/*
  Gera as variacoes de um produto (tamanho, cor ou os dois combinados).
  Cada variacao vira um produto filho com estoque, custo, peso e dimensoes
  proprios, entao o resto do sistema continua tratando ela como produto normal.

  O saldo do pai e distribuido entre as variacoes e cada uma nasce com a entrada
  registrada no kardex, para o historico nao ficar com buraco.
*/

type Produto = {
  id: string;
  nome: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  cor: string | null;
  categoria: string | null;
  custo_unit: number;
  preco_venda: number | null;
  qtd_atual: number;
  fornecedor_id: string | null;
  estoque_minimo: number | null;
  peso_bruto: number | null;
  comprimento_cm: number | null;
  largura_cm: number | null;
  altura_cm: number | null;
};

type Variacao = { tamanho: string; cor: string; qtd: string };

const GRADES: Record<string, string[]> = {
  "bebê (RN a GG)": ["RN", "P", "M", "G", "GG"],
  "infantil (1 a 12)": ["1", "2", "3", "4", "6", "8", "10", "12"],
};

const listar = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

export function GerarVariacoes({
  produto,
  onFechar,
  onPronto,
}: {
  produto: Produto;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const [tamanhos, setTamanhos] = useState("");
  const [cores, setCores] = useState("");
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // combina tamanhos e cores: 3 tamanhos x 2 cores = 6 variacoes
  const gerar = () => {
    const ts = listar(tamanhos);
    const cs = listar(cores);
    if (ts.length === 0 && cs.length === 0) {
      setErro("informe os tamanhos, as cores, ou os dois");
      return;
    }
    setErro("");
    const combinacoes: Variacao[] = [];
    for (const t of ts.length ? ts : [""]) {
      for (const c of cs.length ? cs : [""]) {
        combinacoes.push({ tamanho: t, cor: c, qtd: "" });
      }
    }
    setVariacoes(combinacoes);
  };

  const mudarQtd = (i: number, qtd: string) =>
    setVariacoes((arr) => arr.map((v, idx) => (idx === i ? { ...v, qtd } : v)));

  // divide o saldo do pai igualmente, jogando o resto na primeira
  const dividirIgual = () => {
    if (variacoes.length === 0) return;
    const base = Math.floor(produto.qtd_atual / variacoes.length);
    const resto = produto.qtd_atual - base * variacoes.length;
    setVariacoes((arr) => arr.map((v, i) => ({ ...v, qtd: String(base + (i === 0 ? resto : 0)) })));
  };

  const total = variacoes.reduce((s, v) => s + (parseInt(v.qtd, 10) || 0), 0);
  const sobra = produto.qtd_atual - total;

  const rotulo = (v: Variacao) => [v.tamanho && `tam ${v.tamanho}`, v.cor].filter(Boolean).join(" · ") || "variação";

  const confirmar = async () => {
    if (!supabase) return;
    if (variacoes.length === 0) return setErro("gere as variações primeiro");
    if (total > produto.qtd_atual) {
      return setErro(`a soma (${total}) passa do estoque atual (${produto.qtd_atual})`);
    }
    setErro("");
    setSalvando(true);

    for (const v of variacoes) {
      const qtd = parseInt(v.qtd, 10) || 0;
      const { data: filho, error } = await supabase
        .from("ibk_produtos")
        .insert({
          nome: produto.nome,
          categoria: produto.categoria,
          linha: produto.linha,
          genero: produto.genero,
          tamanho: v.tamanho || null,
          cor: v.cor || null,
          custo_unit: produto.custo_unit,
          preco_venda: produto.preco_venda,
          qtd_inicial: qtd,
          qtd_atual: qtd,
          fornecedor_id: produto.fornecedor_id,
          estoque_minimo: produto.estoque_minimo ?? 3,
          // peso e dimensoes comecam iguais aos do pai e podem ser ajustados
          // depois na ficha de cada variacao, porque tamanho maior pesa mais
          peso_bruto: produto.peso_bruto,
          comprimento_cm: produto.comprimento_cm,
          largura_cm: produto.largura_cm,
          altura_cm: produto.altura_cm,
          produto_pai_id: produto.id,
        })
        .select("id")
        .single();
      if (error || !filho) {
        setErro(error?.message ?? "erro ao criar a variação");
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
        obs: `variação de ${produto.nome ?? "produto"}`,
      });
    }

    // o pai vira agrupador: transfere o saldo e registra a saida no kardex
    if (total > 0) {
      await supabase.from("ibk_estoque_mov").insert({
        produto_id: produto.id,
        tipo: "saida",
        origem: "ajuste",
        qtd: -total,
        custo_unit: produto.custo_unit,
        saldo_depois: produto.qtd_atual - total,
        custo_medio_depois: produto.custo_unit,
        obs: "saldo transferido para as variações",
      });
    }
    const { error: e2 } = await supabase
      .from("ibk_produtos")
      .update({ tem_variacoes: true, qtd_atual: produto.qtd_atual - total, tamanho: null, cor: null })
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
      <div className="mt-6 w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
          Gerar variações
        </h2>
        <p className="mt-1 text-sm text-[var(--ink)]/70">
          {produto.nome ?? "Produto"} tem <strong>{produto.qtd_atual} peças</strong> num registro só.
          Cada variação passa a ter estoque, peso e dimensões próprios.
        </p>

        {/* atributos */}
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">Tamanhos (separados por vírgula)</span>
            <input value={tamanhos} onChange={(e) => setTamanhos(e.target.value)} placeholder="1, 2, 4, 6" className={inp} />
            <span className="flex flex-wrap gap-1.5 pt-1">
              {Object.entries(GRADES).map(([nome, lista]) => (
                <button key={nome} onClick={() => setTamanhos(lista.join(", "))} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-[11px] font-bold text-[var(--purple)]">
                  {nome}
                </button>
              ))}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">Cores ou estampas (opcional)</span>
            <input value={cores} onChange={(e) => setCores(e.target.value)} placeholder="Azul, Rosa, Sortido" className={inp} />
          </label>

          <button onClick={gerar} className="self-start rounded-xl bg-[var(--purple)]/10 px-4 py-2 text-sm font-extrabold text-[var(--purple)] hover:bg-[var(--purple)]/20">
            gerar combinações
          </button>
        </div>

        {/* combinacoes */}
        {variacoes.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--purple-dark)]">
                {variacoes.length} variações
              </span>
              <button onClick={dividirIgual} className="text-xs font-bold text-[var(--purple)] hover:underline">
                dividir o estoque igualmente
              </button>
            </div>

            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--purple)]/15">
              <table className="w-full text-left text-sm">
                <tbody>
                  {variacoes.map((v, i) => (
                    <tr key={i} className="border-b border-[var(--purple)]/6 last:border-0">
                      <td className="p-2 font-semibold text-[var(--ink)]">{rotulo(v)}</td>
                      <td className="p-2 text-right">
                        <input
                          inputMode="numeric"
                          value={v.qtd}
                          onChange={(e) => mudarQtd(i, e.target.value)}
                          placeholder="0"
                          className={`${inp} w-20 text-right`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-xl bg-[var(--cream)] p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--ink)]/70">Distribuído</span>
                <span className="font-bold">{total} de {produto.qtd_atual}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink)]/70">Sobra no produto pai</span>
                <span className={`font-bold ${sobra < 0 ? "text-red-500" : "text-[var(--ink)]"}`}>{sobra}</span>
              </div>
            </div>
          </>
        )}

        {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={confirmar} disabled={salvando || variacoes.length === 0} className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-50">
            {salvando ? "gerando..." : "criar variações"}
          </button>
          <button onClick={onFechar} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)]">
            cancelar
          </button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink)]/50">
          Peso e dimensões começam iguais aos do produto e podem ser ajustados na ficha de
          cada variação. Vale fazer: tamanho maior pesa mais e isso muda o frete.
        </p>
      </div>
    </div>
  );
}

const inp =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";
