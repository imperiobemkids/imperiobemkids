"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WhatsappLogo, Plus, X, Baby, MagnifyingGlass } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { SetupCard } from "../SetupCard";
import { SkeletonCards, Vazio, btnPrimario, btnSecundario } from "../ui";
import { ORIGENS, idadeTexto, tamanhoSugerido, linkWhatsapp, type Cliente, type Crianca } from "@/lib/clientes";
import { estornada, type StatusPedido } from "@/lib/pedidos";

/*
  Base de clientes: quem compra, os filhos (idade e tamanho atual) e o
  historico de compras. O tamanho sugerido pela idade, comparado com o
  tamanho da ultima compra, e o gancho pra proxima mensagem no WhatsApp.
*/

type VendaResumo = { cliente_id: string; data: string; preco_venda: number; status: StatusPedido; canal: string };

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dataBr = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");

export function ClientesClient() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null); // id em edicao
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [c, v] = await Promise.all([
      supabase.from("ibk_clientes").select("*, ibk_criancas(*)").order("nome"),
      supabase.from("ibk_vendas").select("cliente_id, data, preco_venda, status, canal").not("cliente_id", "is", null),
    ]);
    if (c.error) setErro(c.error.message);
    setClientes((c.data as Cliente[]) ?? []);
    setVendas((v.data as VendaResumo[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  const resumoPor = useMemo(() => {
    const m = new Map<string, { compras: number; total: number; ultima: string; canais: Set<string> }>();
    for (const v of vendas) {
      if (estornada(v.status)) continue;
      const r = m.get(v.cliente_id) ?? { compras: 0, total: 0, ultima: "", canais: new Set<string>() };
      r.compras++;
      r.total += v.preco_venda;
      if (v.data > r.ultima) r.ultima = v.data;
      r.canais.add(v.canal);
      m.set(v.cliente_id, r);
    }
    return m;
  }, [vendas]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? clientes.filter(
          (c) =>
            c.nome.toLowerCase().includes(q) ||
            (c.whatsapp ?? "").includes(q) ||
            (c.cidade ?? "").toLowerCase().includes(q) ||
            c.ibk_criancas.some((k) => (k.nome ?? "").toLowerCase().includes(q)),
        )
      : clientes;
    // quem comprou mais recentemente primeiro; quem nunca comprou vai pro fim
    return [...lista].sort((a, b) => (resumoPor.get(b.id)?.ultima ?? "").localeCompare(resumoPor.get(a.id)?.ultima ?? ""));
  }, [clientes, busca, resumoPor]);

  if (!supabaseConfigured) return <SetupCard />;

  const totalCompradores = clientes.filter((c) => resumoPor.has(c.id)).length;
  const recorrentes = clientes.filter((c) => (resumoPor.get(c.id)?.compras ?? 0) >= 2).length;

  return (
    <div className="page-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
            Clientes
          </h1>
          <p className="text-sm text-[var(--ink)]/65">
            {clientes.length} cadastrados · {totalCompradores} compraram · {recorrentes} voltaram
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2">
            <MagnifyingGlass size={16} className="text-[var(--ink)]/40" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="nome, WhatsApp, cidade, filho"
              className="w-48 bg-transparent text-sm outline-none"
            />
          </label>
          <button onClick={() => setNovo((v) => !v)} className={`flex items-center gap-1.5 ${btnPrimario}`}>
            {novo ? <X size={16} weight="bold" /> : <Plus size={16} weight="bold" />}
            {novo ? "fechar" : "cliente"}
          </button>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      {novo && (
        <div className="mt-4">
          <FormCliente
            onCancelar={() => setNovo(false)}
            onSalvo={() => {
              setNovo(false);
              carregar();
            }}
          />
        </div>
      )}

      {loading && (
        <div className="cascata mt-5 grid gap-3 sm:grid-cols-2">
          <SkeletonCards n={4} />
        </div>
      )}
      {!loading && clientes.length === 0 && (
        <div className="mt-6">
          <Vazio
            emoji="💜"
            titulo="Nenhum cliente ainda"
            texto="Cada venda registrada com nome cria o cliente sozinha. Ou cadastre agora quem compra pelo WhatsApp."
            acao={<button onClick={() => setNovo(true)} className={btnPrimario}>+ primeiro cliente</button>}
          />
        </div>
      )}

      <div className="cascata mt-5 grid gap-3 sm:grid-cols-2">
        {visiveis.map((c) => {
          const r = resumoPor.get(c.id);
          const wa = linkWhatsapp(c.whatsapp);
          return aberto === c.id ? (
            <div key={c.id} className="sm:col-span-2">
              <FormCliente
                cliente={c}
                onCancelar={() => setAberto(null)}
                onSalvo={() => {
                  setAberto(null);
                  carregar();
                }}
              />
            </div>
          ) : (
            <div key={c.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button onClick={() => setAberto(c.id)} className="text-left font-[family-name:var(--font-baloo)] text-lg font-bold text-[var(--purple-dark)] hover:underline">
                    {c.nome}
                  </button>
                  <div className="text-xs text-[var(--ink)]/55">
                    {[c.cidade, c.origem].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="chamar no WhatsApp"
                    className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  >
                    <WhatsappLogo size={20} weight="fill" />
                  </a>
                )}
              </div>

              {c.ibk_criancas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {c.ibk_criancas.map((k) => {
                    const sug = tamanhoSugerido(k.nascimento);
                    const cresceu = sug && k.tamanho_atual && sug !== k.tamanho_atual;
                    return (
                      <li key={k.id} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cresceu ? "bg-[var(--sun)]/40 text-[var(--ink)]" : "bg-[var(--purple)]/6 text-[var(--ink)]/80"}`}>
                        <Baby size={14} weight="duotone" className="text-[var(--purple)]" />
                        {k.nome || (k.genero === "menina" ? "menina" : k.genero === "menino" ? "menino" : "criança")}
                        {k.nascimento && <span className="text-[var(--ink)]/50">{idadeTexto(k.nascimento)}</span>}
                        {k.tamanho_atual && <span>tam {k.tamanho_atual}</span>}
                        {cresceu && <span className="font-extrabold">→ {sug}?</span>}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-[var(--purple)]/8 pt-2 text-xs text-[var(--ink)]/55">
                {r ? (
                  <span>
                    <span className="num font-bold text-[var(--purple-dark)]">{r.compras}</span> {r.compras === 1 ? "compra" : "compras"} ·{" "}
                    <span className="num">{brl(r.total)}</span> · última {dataBr(r.ultima)}
                  </span>
                ) : (
                  <span>ainda não comprou</span>
                )}
                <Link href={`/admin/vendas?cliente=${c.id}`} className="font-bold text-[var(--purple)] hover:underline">
                  vendas
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* cadastro e edicao, com os filhos dentro */
function FormCliente({ cliente, onCancelar, onSalvo }: { cliente?: Cliente; onCancelar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(cliente?.whatsapp ?? "");
  const [cidade, setCidade] = useState(cliente?.cidade ?? "");
  const [origem, setOrigem] = useState(cliente?.origem ?? "");
  const [obs, setObs] = useState(cliente?.obs ?? "");
  const [criancas, setCriancas] = useState<Partial<Crianca>[]>(cliente?.ibk_criancas ?? []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  const setK = (i: number, patch: Partial<Crianca>) => setCriancas((arr) => arr.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));

  const salvar = async () => {
    if (!supabase) return;
    if (!nome.trim()) return setErro("informe o nome");
    setErro("");
    setSalvando(true);
    const dados = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim() || null,
      cidade: cidade.trim() || null,
      origem: origem || null,
      obs: obs.trim() || null,
    };
    let id = cliente?.id;
    if (id) {
      const { error } = await supabase.from("ibk_clientes").update(dados).eq("id", id);
      if (error) { setErro(error.message); setSalvando(false); return; }
    } else {
      const { data, error } = await supabase.from("ibk_clientes").insert(dados).select("id").single();
      if (error || !data) { setErro(error?.message ?? "erro"); setSalvando(false); return; }
      id = data.id;
    }
    // filhos: os que sumiram da lista saem; os outros entram ou atualizam
    const ids = criancas.filter((k) => k.id).map((k) => k.id as string);
    const q = supabase.from("ibk_criancas").delete().eq("cliente_id", id);
    if (ids.length) await q.not("id", "in", `(${ids.join(",")})`);
    else await q;
    const validas = criancas.filter((k) => k.nome || k.nascimento || k.tamanho_atual);
    if (validas.length) {
      const { error } = await supabase.from("ibk_criancas").upsert(
        validas.map((k) => ({
          ...(k.id ? { id: k.id } : {}),
          cliente_id: id,
          nome: k.nome?.trim() || null,
          nascimento: k.nascimento || null,
          genero: k.genero || null,
          tamanho_atual: k.tamanho_atual?.trim() || null,
        })),
      );
      if (error) { setErro(error.message); setSalvando(false); return; }
    }
    setSalvando(false);
    onSalvo();
  };

  const remover = async () => {
    if (!supabase || !cliente) return;
    const { error } = await supabase.from("ibk_clientes").delete().eq("id", cliente.id);
    if (error) setErro(error.message);
    else onSalvo();
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria" className={`${inp} w-48`} autoFocus />
        </Campo>
        <Campo label="WhatsApp">
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="11 9 9999-9999" inputMode="tel" className={`${inp} w-40`} />
        </Campo>
        <Campo label="Cidade">
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo" className={`${inp} w-36`} />
        </Campo>
        <Campo label="Veio de">
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={inp}>
            <option value="">não sei</option>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Obs">
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" className={`${inp} w-44`} />
        </Campo>
      </div>

      {/* filhos */}
      <div className="mt-4 border-t border-[var(--purple)]/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">Filhos</span>
          <button onClick={() => setCriancas((a) => [...a, {}])} className="text-xs font-bold text-[var(--purple)] hover:underline">
            + criança
          </button>
        </div>
        {criancas.length === 0 && (
          <p className="mt-1 text-xs text-[var(--ink)]/45">cadastre a idade e o tamanho: é o que avisa quando a criança cresceu.</p>
        )}
        <div className="mt-2 flex flex-col gap-2">
          {criancas.map((k, i) => {
            const sug = tamanhoSugerido(k.nascimento ?? null);
            return (
              <div key={k.id ?? i} className="flex flex-wrap items-end gap-2 rounded-xl bg-[var(--cream)] p-2">
                <Campo label="Nome">
                  <input value={k.nome ?? ""} onChange={(e) => setK(i, { nome: e.target.value })} placeholder="Theo" className={`${inp} w-32`} />
                </Campo>
                <Campo label="Nascimento">
                  <input type="date" value={k.nascimento ?? ""} onChange={(e) => setK(i, { nascimento: e.target.value })} className={inp} />
                </Campo>
                <Campo label="É">
                  <select value={k.genero ?? ""} onChange={(e) => setK(i, { genero: e.target.value })} className={inp}>
                    <option value="">...</option>
                    <option value="menina">menina</option>
                    <option value="menino">menino</option>
                  </select>
                </Campo>
                <Campo label="Tamanho atual">
                  <input value={k.tamanho_atual ?? ""} onChange={(e) => setK(i, { tamanho_atual: e.target.value })} placeholder={sug || "4"} className={`${inp} w-20`} />
                </Campo>
                {sug && (
                  <span className="pb-2 text-xs text-[var(--ink)]/55">
                    {idadeTexto(k.nascimento ?? null)} · sugerido <strong>{sug}</strong>
                  </span>
                )}
                <button onClick={() => setCriancas((a) => a.filter((_, idx) => idx !== i))} aria-label="tirar criança" className="mb-2 ml-auto text-[var(--ink)]/30 hover:text-red-500">
                  <X size={14} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={salvar} disabled={salvando} className={btnPrimario}>
          {salvando ? "salvando..." : "salvar"}
        </button>
        <button onClick={onCancelar} className={btnSecundario}>cancelar</button>
        {cliente && (
          <span className="ml-auto flex items-center gap-2 text-xs">
            {confirmando ? (
              <>
                <span className="text-[var(--ink)]/60">as vendas ficam, só sem o cliente. remover?</span>
                <button onClick={remover} className="rounded-lg bg-red-500 px-2.5 py-1 font-extrabold text-white">sim</button>
                <button onClick={() => setConfirmando(false)} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 font-bold text-[var(--purple)]">não</button>
              </>
            ) : (
              <button onClick={() => setConfirmando(true)} className="font-bold text-[var(--ink)]/35 hover:text-red-500">remover cliente</button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

const inp = "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
