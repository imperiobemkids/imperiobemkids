"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, CaretDown, Printer, Ruler } from "@phosphor-icons/react";
import type { GuardaRoupa, MesGuardaRoupa } from "@/lib/checkout/guardaRoupa";
import { brl } from "@/lib/formato";
import { LinhaLista, campo, cartao, noTopo, rotulo } from "../lista/MinhaLista";
import { somar, type Item, type Itens } from "../lista/folha";
import { imprimirGuardaRoupa, montarGrupos } from "./folha";

/*
  O guarda-roupa de 1 a 3 anos no navegador do celular. O servidor so faz a
  conta; o que a pessoa escolhe e digita fica salvo neste navegador, como na
  Minha lista. Outro aparelho ou outro navegador comeca do zero.
*/

type Salvo = { crianca: string; mes: number; ano: number; regiao: string; dias: number; itens: Itens };
type Opcoes = {
  produto: string;
  meses: string[];
  anos: number[];
  regioes: { nome: string; descricao: string }[];
  dias: number[];
  diasPadrao: number;
};

// as mesmas cores das estacoes na planilha
const COR: Record<MesGuardaRoupa["codigo"], string> = { Q: "bg-[#fde68a]", A: "bg-[#d1fae5]", F: "bg-[#ddd6fe]" };

export function MeuGuardaRoupa({ acesso, opcoes }: { acesso: string; opcoes: Opcoes }) {
  const chave = `ibk-guarda-roupa:${acesso}`;
  const [salvo, setSalvo] = useState<Salvo>({ crianca: "", mes: 0, ano: 0, regiao: "", dias: opcoes.diasPadrao, itens: {} });
  const [lido, setLido] = useState(false);
  const [guarda, setGuarda] = useState<GuardaRoupa | null>(null);
  const [estado, setEstado] = useState<"espera" | "carregando" | "pronto" | "erro">("espera");
  const [tentativa, setTentativa] = useState(0);

  // o navegador so existe depois de montar: ler aqui evita diferenca com o HTML do servidor
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(chave);
      if (guardado) setSalvo((s) => ({ ...s, ...(JSON.parse(guardado) as Partial<Salvo>) }));
    } catch {
      // navegador sem armazenamento ou dado antigo: a pagina funciona, so nao lembra
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

  const { mes, ano, regiao, dias } = salvo;
  useEffect(() => {
    if (!mes || !ano || !regiao) {
      setGuarda(null);
      setEstado("espera");
      return;
    }
    const controle = new AbortController();
    setEstado("carregando");
    const q = new URLSearchParams({ mes: String(mes), ano: String(ano), regiao, dias: String(dias) });
    fetch(`/api/guarda-roupa/${encodeURIComponent(acesso)}?${q}`, { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<GuardaRoupa>;
      })
      .then((g) => {
        setGuarda(g);
        setEstado("pronto");
      })
      .catch(() => {
        if (!controle.signal.aborted) setEstado("erro");
      });
    return () => controle.abort();
  }, [acesso, mes, ano, regiao, dias, tentativa]);

  const grupos = useMemo(() => (guarda ? montarGrupos(guarda, salvo.itens) : []), [guarda, salvo.itens]);
  const s = somar(grupos);

  const mudarItem = (chaveItem: string, parte: Item) =>
    setSalvo((a) => ({ ...a, itens: { ...a.itens, [chaveItem]: { ...a.itens[chaveItem], ...parte } } }));

  return (
    <>
      <section className={`${cartao} grid gap-3 p-4`}>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className={rotulo} htmlFor="gr-mes">Mês de nascimento</label>
            <select id="gr-mes" className={`${campo} ${noTopo}`} value={mes} onChange={(e) => setSalvo((a) => ({ ...a, mes: Number(e.target.value) }))}>
              <option value={0}>Escolha</option>
              {opcoes.meses.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={rotulo} htmlFor="gr-ano">Ano</label>
            <select id="gr-ano" className={`${campo} ${noTopo}`} value={ano} onChange={(e) => setSalvo((a) => ({ ...a, ano: Number(e.target.value) }))}>
              <option value={0}>Escolha</option>
              {opcoes.anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <p className="col-span-2 -mt-1 text-sm text-[var(--ink)]/65">Ainda não nasceu? Use o mês previsto do parto.</p>
        </div>
        <div>
          <label className={rotulo} htmlFor="gr-regiao">Região onde vocês moram</label>
          <select id="gr-regiao" className={`${campo} ${noTopo}`} value={regiao} onChange={(e) => setSalvo((a) => ({ ...a, regiao: e.target.value }))}>
            <option value="">Escolha a região</option>
            {opcoes.regioes.map((r) => (
              <option key={r.nome} value={r.nome}>{r.nome}</option>
            ))}
          </select>
          <div className="mt-2 rounded-xl bg-[var(--cream)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]/80">
            <p>É o clima de onde a criança mora: ele diz quando entra a roupa de calor e quando entra a de frio.</p>
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
          <label className={rotulo} htmlFor="gr-dias">Lava a roupa da criança a cada</label>
          <select id="gr-dias" className={`${campo} ${noTopo}`} value={dias} onChange={(e) => setSalvo((a) => ({ ...a, dias: Number(e.target.value) }))}>
            {opcoes.dias.map((d) => (
              <option key={d} value={d}>{d} {d === 1 ? "dia" : "dias"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor="gr-crianca">Nome da criança (opcional, sai na folha impressa)</label>
          <input id="gr-crianca" className={`${campo} ${noTopo}`} value={salvo.crianca} maxLength={40} onChange={(e) => setSalvo((a) => ({ ...a, crianca: e.target.value }))} />
        </div>
      </section>

      {estado === "carregando" && !guarda && <p className="mt-6 text-center text-[15px] text-[var(--ink)]/70">Montando o guarda-roupa...</p>}
      {estado === "erro" && (
        <div className="mt-6 text-center">
          <p className="text-[15px] text-[var(--ink)]/80">Não deu para montar o guarda-roupa agora. Confira a internet e tente de novo.</p>
          <button
            type="button"
            onClick={() => setTentativa((t) => t + 1)}
            className="mt-3 rounded-full bg-[var(--purple)] px-6 py-2.5 font-extrabold text-white shadow-[0_4px_0_var(--purple-dark)]"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {guarda && estado !== "erro" && (
        <div className="mt-5 space-y-3">
          <section className={`${cartao} p-4`}>
            <h2 className="flex items-center gap-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              <Ruler size={20} weight="bold" className="text-[var(--purple)]" aria-hidden />
              Quando usa cada tamanho
            </h2>
            <ul className="mt-2 divide-y divide-[var(--purple)]/10">
              {guarda.tamanhos.map((t) => (
                <li key={t.codigo} className="py-2.5 text-[15px] leading-snug">
                  <p>
                    <b className="text-[var(--purple-dark)]">Tamanho {t.codigo}</b>{" "}
                    <span className="text-[var(--ink)]/65">{t.idade}, {t.altura}</span>
                  </p>
                  <p className="mt-0.5 text-[var(--ink)]/80">Usa de {t.quando}.</p>
                  <p className="mt-0.5 text-sm text-[var(--ink)]/70">
                    A partir de <b className="text-[var(--purple-dark)]">{t.meca}</b>, meça antes de comprar: passou de {t.ateCm} cm, já é o {t.proximo}.
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <p className="px-1 pt-1 text-sm leading-relaxed text-[var(--ink)]/70">
            A lista vem na ordem em que a criança usa cada guarda-roupa. Na meia-estação ela usa os dois.
          </p>

          {grupos.map((g, i) => {
            const b = guarda.blocos[i];
            return (
              <details key={g.id} open={i === 0} className={`${cartao} group overflow-hidden`}>
                <summary className="flex list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block font-[family-name:var(--font-baloo)] text-lg font-extrabold leading-tight text-[var(--purple-dark)]">{g.titulo}</span>
                    <span className="block text-sm text-[var(--ink)]/65">
                      A partir de {b.desde}, {b.meses} {b.meses === 1 ? "mês" : "meses"}
                    </span>
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
                  <p className="rounded-xl bg-[var(--cream)] px-3 py-2 text-sm font-semibold text-[var(--ink)]/75">
                    Uso: {b.periodos}.
                    {b.virada && <> Em {b.virada} a criança pode já estar no tamanho seguinte: meça antes de comprar.</>}
                  </p>
                  <ul>
                    {g.linhas.map((l) => (
                      <LinhaLista key={l.chave} l={l} mudar={(parte) => mudarItem(l.chave, parte)} />
                    ))}
                  </ul>
                </div>
              </details>
            );
          })}

          <details className={`${cartao} group overflow-hidden`}>
            <summary className="flex list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
              <CalendarBlank size={20} weight="bold" className="shrink-0 text-[var(--purple)]" aria-hidden />
              <span className="min-w-0 flex-1 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Calendário mês a mês</span>
              <CaretDown size={18} weight="bold" className="shrink-0 text-[var(--purple)] transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="px-4 pb-3">
              {guarda.calendario.map((m) => (
                <li key={m.rotulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-b border-[var(--purple)]/10 py-2 text-sm last:border-b-0">
                  <span className="font-bold text-[var(--ink)]">{m.rotulo}</span>
                  <span className={`justify-self-end rounded-full px-2.5 py-0.5 text-xs font-bold text-[var(--ink)]/80 ${COR[m.codigo]}`}>{m.estacao}</span>
                  <span className="text-[var(--ink)]/65">{m.idade}</span>
                  <span className={`text-right ${m.virada ? "font-extrabold text-[#be185d]" : "font-bold text-[var(--purple-dark)]"}`}>
                    Tamanho {m.tamanho}{m.virada ? " (meça)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <section className={`${cartao} p-4`}>
            <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Quanto vai custar o guarda-roupa</h2>
            {s.temValor ? (
              <dl className="mt-2 space-y-1 text-[15px]">
                <div className="flex justify-between"><dt className="text-[var(--ink)]/75">Total</dt><dd className="num font-extrabold text-[var(--purple-dark)]">{brl(s.enxoval)}</dd></div>
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
              onClick={() => imprimirGuardaRoupa(guarda, grupos, salvo.crianca, opcoes.produto)}
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
