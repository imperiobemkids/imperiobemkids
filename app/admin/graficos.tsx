"use client";

import { useEffect, useRef, useState } from "react";

/*
  Graficos do painel, so SVG e sem lib. Regras que valem para todos:
  - uma serie so por grafico, no roxo da marca (passou no validador de cor:
    contraste 7,9:1 no branco); o que e contexto fica num lilas apagado
  - texto nunca usa a cor da serie: valores e rotulos ficam na tinta
  - grade e eixo em fio de 1px, solido; barra fina com ponta arredondada
  - todo valor que aparece no tooltip tambem aparece sem ele (rotulo ou tabela)
*/
export const COR = {
  serie: "#6d28b8",
  forte: "#4c1d80",
  contexto: "#cbbfdc",
  negativo: "#d03b3b",
  grade: "#efe9f5",
  base: "#d9cfe6",
  tinta: "#3b2b4f",
  lavagem: "rgba(109, 40, 184, 0.07)",
};

/* largura real do container, para o SVG desenhar texto sem esticar */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

/* marcas redondas para o eixo: passo de 1, 2, 2,5 ou 5 vezes potencia de 10 */
export function escalaBonita(max: number, alvo = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const bruto = max / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? mag * 10;
  const n = Math.ceil(max / passo - 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * passo * 100) / 100);
}

/* eixo em reais, curto: "R$ 0", "R$ 250", "R$ 1,5 mil" */
export const brlEixo = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

export type Ponto = {
  chave: string;
  curto: string; // rotulo do eixo
  longo: string; // titulo do tooltip
  valor: number;
  detalhes: { rotulo: string; valor: string }[];
};

/*
  Colunas no tempo. A faixa inteira de cada ponto e alvo de ponteiro e de
  teclado (Tab), entao ninguem precisa mirar numa barra de 6px. So o pico
  ganha rotulo fixo; o resto fica no eixo, no tooltip e na tabela.
*/
export function GraficoColunas({
  pontos,
  formatar,
  rotuloAria,
}: {
  pontos: Ponto[];
  formatar: (v: number) => string;
  rotuloAria: string;
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  const topo = 22, alturaPlot = 170, faixaEixo = 26, esq = 64, dir = 12;
  const altura = topo + alturaPlot + faixaEixo;
  const w = Math.max(largura, 260);
  const plotW = w - esq - dir;
  const max = Math.max(0, ...pontos.map((p) => p.valor));
  const ticks = escalaBonita(max);
  const teto = ticks[ticks.length - 1] || 1;
  const banda = plotW / Math.max(1, pontos.length);
  const barra = Math.max(3, Math.min(24, banda * 0.6));
  const y = (v: number) => topo + alturaPlot - (v / teto) * alturaPlot;
  const xc = (i: number) => esq + banda * i + banda / 2;
  const pico = pontos.reduce((m, p, i) => (p.valor > (pontos[m]?.valor ?? 0) ? i : m), 0);
  // no maximo um rotulo a cada ~60px no eixo X
  const passoX = Math.max(1, Math.ceil(pontos.length / Math.max(2, Math.floor(plotW / 60))));

  const coluna = (i: number, v: number) => {
    const x0 = xc(i) - barra / 2;
    const yt = y(v), yb = y(0);
    const r = Math.min(4, barra / 2, yb - yt);
    // ponta arredondada no topo, quadrada na base
    return `M ${x0} ${yb} V ${yt + r} Q ${x0} ${yt} ${x0 + r} ${yt} H ${x0 + barra - r} Q ${x0 + barra} ${yt} ${x0 + barra} ${yt + r} V ${yb} Z`;
  };

  const p = ativo !== null ? pontos[ativo] : null;

  return (
    <div ref={ref} className="relative" style={{ height: altura }} onPointerLeave={() => setAtivo(null)}>
      {largura > 0 && (
        <svg width={w} height={altura} role="img" aria-label={rotuloAria} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={esq} x2={w - dir} y1={y(t)} y2={y(t)} stroke={t === 0 ? COR.base : COR.grade} strokeWidth={1} />
              <text x={esq - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={COR.tinta} fillOpacity={0.7} className="num">
                {brlEixo(t)}
              </text>
            </g>
          ))}

          {ativo !== null && (
            <rect x={esq + banda * ativo} y={topo} width={banda} height={alturaPlot} fill={COR.lavagem} rx={4} />
          )}

          {pontos.map((pt, i) =>
            pt.valor > 0 ? (
              <path key={pt.chave} d={coluna(i, pt.valor)} fill={ativo === null || ativo === i ? COR.serie : COR.contexto} />
            ) : null,
          )}

          {/* rotulo so no pico, e some quando o tooltip esta aberto */}
          {ativo === null && max > 0 && (
            <text x={xc(pico)} y={y(max) - 7} textAnchor="middle" fontSize={11} fontWeight={800} fill={COR.tinta}>
              {formatar(max)}
            </text>
          )}

          {pontos.map((pt, i) =>
            i % passoX === 0 ? (
              <text key={pt.chave} x={xc(i)} y={topo + alturaPlot + 17} textAnchor="middle" fontSize={10} fill={COR.tinta} fillOpacity={0.7} className="num">
                {pt.curto}
              </text>
            ) : null,
          )}

          {/* alvos: a faixa toda, maior que a barra */}
          {pontos.map((pt, i) => (
            <rect
              key={pt.chave}
              x={esq + banda * i}
              y={topo}
              width={banda}
              height={alturaPlot + faixaEixo}
              fill="transparent"
              tabIndex={0}
              aria-label={`${pt.longo}: ${formatar(pt.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              style={{ outline: "none" }}
            />
          ))}
        </svg>
      )}

      {p && ativo !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-[var(--purple)]/12 bg-white px-3 py-2 text-xs shadow-[0_12px_28px_-14px_rgba(76,29,128,0.45)]"
          style={{ left: Math.min(Math.max(xc(ativo), 80), w - 80) }}
        >
          <div className="font-semibold text-[var(--ink)]/70">{p.longo}</div>
          <div className="mt-0.5 text-base font-extrabold text-[var(--ink)]">{formatar(p.valor)}</div>
          {p.detalhes.map((d) => (
            <div key={d.rotulo} className="mt-0.5 flex justify-between gap-4">
              <span className="text-[var(--ink)]/70">{d.rotulo}</span>
              <span className="num font-bold text-[var(--ink)]">{d.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type Linha = {
  chave: string;
  rotulo: string;
  valor: number; // tamanho da barra (usa o modulo)
  texto: string; // valor escrito, sempre visivel
  sub?: string;
  tom?: "serie" | "contexto" | "forte" | "negativo";
};

/*
  Lista com barra: o rotulo e o valor ficam escritos na linha (a lista ja e a
  tabela), a barra so mostra a proporcao. Categorias sem ordem natural
  (canal, produto) usam a mesma cor: a cor nao repete o que o tamanho diz.
*/
export function BarrasLista({ linhas, max }: { linhas: Linha[]; max?: number }) {
  const m = max ?? Math.max(1, ...linhas.map((l) => Math.abs(l.valor)));
  return (
    <ul className="flex flex-col gap-3.5">
      {linhas.map((l) => {
        const largura = m > 0 ? Math.min(100, (Math.abs(l.valor) / m) * 100) : 0;
        return (
          <li key={l.chave}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-semibold text-[var(--ink)]">{l.rotulo}</span>
              <span className={`num shrink-0 font-extrabold ${l.tom === "negativo" ? "text-red-600" : "text-[var(--ink)]"}`}>
                {l.texto}
              </span>
            </div>
            {l.sub && <div className="text-[11px] text-[var(--ink)]/70">{l.sub}</div>}
            <div className="mt-1.5 h-2 rounded-[3px] bg-[var(--purple)]/[0.06]">
              {largura > 0 && (
                <div
                  className="h-full rounded-r-[4px]"
                  style={{ width: `${Math.max(largura, 1.5)}%`, background: COR[l.tom ?? "serie"] }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
