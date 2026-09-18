/*
  Numeros e dinheiro, num lugar so. Cada tela tinha a sua copia de num() e
  elas divergiam: uma tirava o ponto (e "14.90" virava 1490), outra nao.
*/

/* texto digitado -> numero. Aceita "49,90", "49.90", "1.234,56" e "1234.56" */
export const num = (s: string | number | null | undefined): number => {
  if (typeof s === "number") return s;
  const t = String(s ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const temVirgula = t.includes(",");
  const temPonto = t.includes(".");
  let limpo = t;
  if (temVirgula && temPonto) limpo = t.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (temVirgula) limpo = t.replace(",", "."); // 49,90
  // so ponto: e decimal ("49.90"), a nao ser que pareca milhar ("1.234")
  else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(t)) limpo = t.replace(/\./g, "");
  return parseFloat(limpo) || 0;
};

/* numero -> texto pra input, com virgula */
export const txt = (v: number | null | undefined): string =>
  v == null ? "" : String(Math.round(v * 100) / 100).replace(".", ",");

export const brl = (v: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(v as number) ? (v as number) : 0);

export const pct = (v: number): string => `${Math.round(v * 1000) / 10}%`;

/* hoje em ISO no fuso local (toISOString e UTC e vira amanha a noite no Brasil) */
export const hojeIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const dataBr = (iso: string): string => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR");
