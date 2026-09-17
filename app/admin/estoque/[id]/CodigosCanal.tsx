"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

/*
  Codigos do produto em cada canal (tabela ibk_produto_canais). Escolhe o
  canal em cima; embaixo, uma linha para o produto e uma para cada variacao.
  O id do anuncio e o mesmo para todas (e o anuncio da plataforma); o que
  muda por variacao e o id_variacao e o SKU. Salva tudo de uma vez.
*/
type Canal = { id: string; nome: string };
type Linha = { id: string; rotulo: string; principal?: boolean };
type Codigo = { id_anuncio: string; id_variacao: string; sku_canal: string; url: string };

const vazio: Codigo = { id_anuncio: "", id_variacao: "", sku_canal: "", url: "" };

export function CodigosCanal({ linhas, canais }: { linhas: Linha[]; canais: Canal[] }) {
  const [canalId, setCanalId] = useState(canais[0]?.id ?? "");
  const [dados, setDados] = useState<Record<string, Codigo>>({}); // por produto_id, no canal escolhido
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  // chave estavel: a ficha re-renderiza a cada tecla e `linhas` e um array novo;
  // sem isso o efeito recarregaria e apagaria o que estava sendo digitado
  const ids = linhas.map((l) => l.id).join(",");

  const carregar = useCallback(async () => {
    if (!supabase || !canalId) return;
    const { data } = await supabase
      .from("ibk_produto_canais")
      .select("produto_id, id_anuncio, id_variacao, sku_canal, url")
      .eq("canal_id", canalId)
      .in("produto_id", ids.split(","));
    const m: Record<string, Codigo> = {};
    for (const r of data ?? []) {
      m[r.produto_id] = {
        id_anuncio: r.id_anuncio ?? "",
        id_variacao: r.id_variacao ?? "",
        sku_canal: r.sku_canal ?? "",
        url: r.url ?? "",
      };
    }
    setDados(m);
  }, [canalId, ids]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!canalId && canais[0]) setCanalId(canais[0].id);
  }, [canais, canalId]);

  const get = (id: string) => dados[id] ?? vazio;
  const set = (id: string, patch: Partial<Codigo>) =>
    setDados((d) => ({ ...d, [id]: { ...(d[id] ?? vazio), ...patch } }));

  // o id do anuncio e um so: digitou no produto, replica nas variacoes vazias
  const setAnuncioPai = (valor: string) => {
    setDados((d) => {
      const n = { ...d };
      for (const l of linhas) {
        const atual = n[l.id] ?? vazio;
        if (l.principal || !atual.id_anuncio || atual.id_anuncio === (d[linhas[0].id]?.id_anuncio ?? "")) {
          n[l.id] = { ...atual, id_anuncio: valor };
        }
      }
      return n;
    });
  };

  const salvar = async () => {
    if (!supabase || !canalId) return;
    setSalvando(true);
    setMsg("");
    const rows = linhas
      .map((l) => ({ l, c: get(l.id) }))
      .filter(({ c }) => c.id_anuncio || c.id_variacao || c.sku_canal || c.url)
      .map(({ l, c }) => ({
        produto_id: l.id,
        canal_id: canalId,
        id_anuncio: c.id_anuncio.trim() || null,
        id_variacao: c.id_variacao.trim() || null,
        sku_canal: c.sku_canal.trim() || null,
        url: c.url.trim() || null,
        updated_at: new Date().toISOString(),
      }));
    // linhas que ficaram vazias saem
    const vazias = linhas.filter((l) => !rows.some((r) => r.produto_id === l.id)).map((l) => l.id);
    if (vazias.length) {
      await supabase.from("ibk_produto_canais").delete().eq("canal_id", canalId).in("produto_id", vazias);
    }
    const { error } = rows.length
      ? await supabase.from("ibk_produto_canais").upsert(rows, { onConflict: "produto_id,canal_id" })
      : { error: null };
    setSalvando(false);
    setMsg(error ? error.message : "códigos salvos");
    if (!error) setTimeout(() => setMsg(""), 2500);
  };

  const canal = canais.find((c) => c.id === canalId);
  const ehShopee = /shopee/i.test(canal?.nome ?? "");
  const ehTikTok = /tiktok/i.test(canal?.nome ?? "");

  if (canais.length === 0) return null;

  return (
    <div className="mb-6 border-b border-[var(--purple)]/10 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
            Códigos no canal
          </h2>
          <p className="text-xs text-[var(--ink)]/55">
            O id do anúncio e o id de cada variação na plataforma. É o que liga um pedido importado ao produto certo.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {canais.map((c) => (
            <button
              key={c.id}
              onClick={() => setCanalId(c.id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                c.id === canalId ? "bg-[var(--purple)] text-white" : "bg-[var(--purple)]/8 text-[var(--purple)]"
              }`}
            >
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-[var(--purple)]/10 bg-[var(--cream)]/60">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-[var(--ink)]/45">
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">{ehShopee ? "ID do anúncio (item_id)" : ehTikTok ? "ID do produto" : "ID do anúncio"}</th>
              <th className="px-3 py-2 text-left">{ehShopee ? "ID da variação (model_id)" : ehTikTok ? "SKU ID" : "ID da variação"}</th>
              <th className="px-3 py-2 text-left">SKU no anúncio</th>
              <th className="px-3 py-2 text-left">Link</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const c = get(l.id);
              return (
                <tr key={l.id} className="border-t border-[var(--purple)]/8">
                  <td className={`px-3 py-1.5 ${l.principal ? "font-bold text-[var(--purple-dark)]" : "pl-6 text-[var(--ink)]/80"}`}>
                    {l.rotulo}
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={c.id_anuncio}
                      onChange={(e) => (l.principal ? setAnuncioPai(e.target.value) : set(l.id, { id_anuncio: e.target.value }))}
                      placeholder={ehShopee ? "58266950240" : ""}
                      className={`${inp} num w-36`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {l.principal && linhas.length > 1 ? (
                      <span className="text-xs text-[var(--ink)]/35">nas variações</span>
                    ) : (
                      <input value={c.id_variacao} onChange={(e) => set(l.id, { id_variacao: e.target.value })} className={`${inp} num w-36`} />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={c.sku_canal} onChange={(e) => set(l.id, { sku_canal: e.target.value })} placeholder="KV-MEN-4" className={`${inp} w-32`} />
                  </td>
                  <td className="px-3 py-1.5">
                    {l.principal ? (
                      <span className="flex items-center gap-1">
                        <input value={c.url} onChange={(e) => set(l.id, { url: e.target.value })} placeholder="https://" className={`${inp} w-44`} />
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label="abrir anúncio" className="text-[var(--purple)]">
                            <ArrowSquareOut size={16} weight="bold" />
                          </a>
                        )}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60"
        >
          {salvando ? "salvando..." : "salvar códigos"}
        </button>
        {msg && <span className={`text-xs font-semibold ${msg.includes("salvos") ? "text-emerald-600" : "text-red-500"}`}>{msg}</span>}
        {ehShopee && (
          <span className="text-[11px] text-[var(--ink)]/45">
            no link do anúncio, o número depois da loja é o item_id; o model_id aparece na planilha de pedidos
          </span>
        )}
      </div>
    </div>
  );
}

const inp =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2 py-1 text-sm outline-none focus:border-[var(--purple)]";
