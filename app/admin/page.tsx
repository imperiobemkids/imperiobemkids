import Link from "next/link";

const CARDS = [
  { href: "/admin/estoque", emoji: "📦", titulo: "Estoque", desc: "SKUs, custo posto, valor em estoque e giro", pronto: true },
  { href: "/admin/fornecedores", emoji: "🏭", titulo: "Fornecedores", desc: "quem fornece, contatos e lotes", pronto: true },
  { href: "/admin/vendas", emoji: "🧾", titulo: "Vendas", desc: "registrar venda, baixa de estoque e lucro", pronto: true },
  { href: "/admin/financeiro", emoji: "💰", titulo: "Financeiro", desc: "caixa, contas a pagar e payback", pronto: true },
  { href: "/admin/simulador", emoji: "🧮", titulo: "Precificação", desc: "preço, kit, taxa e ads com lucro na hora", pronto: true },
];

export default function AdminHome() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">
        Painel do Império
      </h1>
      <p className="mt-1 text-sm text-[var(--ink)]/70">
        Sistema de gestão da loja. Estoque já está no ar; os demais módulos vêm em seguida.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-center gap-4 rounded-2xl border-2 border-transparent bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)] transition-all hover:-translate-y-0.5 hover:border-[var(--purple)]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--purple)]/8 text-2xl">
              {c.emoji}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-baloo)] text-lg font-bold text-[var(--purple-dark)]">
                  {c.titulo}
                </span>
                {!c.pronto && (
                  <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[var(--ink)]">
                    em breve
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--ink)]/65">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
