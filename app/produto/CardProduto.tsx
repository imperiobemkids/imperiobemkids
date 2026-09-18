import Image from "next/image";
import Link from "next/link";
import { brl, fotoDe, fotoOtimizavel, nomeCurto, type ProdutoPublico } from "@/lib/produtosPublicos";

/* card de produto do site: usado na listagem e nos relacionados */
export function CardProduto({ p }: { p: ProdutoPublico }) {
  return (
    <Link href={`/produto/${p.slug}`} className="group block overflow-hidden rounded-3xl border-2 border-transparent bg-white shadow-[0_4px_0_rgba(109,40,184,0.12)] transition-[transform,border-color] hover:-translate-y-1 hover:border-[var(--purple)]">
      <div className="relative aspect-[3/4]">
        <Image src={fotoDe(p)} alt={p.titulo} fill unoptimized={!fotoOtimizavel(fotoDe(p))} className="object-cover" sizes="(max-width: 640px) 50vw, 300px" />
        {!p.em_estoque && (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">esgotado</span>
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 text-sm font-bold leading-snug text-[var(--purple-dark)]">{nomeCurto(p)}</div>
        {p.preco_venda != null && <div className="num mt-1 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple)]">{brl(p.preco_venda)}</div>}
        {p.tamanhos.length > 0 && <div className="mt-0.5 text-[11px] text-[var(--ink)]/70">tam {p.tamanhos.join(" · ")}</div>}
      </div>
    </Link>
  );
}
