"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saidaSemVenda, MOTIVOS_SAIDA, type MotivoSaida } from "@/lib/estoque";
import { brl, dataBr, hojeIso } from "@/lib/formato";
import { btnPrimario, btnSecundario, SkeletonRows } from "../ui";

// cor so acompanha o nome escrito do motivo, nunca sozinha
const COR_MOTIVO: Record<MotivoSaida, string> = {
  presente: "bg-pink-100 text-pink-700",
  conteudo: "bg-[var(--purple)]/10 text-[var(--purple-dark)]",
  perda: "bg-red-100 text-red-600",
};

type LinhaSaida = {
  id: string;
  data: string;
  origem: MotivoSaida;
  qtd: number;
  custo_unit: number;
  obs: string | null;
  produto: { nome: string | null; tamanho: string | null; cor: string | null } | null;
};

/*
  Historico das saidas sem venda: o que saiu, por que, para quem e quanto
  custou. Fica dentro do painel do botao "Saida sem venda", embaixo do
  formulario, para nao ocupar a pagina do estoque o tempo todo.
  `versao` muda quando uma saida nova e registrada, para a lista recarregar.
*/
function TabelaSaidas({ versao }: { versao: number }) {
  const [linhas, setLinhas] = useState<LinhaSaida[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | MotivoSaida>("todos");
  const [mostrar, setMostrar] = useState(10);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("ibk_estoque_mov")
      .select("id, data, origem, qtd, custo_unit, obs, produto:ibk_produtos(nome, tamanho, cor)")
      .in("origem", Object.keys(MOTIVOS_SAIDA))
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLinhas((data as unknown as LinhaSaida[]) ?? []);
        setLoading(false);
      });
  }, [versao]);

  const custo = (l: LinhaSaida) => Math.abs(l.qtd) * l.custo_unit;
  const porMotivo = (Object.keys(MOTIVOS_SAIDA) as MotivoSaida[])
    .map((m) => {
      const ls = linhas.filter((l) => l.origem === m);
      return { m, n: ls.reduce((s, l) => s + Math.abs(l.qtd), 0), valor: ls.reduce((s, l) => s + custo(l), 0) };
    })
    .filter((x) => x.n > 0);
  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.origem === filtro);

  return (
    <div className="-mx-4 mt-4 border-t border-[var(--purple)]/10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h3 className="font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]">
          Histórico <span className="num rounded-full bg-[var(--purple)]/10 px-2 py-0.5 text-xs text-[var(--purple)]">{linhas.length}</span>
        </h3>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          {porMotivo.map(({ m, n, valor }) => (
            <span key={m} className={`rounded-full px-2 py-0.5 font-bold ${COR_MOTIVO[m]}`}>
              {MOTIVOS_SAIDA[m].rotulo.split(" ")[0]}: <span className="num">{n} un · {brl(valor)}</span>
            </span>
          ))}
        </span>
      </div>

      <div>
        {linhas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3">
            {(["todos", ...Object.keys(MOTIVOS_SAIDA)] as ("todos" | MotivoSaida)[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${filtro === f ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/6 text-[var(--ink)]/70 hover:bg-[var(--purple)]/12"}`}
              >
                {f === "todos" ? "todos" : MOTIVOS_SAIDA[f].rotulo}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase text-[var(--ink)]/70">
                <th className="p-3">Data</th>
                <th className="p-3">Produto</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Para quem / onde</th>
                <th className="p-3 text-right">Custo</th>
              </tr>
            </thead>
            <tbody className="cascata">
              {loading && <SkeletonRows cols={6} linhas={3} />}
              {!loading && visiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-5 text-center text-[var(--ink)]/70">
                    nenhuma saída registrada ainda. A primeira entra aqui pelo formulário acima.
                  </td>
                </tr>
              )}
              {visiveis.slice(0, mostrar).map((l) => (
                <tr key={l.id} className="border-t border-[var(--purple)]/6">
                  <td className="whitespace-nowrap p-3">{dataBr(l.data)}</td>
                  <td className="p-3 font-semibold text-[var(--ink)]">
                    {[l.produto?.nome?.trim() || "produto removido", l.produto?.tamanho && `tam ${l.produto.tamanho}`, l.produto?.cor].filter(Boolean).join(" · ")}
                  </td>
                  <td className="num p-3 text-right">{Math.abs(l.qtd)}</td>
                  <td className="p-3">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${COR_MOTIVO[l.origem]}`}>
                      {MOTIVOS_SAIDA[l.origem].rotulo}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--ink)]/80">{l.obs || "-"}</td>
                  <td className="num p-3 text-right font-bold text-[var(--ink)]">{brl(custo(l))}</td>
                </tr>
              ))}
              {visiveis.length > 0 && (
                <tr className="border-t-2 border-[var(--purple)]/10">
                  <td colSpan={5} className="p-3 text-right text-xs font-bold uppercase text-[var(--ink)]/70">
                    total{filtro !== "todos" ? ` de ${MOTIVOS_SAIDA[filtro].rotulo.toLowerCase()}` : ""} a preço de custo
                  </td>
                  <td className="num p-3 text-right font-extrabold text-[var(--purple-dark)]">{brl(visiveis.reduce((s, l) => s + custo(l), 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visiveis.length > mostrar && (
          <button onClick={() => setMostrar((n) => n + 20)} className="w-full border-t border-[var(--purple)]/10 p-3 text-sm font-bold text-[var(--purple)] hover:bg-[var(--purple)]/5">
            mostrar mais (faltam {visiveis.length - mostrar})
          </button>
        )}
      </div>
    </div>
  );
}

type Item = {
  id: string;
  nome: string | null;
  tamanho: string | null;
  cor: string | null;
  qtd_atual: number;
  custo_unit: number;
  tem_variacoes: boolean;
};

const rotulo = (p: Item) => [p.nome?.trim() || "Produto", p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ");

/*
  Peca que sai sem virar venda: presente, uso em video, perda. Sai do estoque
  pelo custo e o custo aparece no DRE, em vez de sumir num ajuste. Produto com
  variacoes e so agrupador: a saida e da variacao (tamanho e tipo).
*/
export function SaidaSemVenda({ produtos, onFeito, onFechar }: { produtos: Item[]; onFeito: () => void; onFechar: () => void }) {
  const [produtoId, setProdutoId] = useState("");
  const [qtd, setQtd] = useState("1");
  const [motivo, setMotivo] = useState<MotivoSaida>("presente");
  const [obs, setObs] = useState("");
  const [data, setData] = useState(hojeIso());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [versao, setVersao] = useState(0); // recarrega o historico depois de cada saida

  const opcoes = produtos
    .filter((p) => !p.tem_variacoes && p.qtd_atual > 0)
    .sort((a, b) => rotulo(a).localeCompare(rotulo(b), "pt-BR", { numeric: true }));
  const p = opcoes.find((x) => x.id === produtoId);
  const n = parseInt(qtd, 10) || 0;

  const registrar = async () => {
    if (salvando) return; // Enter duplo nao registra duas saidas
    if (!p) return setErro("escolha o produto");
    if (n < 1) return setErro("informe a quantidade");
    if (n > p.qtd_atual) return setErro(`só tem ${p.qtd_atual} em estoque`);
    setErro("");
    setSalvando(true);
    try {
      await saidaSemVenda(p.id, n, motivo, obs, data);
      setFeito(`${n} × ${rotulo(p)} saiu como ${MOTIVOS_SAIDA[motivo].rotulo.toLowerCase()} (${brl(n * p.custo_unit)} a preço de custo)`);
      setProdutoId("");
      setQtd("1");
      setObs("");
      setVersao((v) => v + 1);
      onFeito();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao registrar a saída");
    }
    setSalvando(false);
  };

  return (
    <div className="card fade-in mt-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Saída sem venda</h2>
          <p className="text-xs text-[var(--ink)]/70">
            A peça sai do estoque pelo custo e entra no resultado como despesa. Não mexe no caixa: o dinheiro já saiu na compra.
          </p>
        </div>
        <button onClick={onFechar} className={btnSecundario}>fechar</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo">
        {(Object.keys(MOTIVOS_SAIDA) as MotivoSaida[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={motivo === m}
            onClick={() => setMotivo(m)}
            className={`rounded-xl px-3 py-1.5 text-left text-sm font-bold ${motivo === m ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/6 text-[var(--ink)] hover:bg-[var(--purple)]/12"}`}
          >
            {MOTIVOS_SAIDA[m].rotulo}
            <span className={`block text-[10px] font-semibold ${motivo === m ? "text-white/80" : "text-[var(--ink)]/65"}`}>{MOTIVOS_SAIDA[m].dica}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Campo label="Produto">
          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className={`${inp} min-w-[260px]`}>
            <option value="">selecione...</option>
            {opcoes.map((x) => (
              <option key={x.id} value={x.id}>
                {rotulo(x)} ({x.qtd_atual} em estoque)
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Qtd">
          <input type="number" min={1} max={p?.qtd_atual} value={qtd} onChange={(e) => setQtd(e.target.value)} className={`${inp} w-16`} />
        </Campo>
        <Campo label={motivo === "perda" ? "O que aconteceu" : motivo === "conteudo" ? "Onde foi usada" : "Para quem"}>
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder={MOTIVOS_SAIDA[motivo].exemplo} className={`${inp} w-56`} onKeyDown={(e) => e.key === "Enter" && registrar()} />
        </Campo>
        <Campo label="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
        </Campo>
        <button onClick={registrar} disabled={salvando || !p} className={btnPrimario}>
          {salvando ? "registrando..." : "registrar saída"}
        </button>
      </div>

      {p && n > 0 && (
        <p className="mt-2 text-xs text-[var(--ink)]/75">
          sai {n} de {p.qtd_atual} · custo de <b className="num">{brl(n * p.custo_unit)}</b> vai para o resultado como {MOTIVOS_SAIDA[motivo].rotulo.toLowerCase()}
        </p>
      )}
      {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}
      {feito && !erro && <p className="mt-2 text-sm font-semibold text-emerald-700">{feito}</p>}

      <TabelaSaidas versao={versao} />
    </div>
  );
}

const inp = "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}
