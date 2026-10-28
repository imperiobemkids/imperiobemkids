"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { acertoDeContagem, acertoDeInsumo } from "@/lib/estoque";
import { porGrupo, type Folha, type LinhaFolha } from "@/lib/contagem";
import { dataBr } from "@/lib/formato";
import { SetupCard } from "../../SetupCard";
import { btnSecundario } from "../../ui";

type Leitura = { n: number; contado: number; leitura: "certa" | "duvida" | "em_branco" };
type MarcaIA = { valor: number; leitura: "certa" | "duvida"; conflito: boolean };

/* foto do celular em JPEG de ate 2000 px no lado maior: legivel para a IA e leve para enviar */
async function prepararFoto(arquivo: File): Promise<string> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function lerFoto(folhaId: string, imagem: string): Promise<{ leituras: Leitura[]; aviso: string }> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("entre no ERP de novo");
  const res = await fetch("/api/contagem/ler", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ folhaId, imagem }),
  });
  const json = (await res.json().catch(() => ({}))) as { leituras?: Leitura[]; aviso?: string; erro?: string };
  if (!res.ok || json.erro) throw new Error(json.erro || `erro ${res.status}`);
  return { leituras: json.leituras ?? [], aviso: json.aviso ?? "" };
}

const detalhe = (l: LinhaFolha) => [l.tamanho && `tam ${l.tamanho}`, l.cor].filter(Boolean).join(" · ");
const sinal = (d: number) => (d > 0 ? `+${d}` : String(d));

/*
  Lancar a contagem de uma folha impressa: a mesma lista, na mesma ordem e
  numeracao do papel. Os numeros entram digitados ou lidos da foto pela IA; o
  que ela leu com duvida fica em amarelo. Na conferencia aparecem so as linhas
  que deram diferenca, e aplicar mexe so na diferenca (lib/estoque.ts,
  acertoDeContagem), sem desfazer venda feita depois da impressao.
*/
export function LancarContagem({ folhaInicial }: { folhaInicial: string | null }) {
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [folhaId, setFolhaId] = useState(folhaInicial ?? "");
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [valores, setValores] = useState<Record<number, string>>({});
  const [ia, setIa] = useState<Record<number, MarcaIA>>({});
  const [etapa, setEtapa] = useState<"lancar" | "conferir">("lancar");
  const [lendo, setLendo] = useState(0);
  const [avisosFoto, setAvisosFoto] = useState<string[]>([]);
  const [aplicando, setAplicando] = useState(false);
  const [aplicadas, setAplicadas] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const campos = useRef<(HTMLInputElement | null)[]>([]);
  const sujo = useRef(false);
  // valores atuais fora do render: as fotos voltam uma a uma e comparam com o que ja foi digitado
  const valoresRef = useRef<Record<number, string>>({});
  const definirValores = (novo: Record<number, string>) => {
    valoresRef.current = novo;
    setValores(novo);
  };

  const carregar = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("ibk_contagens")
      .select("*")
      .order("criada_em", { ascending: false })
      .limit(30);
    if (error) {
      setSemTabela(/ibk_contagens|does not exist|schema cache/i.test(error.message));
      setErro(error.message);
    } else {
      const lista = (data as Folha[]) ?? [];
      setFolhas(lista);
      setFolhaId((atual) => atual || lista.find((f) => f.status === "aberta")?.id || "");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
  }, [carregar]);

  const folha = folhas.find((f) => f.id === folhaId) ?? null;
  const linhas = useMemo(() => folha?.linhas ?? [], [folha]);
  const aberta = folha?.status === "aberta";

  // troca de folha: carrega o rascunho dela
  useEffect(() => {
    if (!folha) return;
    definirValores(Object.fromEntries(Object.entries(folha.contado ?? {}).map(([n, v]) => [Number(n), String(v)])));
    setIa({});
    setEtapa("lancar");
    setAplicadas(new Set());
    setAvisosFoto([]);
    setErro("");
    setFeito("");
    sujo.current = false;
    // so ao trocar de folha; recarregar a lista nao apaga o que esta sendo digitado
  }, [folha?.id]);

  // rascunho salvo no banco: o celular e o PC veem o mesmo lancamento
  useEffect(() => {
    if (!folha || !aberta || !sujo.current) return;
    const t = setTimeout(() => {
      const contado = Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v.trim() !== "").map(([n, v]) => [n, parseInt(v, 10)]),
      );
      supabase?.from("ibk_contagens").update({ contado }).eq("id", folha.id).eq("status", "aberta").then();
    }, 800);
    return () => clearTimeout(t);
  }, [valores, folha, aberta]);

  const mudar = (n: number, v: string) => {
    sujo.current = true;
    definirValores({ ...valoresRef.current, [n]: v.replace(/\D/g, "").slice(0, 4) });
    // digitou por cima: a marca da IA sai
    setIa((a) => Object.fromEntries(Object.entries(a).filter(([k]) => Number(k) !== n)));
  };

  const proximo = (i: number) => campos.current[i + 1]?.focus();

  const fotos = async (arquivos: FileList | null) => {
    if (!folha || !arquivos?.length) return;
    setErro("");
    setAvisosFoto([]);
    const lista = [...arquivos].slice(0, 8);
    setLendo(lista.length);
    // uma chamada por pagina, em paralelo: cada foto volta assim que fica pronta
    await Promise.all(
      lista.map(async (arq, i) => {
        const pagina = lista.length > 1 ? `Foto ${i + 1}: ` : "";
        try {
          const { leituras, aviso } = await lerFoto(folha.id, await prepararFoto(arq));
          if (aviso) setAvisosFoto((a) => [...a, pagina + aviso]);
          sujo.current = true;
          const novo = { ...valoresRef.current };
          const marcas: Record<number, MarcaIA> = {};
          for (const l of leituras) {
            if (l.leitura === "em_branco") continue;
            const digitado = (novo[l.n] ?? "").trim();
            const conflito = digitado !== "" && parseInt(digitado, 10) !== l.contado;
            // o que a pessoa ja digitou vale mais que a leitura: a IA so marca a diferenca
            if (!digitado) novo[l.n] = String(l.contado);
            marcas[l.n] = { valor: l.contado, leitura: conflito ? "duvida" : l.leitura, conflito };
          }
          definirValores(novo);
          setIa((a) => ({ ...a, ...marcas }));
        } catch (e) {
          setAvisosFoto((a) => [...a, pagina + (e instanceof Error ? e.message : "não deu para ler")]);
        } finally {
          setLendo((x) => x - 1);
        }
      }),
    );
  };

  const preenchidas = linhas.filter((l) => (valores[l.n] ?? "").trim() !== "").length;
  const duvidas = Object.values(ia).filter((m) => m.leitura === "duvida").length;
  const diferencas = linhas
    .filter((l) => (valores[l.n] ?? "").trim() !== "")
    .map((l) => ({ l, contado: parseInt(valores[l.n], 10) }))
    .filter((x) => x.contado !== x.l.sistema)
    .map((x) => ({ ...x, dif: x.contado - x.l.sistema }));

  const aplicar = async () => {
    if (!folha || !supabase) return;
    setAplicando(true);
    setErro("");
    const feitas = new Set(aplicadas);
    try {
      for (const d of diferencas) {
        if (feitas.has(d.l.n)) continue;
        if (d.l.tipo === "insumo") await acertoDeInsumo(d.l.id, d.dif);
        else await acertoDeContagem(d.l.id, d.dif, `acerto de contagem, folha #${folha.codigo} (sistema ${d.l.sistema}, contado ${d.contado})`);
        feitas.add(d.l.n);
        setAplicadas(new Set(feitas));
      }
      const contado = Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v.trim() !== "").map(([n, v]) => [n, parseInt(v, 10)]),
      );
      const { error } = await supabase
        .from("ibk_contagens")
        .update({ status: "aplicada", aplicada_em: new Date().toISOString(), ajustes: diferencas.length, contado })
        .eq("id", folha.id);
      if (error) throw new Error(error.message);
      setFeito(
        diferencas.length
          ? `${diferencas.length} ${diferencas.length === 1 ? "acerto aplicado" : "acertos aplicados"} no estoque.`
          : "Contagem fechada: tudo bateu com o sistema.",
      );
      await carregar();
    } catch (e) {
      // as que ja entraram ficam marcadas: aplicar de novo so faz as que faltam
      setErro(`${feitas.size} de ${diferencas.length} aplicados. Parou em um erro: ${e instanceof Error ? e.message : "erro"}. Tente aplicar de novo.`);
    }
    setAplicando(false);
  };

  const descartar = async () => {
    if (!folha || !supabase || !confirm(`Descartar a folha #${folha.codigo}? O estoque não muda.`)) return;
    await supabase.from("ibk_contagens").update({ status: "descartada" }).eq("id", folha.id);
    setFolhaId("");
    await carregar();
  };

  if (!supabaseConfigured) return <SetupCard />;

  const titulo = (
    <>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">Contagem</h1>
      <p className="text-sm text-[var(--ink)]/70">
        Lance o que foi contado na folha impressa, digitando ou pela foto. A folha sai em{" "}
        <Link href="/admin/estoque" className="font-bold text-[var(--purple)] underline">Estoque</Link> &gt; Folha de contagem.
      </p>
    </>
  );

  if (semTabela) {
    return (
      <div className="mx-auto max-w-md">
        {titulo}
        <p className="card mt-4 p-4 text-sm font-semibold text-amber-700">
          Falta criar a tabela de contagens: rode a migration 0035 (supabase/migrations/0035_contagens.sql) no SQL Editor do Supabase.
        </p>
      </div>
    );
  }

  const abertas = folhas.filter((f) => f.status === "aberta");
  // posicao de cada linha para o Enter pular para a proxima (a folha ja vem na ordem dos grupos)
  const ordem = new Map(linhas.map((l, i) => [l.n, i]));

  return (
    <div className="mx-auto max-w-md pb-28">
      {titulo}

      {/* qual folha */}
      <div className="card mt-4 p-4">
        <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">Folha</div>
        {carregando ? (
          <div className="skel mt-2 h-11 w-full" />
        ) : folhas.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink)]/70">
            Nenhuma folha impressa ainda. Em Estoque, toque em <b>Folha de contagem</b> e imprima: ela aparece aqui com o mesmo código.
          </p>
        ) : (
          <select
            value={folhaId}
            onChange={(e) => setFolhaId(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--purple)]/20 bg-white px-3 py-3 text-base"
          >
            {!folhaId && <option value="">escolha a folha</option>}
            {abertas.length > 0 && (
              <optgroup label="Para lançar">
                {abertas.map((f) => (
                  <option key={f.id} value={f.id}>
                    #{f.codigo} · {dataBr(f.criada_em)} · {f.recorte} ({f.linhas.length} linhas)
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Já fechadas">
              {folhas
                .filter((f) => f.status !== "aberta")
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    #{f.codigo} · {dataBr(f.criada_em)} · {f.status === "aplicada" ? "aplicada" : "descartada"}
                  </option>
                ))}
            </optgroup>
          </select>
        )}
      </div>

      {folha && !aberta && (
        <p className="card mt-4 p-4 text-sm text-[var(--ink)]/80">
          {folha.status === "aplicada"
            ? `Folha #${folha.codigo} aplicada em ${dataBr(folha.aplicada_em ?? folha.criada_em)}, com ${folha.ajustes ?? 0} ${folha.ajustes === 1 ? "acerto" : "acertos"}.`
            : `Folha #${folha.codigo} descartada: o estoque não mudou.`}
        </p>
      )}
      {feito && <p className="fade-in mt-3 rounded-2xl bg-[var(--mint)]/30 px-3 py-2.5 text-sm font-bold text-[var(--ink)]">{feito}</p>}

      {folha && aberta && etapa === "lancar" && (
        <>
          {/* foto das paginas */}
          <label className="card mt-4 flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-[var(--purple)]/5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--purple)] text-white">
              <Camera size={26} weight="bold" />
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold text-[var(--purple-dark)]">{lendo > 0 ? `Lendo ${lendo} ${lendo === 1 ? "foto" : "fotos"}...` : "Ler pela foto"}</span>
              <span className="block text-xs text-[var(--ink)]/65">uma foto por página, de cima, com a folha inteira e boa luz</span>
            </span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={lendo > 0} onChange={(e) => { fotos(e.target.files); e.target.value = ""; }} />
          </label>
          {avisosFoto.map((a, i) => (
            <p key={i} className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{a}</p>
          ))}
          {duvidas > 0 && (
            <p className="mt-2 rounded-xl bg-[var(--sun)]/30 px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              {duvidas} {duvidas === 1 ? "número ficou" : "números ficaram"} em dúvida, marcados em amarelo: confira no papel.
            </p>
          )}

          {/* a lista, na ordem do papel */}
          {porGrupo(linhas).map(([grupo, ls]) => (
            <div key={grupo} className="mt-5">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--ink)]/60">{grupo}</div>
              <div className="mt-1.5 flex flex-col gap-1">
                {ls.map((l) => {
                  const i = ordem.get(l.n) ?? 0;
                  const marca = ia[l.n];
                  return (
                    <div
                      key={l.n}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                        marca?.leitura === "duvida" ? "bg-[var(--sun)]/35" : "bg-white"
                      }`}
                    >
                      <span className="w-7 shrink-0 text-right text-xs font-bold text-[var(--ink)]/50">{l.n}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{l.produto}</span>
                        <span className="block text-xs text-[var(--ink)]/60">
                          {[detalhe(l), folha.mostrar_sistema && `sistema ${l.sistema}`].filter(Boolean).join(" · ")}
                          {marca && (
                            <span className={`ml-1 font-bold ${marca.leitura === "duvida" ? "text-amber-800" : "text-emerald-700"}`}>
                              {marca.conflito ? `· a IA leu ${marca.valor}` : marca.leitura === "duvida" ? "· IA, confira" : "· IA"}
                            </span>
                          )}
                        </span>
                      </span>
                      <input
                        ref={(el) => {
                          campos.current[i] = el;
                        }}
                        inputMode="numeric"
                        enterKeyHint="next"
                        aria-label={`contado da linha ${l.n}`}
                        value={valores[l.n] ?? ""}
                        onChange={(e) => mudar(l.n, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            proximo(i);
                          }
                        }}
                        className="h-11 w-16 shrink-0 rounded-xl border border-[var(--purple)]/20 bg-white text-center text-lg font-extrabold text-[var(--ink)] outline-none focus:border-[var(--purple)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={descartar} className="mt-6 text-sm font-semibold text-[var(--ink)]/55 underline">
            descartar esta folha
          </button>

          {/* barra fixa embaixo: progresso e conferencia */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--purple)]/12 bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <span className="text-sm text-[var(--ink)]/70">
                <b className="text-[var(--purple-dark)]">{preenchidas}</b> de {linhas.length}
              </span>
              <button
                onClick={() => setEtapa("conferir")}
                disabled={preenchidas === 0}
                className="ml-auto rounded-2xl bg-[var(--purple)] px-5 py-3 text-sm font-extrabold text-white shadow-[0_3px_0_rgba(76,29,128,0.35)] disabled:opacity-50"
              >
                Conferir diferenças
              </button>
            </div>
          </div>
        </>
      )}

      {folha && aberta && etapa === "conferir" && (
        <div className="fade-in">
          <div className="card mt-4 p-4">
            <div className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              {diferencas.length === 0 ? "Tudo bateu" : `${diferencas.length} ${diferencas.length === 1 ? "diferença" : "diferenças"}`}
            </div>
            <p className="text-sm text-[var(--ink)]/70">
              {preenchidas - diferencas.length} {preenchidas - diferencas.length === 1 ? "linha bateu" : "linhas bateram"} com o sistema
              {linhas.length - preenchidas > 0 && `; ${linhas.length - preenchidas} sem número ficam como estão`}. O acerto aplica só a diferença, então venda feita depois de imprimir a folha continua valendo.
            </p>
            <div className="mt-3 flex flex-col gap-1">
              {diferencas.map((d) => (
                <div
                  key={d.l.n}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                    ia[d.l.n]?.leitura === "duvida" ? "bg-[var(--sun)]/35" : "bg-[var(--purple)]/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--ink)]">
                      <span className="mr-1 text-[var(--ink)]/50">{d.l.n}</span>
                      {d.l.produto}
                    </span>
                    <span className="text-xs text-[var(--ink)]/60">
                      {[detalhe(d.l), `sistema ${d.l.sistema}, contado ${d.contado}`].filter(Boolean).join(" · ")}
                      {aplicadas.has(d.l.n) && " · aplicado"}
                    </span>
                  </span>
                  <span className={`shrink-0 font-extrabold ${d.dif > 0 ? "text-emerald-700" : "text-red-500"}`}>{sinal(d.dif)}</span>
                </div>
              ))}
            </div>
            <button
              onClick={aplicar}
              disabled={aplicando}
              className="mt-4 w-full rounded-2xl bg-[var(--purple)] py-4 text-base font-extrabold text-white shadow-[0_3px_0_rgba(76,29,128,0.35)] disabled:opacity-60"
            >
              {aplicando
                ? "aplicando..."
                : diferencas.length === 0
                  ? "Fechar a contagem"
                  : `Aplicar ${diferencas.length} ${diferencas.length === 1 ? "acerto" : "acertos"} no estoque`}
            </button>
            {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}
          </div>
          <button onClick={() => setEtapa("lancar")} className={`${btnSecundario} mt-3`}>
            voltar e corrigir
          </button>
        </div>
      )}

      {erro && etapa === "lancar" && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}
    </div>
  );
}
