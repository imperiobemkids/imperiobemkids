"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LogoutButton() {
  const router = useRouter();
  if (!supabase) return null;
  return (
    <button
      onClick={async () => {
        await supabase!.auth.signOut();
        router.replace("/portal");
      }}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--ink)]/60 transition-colors hover:bg-red-50 hover:text-red-500"
    >
      <span className="text-base">🚪</span> Sair
    </button>
  );
}
