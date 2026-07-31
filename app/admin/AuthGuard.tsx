"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/*
  Guarda do /admin: so deixa passar quem esta logado (Supabase Auth).
  Quem nao esta logado vai para o /portal (login publico com cabecalho do site).
  A seguranca real e o RLS no banco; isto e a camada de UX.
*/
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"checando" | "ok" | "fora">("checando");

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setEstado("ok");
      return;
    }
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setEstado(data.session ? "ok" : "fora");
    });
    /*
      So reage a login e logout explicitos. Eventos intermediarios (token
      renovando depois do app voltar do segundo plano no celular) chegavam
      com sessao nula por um instante e jogavam o usuario para o login.
    */
    const { data: sub } = supabase.auth.onAuthStateChange((evento, session) => {
      if (evento === "SIGNED_OUT") setEstado("fora");
      else if (session) setEstado("ok");
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (estado === "fora") router.replace("/portal");
  }, [estado, router]);

  if (estado === "checando")
    return <div className="p-10 text-center text-[var(--ink)]/50">verificando acesso...</div>;

  if (estado === "fora")
    return <div className="p-10 text-center text-[var(--ink)]/50">redirecionando...</div>;

  return <>{children}</>;
}
