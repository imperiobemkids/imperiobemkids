import { createClient } from "@supabase/supabase-js";

/*
  Cliente Supabase do Imperio Bem Kids.
  Aponta para o projeto DEDICADO do Imperio.
  Enquanto as variaveis nao existem, supabase fica null e as telas
  mostram o passo a passo de configuracao em vez de quebrar.
*/
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url as string, key as string, {
      auth: {
        // mantem o login salvo entre visitas e renova o token sozinho,
        // para o app nao pedir senha toda vez que abre no celular
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "ibk-auth",
      },
    })
  : null;

/*
  O Supabase devolve no maximo 1000 linhas por consulta, sem avisar. Soma de
  caixa, faturamento e lucro precisa de TODAS as linhas, entao pagina de 1000
  em 1000. A consulta precisa de uma ordem estavel (termine com .order("id")).
*/
// sem tipos gerados do banco, o formato da linha vem de quem chama (T)
type Pagina = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

export async function buscarTodos<T>(
  consulta: (de: number, ate: number) => Pagina,
  tamanho = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await consulta(de, de + tamanho - 1);
    if (error) return { data: linhas, error: error.message };
    linhas.push(...((data ?? []) as T[]));
    if (!data || data.length < tamanho) return { data: linhas, error: null };
  }
}
