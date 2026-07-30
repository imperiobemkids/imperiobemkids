"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/*
  Guarda do /admin: so deixa passar quem esta logado (Supabase Auth).
  A pagina de login (/admin/login) e liberada. A seguranca real e o RLS
  no banco; isto aqui e a camada de UX (redireciona pro login).
*/
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<"checando" | "ok" | "fora">("checando");

  const ehLogin = pathname === "/admin/login";

  useEffect(() => {
    // sem banco configurado: nao trava (mostra os SetupCards das paginas)
    if (!supabaseConfigured || !supabase) {
      setEstado("ok");
      return;
    }
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setEstado(data.session ? "ok" : "fora");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEstado(session ? "ok" : "fora");
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (estado === "fora" && !ehLogin) router.replace("/admin/login");
  }, [estado, ehLogin, router]);

  if (ehLogin) return <>{children}</>;

  if (estado === "checando")
    return <div className="p-10 text-center text-[var(--ink)]/50">verificando acesso...</div>;

  if (estado === "fora")
    return <div className="p-10 text-center text-[var(--ink)]/50">redirecionando para o login...</div>;

  return <>{children}</>;
}
