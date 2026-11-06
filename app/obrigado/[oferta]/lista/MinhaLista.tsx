"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, Printer } from "@phosphor-icons/react";
import type { Lista } from "@/lib/checkout/calendario";
import { brl } from "@/lib/formato";
import { imprimirLista, montarGrupos, somar, type Item, type Itens, type Linha } from "./folha";

/*
  A lista do enxoval no navegador do celular. O servidor so faz a conta das
  quantidades; o que a pessoa escolhe e digita fica salvo neste navegador.
  Outro aparelho ou outro navegador comeca do zero.
*/

type Salvo = { bebe: string; mes: number; regiao: string; dias: number; itens: Itens };
type Opcoes = { meses: string[]; regioes: { nome: string; descricao: string }[]; dias: number[]; diasPadrao: number };

const rotulo = "mb-1 block text-xs font-bold text-[var(--ink)]/70";
// letra de 16px: abaixo disso o iPhone da zoom na tela ao tocar no campo
const campo =
  "w-full rounded-xl border border-[var(--purple)]/20 bg-white text-base font-bold text-[var(--purple-dark)] outline-none focus:border-[var(--purple)]";
const noTopo = "px-3 py-2.5";
const naLinha = "num px-2 py-2";
const cartao = "rounded-3xl bg-white shadow-[0_4px_0_rgba(109,40,184,0.1)]";

export function MinhaLista({ acesso, opcoes }: { acesso: string; opcoes: Opcoes }) {
  const chave = `ibk-lista:${acesso}`;
  const [salvo, setSalvo] = useState<Salvo>({ bebe: "", mes: 0, regiao: "", dias: opcoes.diasPadrao, itens: {} });
  const [lido, setLido] = useState(false);
  const [lista, setLista] = useState<Lista | null>(null);
  const [estado, setEstado] = useState<"espera" | "carregando" | "pronto" | "erro">("espera");
  const [tentativa, setTentativa] = useState(0);

  // o navegador so existe depois de montar: ler aqui evita diferenca com o HTML do servidor
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(chave);
      if (guardado) setSalvo((s) => ({ ...s, ...(JSON.parse(guardado) as Partial<Salvo>) }));
    } catch {
      // navegador sem armazenamento ou dado antigo: a lista funciona, so nao lembra
    }
    setLido(true);
  }, [chave]);

  useEffect(() => {
    if (!lido) return;
    try {
      localStorage.setItem(chave, JSON.stringify(salvo));
    } catch {
      // sem espaco ou bloqueado: segue sem guardar
    }
  }, [chave, lido, salvo]);

  const { mes, regiao, dias } = salvo;
  useEffect(() => {
    if (!mes || !regiao) {
      setLista(null);
      setEstado("espera");
      return;
    }
    const controle = new AbortController();
    setEstado("carregando");
    const q = new URLSearchParams({ mes: String(mes), regiao, dias: String(dias) });
    fetch(`/api/lista/${encodeURIComponent(acesso)}?${q}`, { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Lista>;
      })
      .then((l) => {
        setLista(l);
        setEstado("pronto");
      })
      .catch(() => {
        if (!controle.signal.aborted) setEstado("erro");
      });
    return () => controle.abort();
  }, [acesso, mes, regiao, dias, tentativa]);

  const grupos = useMemo(() => (lista ? montarGrupos(lista, salvo.itens) : []), [lista, salvo.itens]);
  const s = somar(grupos);

  const mudarItem = (chaveItem: string, parte: Item) =>
    setSalvo((a) => ({ ...a, itens: { ...a.itens, [chaveItem]: { ...a.itens[chaveItem], ...parte } } }));

  return (
    <>
      <section className={`${cartao} grid gap-3 p-4`}>
        <div>
          <label className={rotulo} htmlFor="lista-mes">Mês previsto do parto</label>
          <select id="lista-mes" className={`${campo} ${noTopo}`} value={mes} onChange={(e) => setSalvo((a) => ({ ...a, mes: Number(e.target.value) }))}>
            <option value={0}>Escolha o mês</option>
            {opcoes.meses.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="lista-regiao">Região onde vocês moram</label>
          <select id="lista-regiao" className={`${campo} ${noTopo}`} value={regiao} onChange={(e) => setSalvo((a) => ({ ...a, regiao: e.target.value }))}>
            <option value="">Escolha a região</option>
            {opcoes.regioes.map((r) => (
              <option key={r.nome} value={r.nome}>{r.nome}</option>
            ))}
          </select>
          <div className="mt-2 rounded-xl bg-[var(--cream)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]/80">
            <p>É o clima de onde o bebê vai morar: ele define manga curta ou longa em cada tamanho.</p>
            {/* escolheu, fica so a regiao dela, para o formulario nao ocupar a tela do celular */}
            <ul className="mt-1.5 space-y-1">
              {opcoes.regioes.filter((r) => !regiao || r.nome === regiao).map((r) => (
                <li key={r.nome}>
                  <b className="text-[var(--purple-dark)]">{r.nome}:</b> {r.descricao}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">Sua cidade é mais fria ou mais quente que o normal do estado? Escolha a região de clima mais parecido.</p>
          </div>
        </div>
        <div>
          <label className={rotulo} htmlFor="lista-dias">Lava a roupinha do bebê a cada</label>
          <select id="lista-dias" className={`${campo} ${noTopo}`} value={dias} onChange={(e) => setSalvo((a) => ({ ...a, dias: Number(e.target.value) }))}>
            {opcoes.dias.map((d) => (
              <option key={d} value={d}>{d} {d === 1 ? "dia" : "dias"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="lista-bebe">Nome do bebê (opcional, sai na folha impressa)</label>
          <input id="lista-bebe" className={`${campo} ${noTopo}`} value={salvo.bebe} maxLength={40} onChange={(e) => setSalvo((a) => ({ ...a, bebe: e.target.value }))} />
        </div>
      </section>

      {estado === "carregando" && !lista && <p className="mt-6 text-center text-[15px] text-[var(--ink)]/70">Montando a sua lista...</p>}
      {estado === "erro" && (
        <div className="mt-6 text-center">
          <p className="text-[15px] text-[var(--ink)]/80">Não deu para montar a lista agora. Confira a internet e tente de novo.</p>
          <button
            type="button"
            onClick={() => setTentativa((t) => t + 1)}
            className="mt-3 rounded-full bg-[var(--purple)] px-6 py-2.5 font-extrabold text-white shadow-[0_4px_0_var(--purple-dark)]"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {lista && estado !== "erro" && (
        <div className="mt-5 space-y-3">
          {grupos.map((g, i) => (
            <details key={g.id} open={i === 0} className={`${cartao} group overflow-hidden`}>
              <summary className="flex list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block font-[family-name:var(--font-baloo)] text-lg font-extrabold leading-tight text-[var(--purple-dark)]">{g.titulo}</span>
                  <span className="block text-sm text-[var(--ink)]/65">{g.sub}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold text-[var(--ink)]/75">
                    {g.pecas === 0 ? "Tudo certo" : `Falta${g.pecas === 1 ? "" : "m"} ${g.pecas}`}
                  </span>
                  {g.total > 0 && <span className="num block text-sm font-extrabold text-[var(--purple-dark)]">{brl(g.total)}</span>}
                </span>
                <CaretDown size={18} weight="bold" className="shrink-0 text-[var(--purple)] transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-3">
                {g.uso && <p className="rounded-xl bg-[var(--cream)] px-3 py-2 text-sm font-semibold text-[var(--ink)]/75">{g.uso}</p>}
                <ul>
                  {g.linhas.map((l) => (
                    <LinhaLista key={l.chave} l={l} mudar={(parte) => mudarItem(l.chave, parte)} />
                  ))}
                </ul>
              </div>
            </details>
          ))}

          <section className={`${cartao} p-4`}>
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Quanto vai custar o enxoval</h2>
            {s.temValor ? (
              <dl className="mt-2 space-y-1 text-[15px]">
                <div className="flex justify-between"><dt className="text-[var(--ink)]/75">Total do enxoval</dt><dd className="num font-extrabold text-[var(--purple-dark)]">{brl(s.enxoval)}</dd></div>
                <div className="flex justify-between"><dt className="text-[var(--ink)]/75">Já comprei</dt><dd className="num font-bold">{brl(s.comprado)}</dd></div>
                <div className="flex justify-between"><dt className="text-[var(--ink)]/75">Falta gastar</dt><dd className="num font-extrabold">{brl(s.faltaGastar)}</dd></div>
              </dl>
            ) : (
              <p className="mt-1 text-[15px] leading-relaxed text-[var(--ink)]/75">
                Anote o valor médio de cada peça, o preço de uma unidade nas lojas que você pesquisou, e a soma aparece aqui.
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]/65">O que você preenche fica salvo neste aparelho, neste navegador.</p>
          </section>

          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl bg-[var(--purple-dark)] p-3 text-white shadow-[0_8px_24px_-8px_rgba(76,29,128,0.6)]">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">
                {s.pecas === 0 ? "Nada a comprar" : `Falta${s.pecas === 1 ? "" : "m"} ${s.pecas} ${s.pecas === 1 ? "peça" : "peças"}`}
              </p>
              {s.temValor && <p className="num text-lg font-extrabold leading-tight">{brl(s.faltaGastar)}</p>}
            </div>
            <button
              type="button"
              onClick={() => imprimirLista(lista, grupos, salvo.bebe)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[15px] font-extrabold text-[var(--purple-dark)]"
            >
              <Printer size={18} weight="bold" aria-hidden />
              Imprimir ou PDF
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function LinhaLista({ l, mudar }: { l: Linha; mudar: (parte: Item) => void }) {
  return (
    <li className="border-b border-[var(--purple)]/10 py-3 last:border-b-0">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={l.comprei}
          onChange={(e) => mudar({ comprei: e.target.checked })}
          className="mt-0.5 size-5 shrink-0 accent-[var(--purple)]"
        />
        <span className={`min-w-0 flex-1 text-[15px] font-bold leading-snug ${l.comprei ? "text-[var(--ink)]/50 line-through" : "text-[var(--ink)]"}`}>{l.nome}</span>
        <span className="shrink-0 text-sm text-[var(--ink)]/70">
          Precisa <b className="num text-[var(--purple-dark)]">{l.qtd}</b>
        </span>
      </label>
      {l.obs && <p className="mt-1 pl-[30px] text-sm leading-snug text-[var(--ink)]/65">{l.obs}</p>}
      <div className="mt-2 grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-end gap-2 pl-[30px]">
        <div>
          <label className={rotulo} htmlFor={`${l.chave}-tenho`}>Já tenho</label>
          <input
            id={`${l.chave}-tenho`}
            className={`${campo} ${naLinha} text-center`}
            inputMode="numeric"
            value={l.tenho}
            onChange={(e) => mudar({ tenho: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <div>
          <label className={rotulo} htmlFor={`${l.chave}-valor`}>Valor médio</label>
          <input
            id={`${l.chave}-valor`}
            className={`${campo} ${naLinha}`}
            inputMode="decimal"
            placeholder="R$"
            value={l.valorTexto}
            onChange={(e) => mudar({ valor: e.target.value.replace(/[^\d.,]/g, "") })}
          />
        </div>
        <div className="pb-1.5 text-right">
          <span className="block text-xs text-[var(--ink)]/65">Falta {l.falta}</span>
          <span className="num block text-[15px] font-extrabold text-[var(--purple-dark)]">{l.total === null ? "" : brl(l.total)}</span>
        </div>
      </div>
    </li>
  );
}
