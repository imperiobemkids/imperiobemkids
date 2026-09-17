"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";

/*
  Board de rotinas: uma tabela por area, colunas de segunda a domingo.
  A celula so existe nos dias em que a rotina acontece; clicar marca "feito"
  naquela data. A semana navega com as setas, sempre comecando na segunda.
*/

type Rotina = {
  id: string;
  area: string;
  titulo: string;
  dias: number[]; // 1 = segunda ... 7 = domingo
  ordem: number;
  ativo: boolean;
};

const DIAS = [
  { n: 1, curto: "seg" },
  { n: 2, curto: "ter" },
  { n: 3, curto: "qua" },
  { n: 4, curto: "qui" },
  { n: 5, curto: "sex" },
  { n: 6, curto: "sáb" },
  { n: 7, curto: "dom" },
];

// segunda-feira da semana que contem a data
function inicioDaSemana(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // domingo (0) vira 6
  x.setDate(x.getDate() - diff);
  return x;
}

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const somarDias = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function TarefasClient() {
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [checks, setChecks] = useState<Set<string>>(new Set()); // `${rotina_id}|${data}`
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [semana, setSemana] = useState(() => inicioDaSemana(new Date()));

  // formulario de nova rotina
  const [novoAberto, setNovoAberto] = useState(false);
  const [area, setArea] = useState("");
  const [titulo, setTitulo] = useState("");
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [salvando, setSalvando] = useState(false);

  const hoje = isoLocal(new Date());
  const datas = useMemo(() => DIAS.map((d) => isoLocal(somarDias(semana, d.n - 1))), [semana]);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase.from("ibk_rotinas").select("*").eq("ativo", true).order("area").order("ordem").order("titulo"),
      supabase
        .from("ibk_rotina_checks")
        .select("rotina_id, data")
        .gte("data", datas[0])
        .lte("data", datas[6]),
    ]);
    if (r.error) setErro(r.error.message);
    else setRotinas((r.data as Rotina[]) ?? []);
    if (c.error) setErro(c.error.message);
    else setChecks(new Set((c.data ?? []).map((x) => `${x.rotina_id}|${x.data}`)));
    setLoading(false);
  }, [datas]);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  const areas = useMemo(() => {
    const m = new Map<string, Rotina[]>();
    for (const r of rotinas) m.set(r.area, [...(m.get(r.area) ?? []), r]);
    return [...m.entries()];
  }, [rotinas]);

  if (!supabaseConfigured) return <SetupCard />;

  const alternar = async (r: Rotina, data: string) => {
    if (!supabase) return;
    const chave = `${r.id}|${data}`;
    const feito = checks.has(chave);
    // otimista: marca na hora, desfaz se o banco recusar
    setChecks((s) => {
      const n = new Set(s);
      if (feito) n.delete(chave);
      else n.add(chave);
      return n;
    });
    const { error } = feito
      ? await supabase.from("ibk_rotina_checks").delete().eq("rotina_id", r.id).eq("data", data)
      : await supabase.from("ibk_rotina_checks").insert({ rotina_id: r.id, data });
    if (error) {
      setErro(error.message);
      setChecks((s) => {
        const n = new Set(s);
        if (feito) n.add(chave);
        else n.delete(chave);
        return n;
      });
    }
  };

  const adicionar = async () => {
    if (!supabase) return;
    if (!area.trim() || !titulo.trim()) {
      setErro("informe a área e a rotina");
      return;
    }
    if (dias.length === 0) {
      setErro("escolha ao menos um dia");
      return;
    }
    setErro("");
    setSalvando(true);
    const ordem = (rotinas.filter((r) => r.area === area.trim()).length ?? 0) + 1;
    const { error } = await supabase
      .from("ibk_rotinas")
      .insert({ area: area.trim(), titulo: titulo.trim(), dias: [...dias].sort(), ordem });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTitulo("");
    carregar();
  };

  const remover = async (r: Rotina) => {
    if (!supabase) return;
    if (!confirm(`Tirar "${r.titulo}" do board? O histórico de marcações fica guardado.`)) return;
    const { error } = await supabase.from("ibk_rotinas").update({ ativo: false }).eq("id", r.id);
    if (error) setErro(error.message);
    else carregar();
  };

  const rotuloSemana = `${somarDias(semana, 0).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${somarDias(semana, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  const semanaAtual = isoLocal(semana) === isoLocal(inicioDaSemana(new Date()));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            Tarefas
          </h1>
          <p className="text-sm text-[var(--ink)]/70">Rotinas da semana por área. Toque no dia pra marcar como feito.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSemana((s) => somarDias(s, -7))} aria-label="Semana anterior" className={btnSec}>
            ‹
          </button>
          <button
            onClick={() => setSemana(inicioDaSemana(new Date()))}
            className={`${btnSec} min-w-[9.5rem] ${semanaAtual ? "" : "text-[var(--purple)]"}`}
          >
            {semanaAtual ? "esta semana" : rotuloSemana}
          </button>
          <button onClick={() => setSemana((s) => somarDias(s, 7))} aria-label="Próxima semana" className={btnSec}>
            ›
          </button>
          <button
            onClick={() => setNovoAberto((v) => !v)}
            className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]"
          >
            {novoAberto ? "fechar" : "+ rotina"}
          </button>
        </div>
      </div>

      {novoAberto && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
          <Campo label="Área">
            <input
              list="areas"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Marketing"
              className={`${inputCls} w-40`}
            />
            <datalist id="areas">
              {areas.map(([a]) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Rotina">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="ex: postar story"
              className={`${inputCls} w-60`}
            />
          </Campo>
          <Campo label="Dias">
            <div className="flex gap-1">
              {DIAS.map((d) => {
                const on = dias.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    onClick={() => setDias((v) => (on ? v.filter((x) => x !== d.n) : [...v, d.n]))}
                    className={`h-8 w-9 rounded-lg text-xs font-bold transition-colors ${
                      on ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/8 text-[var(--purple)]"
                    }`}
                  >
                    {d.curto}
                  </button>
                );
              })}
            </div>
          </Campo>
          <button
            onClick={adicionar}
            disabled={salvando}
            className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
          >
            {salvando ? "salvando..." : "adicionar"}
          </button>
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {loading && <p className="mt-6 text-[var(--ink)]/50">carregando...</p>}
      {!loading && rotinas.length === 0 && (
        <p className="mt-6 text-[var(--ink)]/50">nenhuma rotina ainda. Clique em "+ rotina" pra começar.</p>
      )}

      <div className="mt-5 flex flex-col gap-5">
        {areas.map(([nomeArea, lista]) => (
          <section key={nomeArea} className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--purple)]/10">
                    <th className="px-4 py-3 text-left font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]">
                      {nomeArea}
                    </th>
                    {DIAS.map((d, i) => {
                      const eHoje = datas[i] === hoje;
                      return (
                        <th
                          key={d.n}
                          className={`w-12 px-1 py-2 text-center text-[11px] font-bold uppercase ${
                            eHoje ? "text-[var(--purple)]" : "text-[var(--ink)]/45"
                          }`}
                        >
                          <div>{d.curto}</div>
                          <div
                            className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                              eHoje ? "bg-[var(--purple)] text-white" : ""
                            }`}
                          >
                            {datas[i].slice(8)}
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id} className="group border-b border-[var(--purple)]/5 last:border-0">
                      <td className="px-4 py-2 font-semibold text-[var(--ink)]">{r.titulo}</td>
                      {DIAS.map((d, i) => {
                        const data = datas[i];
                        if (!r.dias.includes(d.n))
                          return (
                            <td key={d.n} className="text-center text-[var(--ink)]/15">
                              ·
                            </td>
                          );
                        const feito = checks.has(`${r.id}|${data}`);
                        const passou = data < hoje && !feito;
                        return (
                          <td key={d.n} className="px-1 py-1.5 text-center">
                            <button
                              onClick={() => alternar(r, data)}
                              aria-label={`${r.titulo}, ${d.curto} ${data.slice(8)}`}
                              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-extrabold transition-all ${
                                feito
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : passou
                                    ? "border-red-300 bg-red-50 text-red-300 hover:border-red-400"
                                    : "border-[var(--purple)]/25 bg-[var(--purple)]/5 text-transparent hover:border-[var(--purple)]"
                              }`}
                            >
                              ✓
                            </button>
                          </td>
                        );
                      })}
                      <td className="pr-2 text-right">
                        <button
                          onClick={() => remover(r)}
                          aria-label="Remover rotina"
                          className="text-xs font-bold text-[var(--ink)]/25 transition-colors hover:text-red-500"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const btnSec =
  "rounded-xl bg-[var(--purple)]/8 px-3 py-2 text-sm font-bold text-[var(--purple-dark)] transition-colors hover:bg-[var(--purple)]/15";

const inputCls =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
