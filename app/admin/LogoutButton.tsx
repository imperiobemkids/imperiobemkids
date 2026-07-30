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
        router.replace("/admin/login");
      }}
      className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--ink)]/60 transition-colors hover:bg-[var(--purple)]/8 hover:text-[var(--purple-dark)]"
    >
      Sair
    </button>
  );
}
