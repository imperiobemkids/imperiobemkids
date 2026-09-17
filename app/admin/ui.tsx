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
        <div key={i} className={`card p-4 ${alto ? "h-28" : ""}`}>
          <div className="skel h-2.5 w-1/2" />
          <div className="skel mt-3 h-6 w-3/4" />
          <div className="skel mt-2 h-2.5 w-1/3" />
        </div>
      ))}
    </>
  );
}

/*
  Sparkline: linha suave dos ultimos dias dentro do KPI. Desenha na entrada
  (classe .traco) e tem area em gradiente embaixo. So SVG, sem lib.
*/
export function Sparkline({ valores, cor = "var(--purple)" }: { valores: number[]; cor?: string }) {
  if (valores.length < 2) return null;
  const w = 120, h = 32, pad = 2;
  const max = Math.max(...valores, 1), min = Math.min(...valores, 0);
  const x = (i: number) => pad + (i / (valores.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  // curva por pontos de controle a meio caminho: suave sem parecer elastica
  let d = `M ${x(0)} ${y(valores[0])}`;
  for (let i = 1; i < valores.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C ${cx} ${y(valores[i - 1])}, ${cx} ${y(valores[i])}, ${x(i)} ${y(valores[i])}`;
  }
  const area = `${d} L ${x(valores.length - 1)} ${h} L ${x(0)} ${h} Z`;
  const id = `sp-${Math.round(max)}-${valores.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={cor} stopOpacity="0.22" />
          <stop offset="1" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={cor} strokeWidth="1.8" strokeLinecap="round" className="traco" />
    </svg>
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
    <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-dashed border-[var(--purple)]/20 px-6 py-10 text-center">
      {/* marca d'agua: a ursinha bem apagada no canto, assinando o vazio */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-8 w-40 opacity-[0.06] grayscale"
      />
      <span className="text-4xl">{emoji}</span>
      <p className="mt-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">{titulo}</p>
      {texto && <p className="mt-1 max-w-xs text-sm text-[var(--ink)]/60">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
