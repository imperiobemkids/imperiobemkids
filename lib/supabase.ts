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
