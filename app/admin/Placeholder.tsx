export function Placeholder({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--purple)]/25 bg-white p-8 text-center">
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
        {titulo}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink)]/70">{desc}</p>
      <span className="mt-4 inline-block rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-extrabold uppercase text-[var(--ink)]">
        em breve
      </span>
    </div>
  );
}
