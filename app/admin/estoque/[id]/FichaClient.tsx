"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { ajusteEstoque } from "@/lib/estoque";
import { SetupCard } from "../../SetupCard";
import { KardexModal } from "../KardexModal";

type Produto = Record<string, unknown> & {
  id: string;
  nome: string | null;
  sku: string | null;
  categoria: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
  qtd_atual: number;
  qtd_inicial: number;
  fornecedor_id: string | null;
  estoque_minimo: number | null;
  ativo: boolean;
};

type Fornecedor = { id: string; nome: string };

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const ABAS = ["geral", "anuncio", "especificacoes", "logistica", "fiscal"] as const;
type Aba = (typeof ABAS)[number];
const rotuloAba: Record<Aba, string> = {
  geral: "Geral",
  anuncio: "Anúncio",
  especificacoes: "Especificações",
  logistica: "Logística",
  fiscal: "Fiscal",
};

// campos que sao numericos no banco
const NUMERICOS = [
  "custo_unit", "qtd_atual", "qtd_inicial", "estoque_minimo", "pecas_por_kit",
  "peso_bruto", "peso_liquido", "comprimento_cm", "largura_cm", "altura_cm", "preco_venda",
];

const nomeExibido = (p: Produto) => {
  if (p.nome && String(p.nome).trim()) return String(p.nome).trim();
  const linha = p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "";
  return [linha, p.genero, p.tamanho].filter(Boolean).join(" · ") || "Produto";
};

export function FichaClient({ id }: { id: string }) {
  const router = useRouter();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [aba, setAba] = useState<Aba>("geral");
  const [verKardex, setVerKardex] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [{ data, error }, { data: forns }] = await Promise.all([
      supabase.from("ibk_produtos").select("*").eq("id", id).single(),
      supabase.from("ibk_fornecedores").select("id, nome").order("nome"),
    ]);
    if (error) setErro(error.message);
    else if (data) {
      const p = data as Produto;
      setProduto(p);
      const inicial: Record<string, string> = {};
      Object.entries(p).forEach(([k, v]) => {
        inicial[k] = v === null || v === undefined ? "" : String(v);
      });
      setForm(inicial);
    }
    setFornecedores((forns as Fornecedor[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (supabaseConfigured) carregar();
    else setLoading(false);
  }, [carregar]);

  if (!supabaseConfigured) return <SetupCard />;
  if (loading) return <p className="p-8 text-center text-[var(--ink)]/50">carregando ficha...</p>;
  if (!produto) return <p className="p-8 text-center text-[var(--ink)]/50">produto não encontrado.</p>;

  const set = (campo: string, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setOk(false);
  };

  const salvar = async () => {
    if (!supabase) return;
    setErro(""); setSalvando(true);

    // monta o payload convertendo os numericos e ignorando campos de controle
    const ignorar = ["id", "created_at", "qtd_atual", "custo_posto", "valor_estoque", "sell_through"];
    const payload: Record<string, unknown> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (ignorar.includes(k)) return;
      if (NUMERICOS.includes(k)) payload[k] = v === "" ? null : parseFloat(v.replace(",", ".")) || 0;
      else payload[k] = v === "" ? null : v;
    });

    const { error } = await supabase.from("ibk_produtos").update(payload).eq("id", id);
    if (error) { setErro(error.message); setSalvando(false); return; }

    // quantidade passa pelo motor de estoque para registrar no kardex
    const novaQtd = parseInt(form.qtd_atual, 10);
    if (!Number.isNaN(novaQtd) && novaQtd !== produto.qtd_atual) {
      try { await ajusteEstoque(id, novaQtd, "correção pela ficha do produto"); } catch { /* ja salvou o resto */ }
    }

    setSalvando(false); setOk(true);
    carregar();
  };

  const arquivar = async () => {
    if (!supabase) return;
    if (!confirm("Arquivar este produto? Ele sai da lista de estoque.")) return;
    await supabase.from("ibk_produtos").update({ ativo: false }).eq("id", id);
    router.push("/admin/estoque");
  };

  const custo = parseFloat(form.custo_unit?.replace(",", ".")) || 0;
  const precoVenda = parseFloat(form.preco_venda?.replace(",", ".")) || 0;
  const margem = precoVenda > 0 ? ((precoVenda * 0.8 - custo - 0.4) / precoVenda) * 100 : null;
  const cubagem =
    (parseFloat(form.comprimento_cm) || 0) *
    (parseFloat(form.largura_cm) || 0) *
    (parseFloat(form.altura_cm) || 0);

  return (
    <div>
      {/* cabecalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/estoque" className="text-sm font-bold text-[var(--purple)] hover:underline">
            ← voltar para o estoque
          </Link>
          <h1 className="mt-1 font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
            {nomeExibido(produto)}
          </h1>
          <p className="text-sm text-[var(--ink)]/60">
            {form.sku ? `SKU ${form.sku} · ` : ""}
            {produto.qtd_atual} em estoque · custo {brl(produto.custo_unit)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setVerKardex(true)} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
            extrato
          </button>
          <button onClick={salvar} disabled={salvando} className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
            {salvando ? "salvando..." : "salvar"}
          </button>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}
      {ok && <p className="mt-3 text-sm font-semibold text-emerald-600">ficha salva ✓</p>}

      {/* abas */}
      <div className="mt-5 flex gap-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              aba === a ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/8 text-[var(--purple)]"
            }`}
          >
            {rotuloAba[a]}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
        {aba === "geral" && (
          <Grade>
            <Campo label="Nome do produto" larga><input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} className={inp} /></Campo>
            <Campo label="SKU (código interno)"><input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} placeholder="ex: VER-MEN-02" className={inp} /></Campo>
            <Campo label="Categoria"><input value={form.categoria ?? ""} onChange={(e) => set("categoria", e.target.value)} placeholder="ex: Conjunto" className={inp} /></Campo>
            <Campo label="Linha">
              <select value={form.linha ?? ""} onChange={(e) => set("linha", e.target.value)} className={inp}>
                <option value="">nenhuma</option><option value="verao">Verão</option><option value="inverno">Inverno</option>
              </select>
            </Campo>
            <Campo label="Gênero">
              <select value={form.genero ?? ""} onChange={(e) => set("genero", e.target.value)} className={inp}>
                <option value="">nenhum</option><option value="menino">Menino</option><option value="menina">Menina</option><option value="unissex">Unissex</option>
              </select>
            </Campo>
            <Campo label="Tamanho"><input value={form.tamanho ?? ""} onChange={(e) => set("tamanho", e.target.value)} className={inp} /></Campo>
            <Campo label="Fornecedor">
              <select value={form.fornecedor_id ?? ""} onChange={(e) => set("fornecedor_id", e.target.value)} className={inp}>
                <option value="">sem fornecedor</option>
                {fornecedores.map((f) => (<option key={f.id} value={f.id}>{f.nome}</option>))}
              </select>
            </Campo>
            <Campo label="Custo por unidade"><input value={form.custo_unit ?? ""} onChange={(e) => set("custo_unit", e.target.value)} className={inp} /></Campo>
            <Campo label="Preço de venda"><input value={form.preco_venda ?? ""} onChange={(e) => set("preco_venda", e.target.value)} placeholder="49,90" className={inp} /></Campo>
            <Campo label="Quantidade atual"><input value={form.qtd_atual ?? ""} onChange={(e) => set("qtd_atual", e.target.value)} className={inp} /></Campo>
            <Campo label="Alertar quando sobrar"><input value={form.estoque_minimo ?? ""} onChange={(e) => set("estoque_minimo", e.target.value)} className={inp} /></Campo>
            {margem !== null && (
              <div className="col-span-2 rounded-xl bg-[var(--purple)]/6 p-3 text-sm">
                Ao preço de {brl(precoVenda)}, com taxa de 20% e embalagem, a margem fica em{" "}
                <strong className={margem >= 0 ? "text-emerald-600" : "text-red-500"}>{margem.toFixed(1)}%</strong>.
              </div>
            )}
          </Grade>
        )}

        {aba === "anuncio" && (
          <Grade>
            <Campo label="Título do anúncio" larga dica="o que aparece na busca do marketplace; use as palavras que a cliente digita">
              <input value={form.titulo_anuncio ?? ""} onChange={(e) => set("titulo_anuncio", e.target.value)} placeholder="Kit 4 Peças Conjunto Infantil Verão Menino" className={inp} maxLength={120} />
            </Campo>
            <Campo label="Descrição" larga dica="detalhe tecido, tamanhos, o que vem no kit e como lavar">
              <textarea value={form.descricao_longa ?? ""} onChange={(e) => set("descricao_longa", e.target.value)} rows={7} className={inp} />
            </Campo>
            <Campo label="Palavras-chave" larga dica="separadas por vírgula, ajudam na busca interna do marketplace">
              <input value={form.palavras_chave ?? ""} onChange={(e) => set("palavras_chave", e.target.value)} placeholder="conjunto infantil, roupa menino, kit verão" className={inp} />
            </Campo>
          </Grade>
        )}

        {aba === "especificacoes" && (
          <Grade>
            <Campo label="Marca"><input value={form.marca ?? ""} onChange={(e) => set("marca", e.target.value)} className={inp} /></Campo>
            <Campo label="Modelo"><input value={form.modelo ?? ""} onChange={(e) => set("modelo", e.target.value)} className={inp} /></Campo>
            <Campo label="Cor"><input value={form.cor ?? ""} onChange={(e) => set("cor", e.target.value)} placeholder="sortido" className={inp} /></Campo>
            <Campo label="Material"><input value={form.material ?? ""} onChange={(e) => set("material", e.target.value)} placeholder="algodão" className={inp} /></Campo>
            <Campo label="Composição" larga dica="como vem na etiqueta"><input value={form.composicao ?? ""} onChange={(e) => set("composicao", e.target.value)} placeholder="100% algodão" className={inp} /></Campo>
            <Campo label="Faixa etária"><input value={form.faixa_etaria ?? ""} onChange={(e) => set("faixa_etaria", e.target.value)} placeholder="2 a 8 anos" className={inp} /></Campo>
            <Campo label="Peças por kit"><input value={form.pecas_por_kit ?? ""} onChange={(e) => set("pecas_por_kit", e.target.value)} placeholder="4" className={inp} /></Campo>
          </Grade>
        )}

        {aba === "logistica" && (
          <>
            <Grade>
              <Campo label="Peso bruto (kg)" dica="com a embalagem, é o que a transportadora cobra"><input value={form.peso_bruto ?? ""} onChange={(e) => set("peso_bruto", e.target.value)} placeholder="0,450" className={inp} /></Campo>
              <Campo label="Peso líquido (kg)"><input value={form.peso_liquido ?? ""} onChange={(e) => set("peso_liquido", e.target.value)} className={inp} /></Campo>
              <Campo label="Comprimento (cm)"><input value={form.comprimento_cm ?? ""} onChange={(e) => set("comprimento_cm", e.target.value)} className={inp} /></Campo>
              <Campo label="Largura (cm)"><input value={form.largura_cm ?? ""} onChange={(e) => set("largura_cm", e.target.value)} className={inp} /></Campo>
              <Campo label="Altura (cm)"><input value={form.altura_cm ?? ""} onChange={(e) => set("altura_cm", e.target.value)} className={inp} /></Campo>
              <Campo label="Código de barras (GTIN/EAN)"><input value={form.gtin ?? ""} onChange={(e) => set("gtin", e.target.value)} className={inp} /></Campo>
            </Grade>
            {cubagem > 0 && (
              <div className="mt-3 rounded-xl bg-[var(--purple)]/6 p-3 text-sm text-[var(--ink)]/80">
                Cubagem do pacote: <strong>{cubagem.toLocaleString("pt-BR")} cm³</strong>. Transportadora costuma
                cobrar pelo maior valor entre peso real e peso cubado, então pacote grande e leve encarece o frete.
              </div>
            )}
          </>
        )}

        {aba === "fiscal" && (
          <>
            <Grade>
              <Campo label="NCM" dica="8 dígitos, define o imposto do produto"><input value={form.ncm ?? ""} onChange={(e) => set("ncm", e.target.value)} placeholder="6109.10.00" className={inp} /></Campo>
              <Campo label="CEST" dica="só quando o produto tem substituição tributária"><input value={form.cest ?? ""} onChange={(e) => set("cest", e.target.value)} className={inp} /></Campo>
              <Campo label="CFOP" dica="operação de venda; varia se é dentro ou fora do estado"><input value={form.cfop ?? ""} onChange={(e) => set("cfop", e.target.value)} placeholder="5102" className={inp} /></Campo>
              <Campo label="Origem">
                <select value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)} className={inp}>
                  <option value="">selecione</option>
                  <option value="0">0 - Nacional</option>
                  <option value="1">1 - Estrangeira, importação direta</option>
                  <option value="2">2 - Estrangeira, mercado interno</option>
                </select>
              </Campo>
              <Campo label="CST / CSOSN" dica="CSOSN se for Simples Nacional"><input value={form.cst_csosn ?? ""} onChange={(e) => set("cst_csosn", e.target.value)} placeholder="102" className={inp} /></Campo>
              <Campo label="Unidade"><input value={form.unidade ?? ""} onChange={(e) => set("unidade", e.target.value)} placeholder="UN" className={inp} /></Campo>
            </Grade>
            <p className="mt-3 rounded-xl bg-[var(--sun)]/20 p-3 text-xs leading-relaxed text-[var(--ink)]/75">
              Estes códigos definem o imposto que você paga e o que sai na nota. Confirme com seu contador antes de
              emitir: NCM errado gera imposto errado e pode dar problema na fiscalização.
            </p>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={salvar} disabled={salvando} className="rounded-xl bg-[var(--purple)] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
          {salvando ? "salvando..." : "salvar ficha"}
        </button>
        <button onClick={arquivar} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-bold text-red-400 hover:text-red-600">
          arquivar produto
        </button>
      </div>

      {verKardex && (
        <KardexModal produtoId={id} titulo={nomeExibido(produto)} onClose={() => setVerKardex(false)} />
      )}
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";

function Grade({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Campo({
  label, children, larga, dica,
}: { label: string; children: React.ReactNode; larga?: boolean; dica?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${larga ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
      {dica && <span className="text-[11px] leading-snug text-[var(--ink)]/40">{dica}</span>}
    </label>
  );
}
