/*
  Pecas compartilhadas do painel: cabecalho de pagina, skeleton de carregamento
  e estado vazio. Existem para as telas se parecerem entre si sem copiar classe.
*/

export const btnPrimario =
  "rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60";
export const btnSecundario =
  "rounded-xl bg-[var(--purple)]/8 px-3 py-2 text-sm font-bold text-[var(--purple-dark)] hover:bg-[var(--purple)]/15";

export function PageHeader({
  titulo,
  sub,
  acoes,
}: {
  titulo: string;
  sub?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold tracking-tight text-[var(--purple-dark)]">
          {titulo}
        </h1>
        {sub && <p className="text-sm text-[var(--ink)]/65">{sub}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  );
}

/* linhas fantasmas dentro de uma tabela, no lugar de "carregando..." */
export function SkeletonRows({ cols, linhas = 4 }: { cols: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3">
              <div className="skel h-3.5" style={{ width: `${j === 0 ? 70 : 35 + ((i * 7 + j * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* cartoes fantasmas, para grades de KPI ou listas em cards */
export function SkeletonCards({ n = 4, alto = false }: { n?: number; alto?: boolean }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={`rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)] ${alto ? "h-28" : ""}`}>
          <div className="skel h-2.5 w-1/2" />
          <div className="skel mt-3 h-6 w-3/4" />
          <div className="skel mt-2 h-2.5 w-1/3" />
        </div>
      ))}
    </>
  );
}

export function Vazio({
  emoji,
  titulo,
  texto,
  acao,
}: {
  emoji: string;
  titulo: string;
  texto?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[var(--purple)]/20 px-6 py-10 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="mt-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-[var(--ink)]/60">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
