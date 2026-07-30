"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (!supabase) return;
    setErro("");
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) {
      setErro("e-mail ou senha inválidos");
      return;
    }
    router.replace("/admin");
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_4px_0_rgba(109,40,184,0.12)]">
        <div className="mb-4 flex flex-col items-center">
          <Image src="/logo.png" alt="Império Bem Kids" width={90} height={90} />
          <h1 className="mt-2 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
            Portal do Cliente
          </h1>
          <p className="text-xs text-[var(--ink)]/55">entre com seu acesso</p>
        </div>

        {!supabaseConfigured ? (
          <p className="text-center text-sm text-[var(--ink)]/60">
            Banco não configurado. Preencha o .env.local primeiro.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="e-mail"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              placeholder="senha"
              className={inputCls}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
            />
            {erro && <span className="text-sm font-semibold text-red-500">{erro}</span>}
            <button
              onClick={entrar}
              disabled={entrando}
              className="rounded-xl bg-[var(--purple)] py-3 text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)] disabled:opacity-60"
            >
              {entrando ? "entrando..." : "entrar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--purple)]/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--purple)]";
