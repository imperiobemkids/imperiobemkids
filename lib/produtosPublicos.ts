import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
  Leitura publica dos produtos para o site (view ibk_produtos_publicos,
  migration 0024). Roda no servidor, sem sessao, com a chave anonima: a
  view so mostra produto publicado e so as colunas do anuncio.
*/
export type ProdutoPublico = {
  id: string;
  slug: string;
  nome: string | null;
  titulo: string;
  descricao: string | null;
  preco_venda: number | null;
  foto_url: string | null;
  categoria: string | null;
  linha: string | null;
  genero: string | null;
  marca: string | null;
  material: string | null;
  composicao: string | null;
  faixa_etaria: string | null;
  pecas_por_kit: number | null;
  palavras_chave: string | null;
  tamanhos: string[];
  em_estoque: boolean;
  url_shopee: string | null;
  created_at: string;
};

// um cliente por processo; e o metadata e a pagina pedem o mesmo produto, entao React.cache
let sb: SupabaseClient | null | undefined;
function cliente() {
  if (sb !== undefined) return sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  sb = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return sb;
}

export const listarProdutosPublicos = cache(async (): Promise<ProdutoPublico[]> => {
  const c = cliente();
  if (!c) return [];
  const { data } = await c.from("ibk_produtos_publicos").select("*").order("created_at", { ascending: false });
  return (data as ProdutoPublico[]) ?? [];
});

export const produtoPublicoPorSlug = cache(async (slug: string): Promise<ProdutoPublico | null> => {
  const c = cliente();
  if (!c) return null;
  const { data } = await c.from("ibk_produtos_publicos").select("*").eq("slug", slug).maybeSingle();
  return (data as ProdutoPublico) ?? null;
});

/* next/image so otimiza /public e *.supabase.co; qualquer outra origem passa sem otimizar */
export const fotoOtimizavel = (url: string) => url.startsWith("/") || /^https:\/\/[^/]+\.supabase\.co\//.test(url);

export const brl = (v: number | null | undefined) =>
  v == null ? "" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/* foto: caminho do site ou URL completa; sem foto, placeholder da logo */
export const fotoDe = (p: ProdutoPublico) => p.foto_url || "/logo.png";

/* nome curto para o card e a migalha: "Kit 4 peças verão menina" > titulo de 120 chars */
export const nomeCurto = (p: ProdutoPublico) => (p.nome?.trim() || p.titulo).slice(0, 60);
