"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { WhatsappLogo, InstagramLogo, Globe, PencilSimple, Plus, X, MagnifyingGlass } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonCards, Vazio, Confirmar, btnPrimario, btnSecundario } from "../ui";
import { brl, num, txt, hojeIso, dataBr } from "@/lib/formato";
import { linkWhatsapp } from "@/lib/clientes";

/*
  Fornecedores como funil de prospeccao. Pista (achado na pesquisa) vira
  contatado, cotado, aprovado e ativo (ja compra), ou descartado. Cada um
  guarda o que decide a compra: pedido minimo, aceita CPF, emite NF, permite
  vender em marketplace e o preco que passou. A meta de custo por peca fica
  visivel pra comparar a cotacao na hora.
*/

type Status = "pista" | "contatado" | "cotado" | "aprovado" | "ativo" | "descartado";
type Tipo = "fabrica" | "atacado" | "ponta_estoque" | "dropshipping" | "polo";

type Fornecedor = {
  id: string;
  nome: string;
  contato: string | null;
  canal: string | null;
  link: string | null;
  obs: string | null;
  status: Status;
  tipo: Tipo | null;
  polo: string | null;
  cidade_uf: string | null;
  whatsapp: string | null;
  instagram: string | null;
  produtos: string | null;
  pedido_minimo: number | null;
  aceita_cpf: boolean | null;
  emite_nf: boolean | null;
  permite_marketplace: boolean | null;
  preco_ref: string | null;
  ultimo_contato: string | null;
  ibk_produtos: { count: number }[];
};

const STATUS: Record<Status, { rotulo: string; cor: string }> = {
  pista: { rotulo: "pista", cor: "bg-[var(--ink)]/8 text-[var(--ink)]/75" },
  contatado: { rotulo: "contatado", cor: "bg-sky-100 text-sky-800" },
  cotado: { rotulo: "cotado", cor: "bg-[var(--sun)]/50 text-[var(--ink)]" },
  aprovado: { rotulo: "aprovado", cor: "bg-emerald-100 text-emerald-700" },
  ativo: { rotulo: "ativo (compra)", cor: "bg-[var(--purple)] text-white" },
  descartado: { rotulo: "descartado", cor: "bg-red-100 text-red-600" },
};
const ORDEM: Status[] = ["ativo", "aprovado", "cotado", "contatado", "pista", "descartado"];

const TIPO: Record<Tipo, string> = {
  fabrica: "fábrica",
  atacado: "atacado de revenda",
  ponta_estoque: "ponta de estoque",
  dropshipping: "dropshipping",
  polo: "polo / feira",
};

// meta de custo por peca pra 25% de margem na Shopee (nota "Fornecedores com Pouco Caixa")
const METAS = "metas por peça: conjunto avulso R$ 14,79 · kit 3 conjuntos R$ 7,66 · pijama R$ 6,59 · body R$ 5,81 · kit RN R$ 34";

const vazio = (): Partial<Fornecedor> => ({ status: "pista", tipo: "fabrica" });

export function FornecedoresClient() {
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Status>("todos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null); // id, ou "novo"
  const [removendo, setRemovendo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("ibk_fornecedores").select("*, ibk_produtos(count)").order("nome");
    if (error) setErro(error.message);
    else setRows((data as Fornecedor[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows
      .filter((r) => filtro === "todos" || r.status === filtro)
      .filter((r) => !q || [r.nome, r.polo, r.cidade_uf, r.produtos, r.obs].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [rows, filtro, busca]);

  if (!supabaseConfigured) return <SetupCard />;

  const mudarStatus = async (f: Fornecedor, status: Status) => {
    if (!supabase) return;
    const patch: Partial<Fornecedor> = { status };
    if (status === "contatado" || status === "cotado") patch.ultimo_contato = hojeIso();
    setRows((arr) => arr.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("ibk_fornecedores").update(patch).eq("id", f.id);
    if (error) {
      setErro(error.message);
      carregar();
    }
  };

  const remover = async (f: Fornecedor) => {
    if (!supabase) return;
    setRemovendo(null);
    const { error } = await supabase.from("ibk_fornecedores").delete().eq("id", f.id);
    if (error) setErro(error.message);
    else carregar();
  };

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">Fornecedores</h1>
          <p className="text-sm text-[var(--ink)]/70">De pista a fornecedor ativo, com o que foi cotado. {METAS}.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2">
            <MagnifyingGlass size={16} className="text-[var(--ink)]/60" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome, polo, produto" className="w-44 bg-transparent text-sm outline-none" />
          </label>
          <button onClick={() => setEditando(editando === "novo" ? null : "novo")} className={`flex items-center gap-1.5 ${btnPrimario}`}>
            {editando === "novo" ? <X size={16} weight="bold" /> : <Plus size={16} weight="bold" />} fornecedor
          </button>
        </div>
      </div>

      {/* funil */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(["todos", ...ORDEM] as const).map((s) => {
          const n = s === "todos" ? rows.length : contagem[s] ?? 0;
          if (s !== "todos" && n === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setFiltro(s)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${filtro === s ? "bg-[var(--purple)] text-white" : "bg-white text-[var(--ink)]/70 hover:bg-[var(--purple)]/8"}`}
            >
              {s === "todos" ? "todos" : STATUS[s].rotulo} <span className="num opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {editando === "novo" && (
        <div className="mt-4">
          <FormFornecedor inicial={vazio()} onCancelar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
        </div>
      )}

      {loading && (
        <div className="cascata mt-5 grid gap-3 sm:grid-cols-2">
          <SkeletonCards n={4} />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="mt-6">
          <Vazio emoji="🏭" titulo="Nenhum fornecedor ainda" texto="Cadastre quem vende pra você e as pistas que ainda vai cotar." />
        </div>
      )}

      <div className="cascata mt-5 grid gap-3 lg:grid-cols-2">
        {visiveis.map((f) =>
          editando === f.id ? (
            <div key={f.id} className="lg:col-span-2">
              <FormFornecedor
                inicial={f}
                onCancelar={() => setEditando(null)}
                onSalvo={() => { setEditando(null); carregar(); }}
                onRemover={() => { setEditando(null); setRemovendo(f.id); }}
              />
            </div>
          ) : (
            <div key={f.id} className={`card p-4 ${f.status === "descartado" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-[family-name:var(--font-baloo)] text-lg font-bold leading-tight text-[var(--purple-dark)]">{f.nome}</div>
                  <div className="mt-0.5 text-xs text-[var(--ink)]/70">
                    {[f.tipo && TIPO[f.tipo], f.polo, f.cidade_uf].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <select
                  value={f.status}
                  onChange={(e) => mudarStatus(f, e.target.value as Status)}
                  aria-label="status"
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold uppercase outline-none ${STATUS[f.status]?.cor ?? ""}`}
                >
                  {ORDEM.map((s) => (<option key={s} value={s}>{STATUS[s].rotulo}</option>))}
                </select>
              </div>

              {f.produtos && <p className="mt-2 text-sm text-[var(--ink)]/80">{f.produtos}</p>}

              {/* o que decide a compra */}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {f.pedido_minimo != null && (
                  <span className="num rounded-full bg-[var(--purple)]/8 px-2 py-0.5 text-[var(--purple-dark)]">
                    mínimo {f.pedido_minimo === 0 ? "sem" : brl(f.pedido_minimo)}
                  </span>
                )}
                <Sinal rotulo="CPF" valor={f.aceita_cpf} />
                <Sinal rotulo="NF" valor={f.emite_nf} />
                <Sinal rotulo="marketplace" valor={f.permite_marketplace} />
                {(f.ibk_produtos?.[0]?.count ?? 0) > 0 && (
                  <span className="rounded-full bg-[var(--purple)]/8 px-2 py-0.5 text-[var(--purple)]">{f.ibk_produtos[0].count} SKUs</span>
                )}
              </div>

              {f.preco_ref && (
                <p className="mt-2 rounded-lg bg-[var(--sun)]/25 px-2.5 py-1.5 text-xs text-[var(--ink)]">
                  <span className="font-bold">preço: </span>{f.preco_ref}
                </p>
              )}
              {f.obs && <p className="mt-2 text-xs leading-relaxed text-[var(--ink)]/70">{f.obs}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--purple)]/8 pt-2">
                {linkWhatsapp(f.whatsapp) && (
                  <a href={linkWhatsapp(f.whatsapp)!} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-200">
                    <WhatsappLogo size={14} weight="fill" /> WhatsApp
                  </a>
                )}
                {f.instagram && (
                  <a href={`https://instagram.com/${f.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-1 rounded-lg bg-pink-100 px-2.5 py-1 text-xs font-bold text-pink-700 hover:bg-pink-200">
                    <InstagramLogo size={14} weight="bold" /> {f.instagram}
                  </a>
                )}
                {f.link && (
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-1 rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
                    <Globe size={14} weight="bold" /> site
                  </a>
                )}
                {f.contato && <span className="text-xs text-[var(--ink)]/70">{f.contato}</span>}
                <span className="ml-auto flex items-center gap-2 text-[11px] text-[var(--ink)]/60">
                  {f.ultimo_contato && <span>contato {dataBr(f.ultimo_contato)}</span>}
                  <button onClick={() => setEditando(f.id)} aria-label="editar" className="rounded-lg p-1 text-[var(--ink)]/55 hover:bg-[var(--purple)]/8 hover:text-[var(--purple)]">
                    <PencilSimple size={16} weight="bold" />
                  </button>
                </span>
              </div>
              {removendo === f.id ? (
                <div className="mt-2">
                  <Confirmar texto="os SKUs ligados ficam sem fornecedor. remover?" onSim={() => remover(f)} onNao={() => setRemovendo(null)} />
                </div>
              ) : null}
            </div>
          ),
        )}
      </div>
    </div>
  );

}

function FormFornecedor({ inicial, onCancelar, onSalvo, onRemover }: { inicial: Partial<Fornecedor>; onCancelar: () => void; onSalvo: () => void; onRemover?: () => void }) {
  const [f, setF] = useState({
    nome: inicial.nome ?? "",
    status: (inicial.status ?? "pista") as Status,
    tipo: (inicial.tipo ?? "") as Tipo | "",
    polo: inicial.polo ?? "",
    cidade_uf: inicial.cidade_uf ?? "",
    whatsapp: inicial.whatsapp ?? "",
    instagram: inicial.instagram ?? "",
    link: inicial.link ?? "",
    contato: inicial.contato ?? "",
    produtos: inicial.produtos ?? "",
    pedido_minimo: inicial.pedido_minimo != null ? txt(inicial.pedido_minimo) : "",
    aceita_cpf: inicial.aceita_cpf ?? null,
    emite_nf: inicial.emite_nf ?? null,
    permite_marketplace: inicial.permite_marketplace ?? null,
    preco_ref: inicial.preco_ref ?? "",
    obs: inicial.obs ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    if (!supabase) return;
    if (!f.nome.trim()) return setErroForm("informe o nome");
    setSalvando(true);
    setErroForm("");
    const payload = {
      nome: f.nome.trim(),
      status: f.status,
      tipo: f.tipo || null,
      polo: f.polo.trim() || null,
      cidade_uf: f.cidade_uf.trim() || null,
      whatsapp: f.whatsapp.replace(/\D/g, "") || null,
      instagram: f.instagram.trim() || null,
      link: f.link.trim() || null,
      contato: f.contato.trim() || null,
      produtos: f.produtos.trim() || null,
      pedido_minimo: f.pedido_minimo.trim() === "" ? null : num(f.pedido_minimo),
      aceita_cpf: f.aceita_cpf,
      emite_nf: f.emite_nf,
      permite_marketplace: f.permite_marketplace,
      preco_ref: f.preco_ref.trim() || null,
      obs: f.obs.trim() || null,
    };
    const res = inicial.id
      ? await supabase.from("ibk_fornecedores").update(payload).eq("id", inicial.id)
      : await supabase.from("ibk_fornecedores").insert(payload);
    setSalvando(false);
    if (res.error) return setErroForm(res.error.message);
    onSalvo();
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Nome"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} className={`${inp} w-48`} autoFocus /></Campo>
        <Campo label="Status">
          <select value={f.status} onChange={(e) => set("status", e.target.value as Status)} className={inp}>
            {ORDEM.map((s) => (<option key={s} value={s}>{STATUS[s].rotulo}</option>))}
          </select>
        </Campo>
        <Campo label="Tipo">
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value as Tipo | "")} className={inp}>
            <option value="">não sei</option>
            {(Object.keys(TIPO) as Tipo[]).map((t) => (<option key={t} value={t}>{TIPO[t]}</option>))}
          </select>
        </Campo>
        <Campo label="Polo"><input value={f.polo} onChange={(e) => set("polo", e.target.value)} placeholder="Brás, Rua 44, SC..." className={`${inp} w-32`} /></Campo>
        <Campo label="Cidade/UF"><input value={f.cidade_uf} onChange={(e) => set("cidade_uf", e.target.value)} className={`${inp} w-32`} /></Campo>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Campo label="WhatsApp"><input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" className={`${inp} w-36`} /></Campo>
        <Campo label="Instagram"><input value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@" className={`${inp} w-36`} /></Campo>
        <Campo label="Site"><input value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" className={`${inp} w-52`} /></Campo>
        <Campo label="Outro contato"><input value={f.contato} onChange={(e) => set("contato", e.target.value)} placeholder="telefone, e-mail" className={`${inp} w-44`} /></Campo>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Campo label="Produtos"><input value={f.produtos} onChange={(e) => set("produtos", e.target.value)} placeholder="conjunto, pijama, body" className={`${inp} w-56`} /></Campo>
        <Campo label="Pedido mínimo R$"><input value={f.pedido_minimo} onChange={(e) => set("pedido_minimo", e.target.value)} inputMode="decimal" placeholder="0 = sem" className={`${inp} num w-24`} /></Campo>
        <TriEstado rotulo="Aceita CPF" valor={f.aceita_cpf} onChange={(v) => set("aceita_cpf", v)} />
        <TriEstado rotulo="Emite NF" valor={f.emite_nf} onChange={(v) => set("emite_nf", v)} />
        <TriEstado rotulo="Permite marketplace" valor={f.permite_marketplace} onChange={(v) => set("permite_marketplace", v)} />
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Campo label="Preço cotado"><input value={f.preco_ref} onChange={(e) => set("preco_ref", e.target.value)} placeholder="conjunto R$ 8,50; pijama R$ 5,90" className={`${inp} w-80`} /></Campo>
        <Campo label="Obs"><input value={f.obs} onChange={(e) => set("obs", e.target.value)} className={`${inp} w-72`} /></Campo>
      </div>
      <p className="mt-2 text-[11px] text-[var(--ink)]/65">{METAS}</p>
      {erroForm && <p className="mt-2 text-sm font-semibold text-red-500">{erroForm}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={salvar} disabled={salvando} className={btnPrimario}>{salvando ? "salvando..." : "salvar"}</button>
        <button onClick={onCancelar} className={btnSecundario}>cancelar</button>
        {onRemover && (
          <button onClick={onRemover} className="ml-auto text-xs font-bold text-[var(--ink)]/55 hover:text-red-500">
            remover fornecedor
          </button>
        )}
      </div>
    </div>
  );
}

/* sim / nao / nao sei, num clique */
function TriEstado({ rotulo, valor, onChange }: { rotulo: string; valor: boolean | null; onChange: (v: boolean | null) => void }) {
  const proximo = valor === null ? true : valor ? false : null;
  return (
    <button
      type="button"
      onClick={() => onChange(proximo)}
      className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${
        valor === true ? "border-emerald-500 bg-emerald-50 text-emerald-700" : valor === false ? "border-red-300 bg-red-50 text-red-600" : "border-[var(--purple)]/20 text-[var(--ink)]/65"
      }`}
    >
      {rotulo}: {valor === true ? "sim" : valor === false ? "não" : "?"}
    </button>
  );
}

function Sinal({ rotulo, valor }: { rotulo: string; valor: boolean | null }) {
  if (valor === null || valor === undefined) return null;
  return (
    <span className={`rounded-full px-2 py-0.5 ${valor ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
      {valor ? "" : "sem "}{rotulo}
    </span>
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
