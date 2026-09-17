"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Aviso de cookies: aparece uma vez, some ao aceitar, e nao volta enquanto o
  navegador guardar a escolha. Nao trava o Pixel: e aviso com link para a
  politica, que e o minimo que a LGPD pede para cookie de medicao. Fica fora
  do /admin e do /portal, que sao area interna.
*/
const CHAVE = "ibk-cookies-ok";

export function AvisoCookies() {
  const pathname = usePathname();
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    try {
      setMostrar(!localStorage.getItem(CHAVE));
    } catch {
      setMostrar(false);
    }
  }, []);

  if (!mostrar || pathname.startsWith("/admin") || pathname.startsWith("/portal")) return null;

  const aceitar = () => {
    try {
      localStorage.setItem(CHAVE, "1");
    } catch {}
    setMostrar(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="page-in fixed inset-x-3 bottom-3 z-[90] mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-2xl border border-[var(--purple)]/10 bg-white p-3.5 text-sm text-[var(--ink)]/80 shadow-[0_4px_0_rgba(109,40,184,0.1),0_16px_32px_-16px_rgba(76,29,128,0.3)] sm:inset-x-auto sm:left-4"
    >
      <span className="text-xl">🍪</span>
      <p className="min-w-0 flex-1 leading-snug">
        Usamos cookies do Pixel da Meta pra medir o site.{" "}
        <Link href="/privacidade" className="font-bold text-[var(--purple)] underline">
          Saiba mais
        </Link>
      </p>
      <button
        onClick={aceitar}
        className="rounded-xl bg-[var(--purple)] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[var(--purple-dark)]"
      >
        entendi
      </button>
    </div>
  );
}
