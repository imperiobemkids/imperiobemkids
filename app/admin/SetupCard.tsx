/*
  Cartao mostrado quando o Supabase dedicado do Imperio ainda nao foi
  configurado (sem NEXT_PUBLIC_SUPABASE_URL / ANON_KEY no .env.local).
*/
export function SetupCard() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--purple)]/30 bg-white p-6">
      <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
        Falta conectar o banco do Império
      </h2>
      <p className="mt-2 text-sm text-[var(--ink)]/75">
        O sistema está pronto, mas ainda não há um Supabase dedicado do Império
        conectado. Faça isso quando puder:
      </p>
      <ol className="mt-4 space-y-2 text-sm text-[var(--ink)]/80">
        <li>
          <strong>1.</strong> Crie um projeto Supabase na conta do Império
          (região sa-east-1, free tier).
        </li>
        <li>
          <strong>2.</strong> Copie <code className="rounded bg-[var(--purple)]/8 px-1">.env.local.example</code> para{" "}
          <code className="rounded bg-[var(--purple)]/8 px-1">.env.local</code> e preencha a URL e a anon key
          (Settings {">"} API).
        </li>
        <li>
          <strong>3.</strong> Rode as SQLs de{" "}
          <code className="rounded bg-[var(--purple)]/8 px-1">supabase/migrations/0001_init_gestao.sql</code> e{" "}
          <code className="rounded bg-[var(--purple)]/8 px-1">supabase/seed_lote1.sql</code> no editor SQL do Supabase.
        </li>
        <li>
          <strong>4.</strong> Reinicie o <code className="rounded bg-[var(--purple)]/8 px-1">npm run dev</code> e recarregue esta página.
        </li>
      </ol>
    </div>
  );
}
