/*
  Folha de contagem de estoque (Estoque > Folha de contagem). Gera uma folha A4
  para imprimir e levar ao estoque, e a mesma lista em planilha (CSV que o Excel
  abre). Uma linha por peca que se conta: cada variacao (tamanho, cor) ou o
  produto simples; os insumos (saco, etiqueta) entram num grupo proprio.

  Cada folha impressa fica salva (ibk_contagens) com um codigo e as linhas
  numeradas, para a tela Contagem lancar o que foi contado: digitado ou lido
  da foto da folha.
*/

import { supabase } from "./supabase";
import { hojeIso } from "./formato";

export type LinhaContagem = {
  grupo: string;
  produto: string;
  tamanho: string;
  cor: string;
  sistema: number;
  tipo: "produto" | "insumo";
  id: string;
};

/* linha como fica salva na folha: o numero e o que liga o papel ao sistema */
export type LinhaFolha = LinhaContagem & { n: number };

export type Folha = {
  id: string;
  codigo: string;
  criada_em: string;
  recorte: string;
  mostrar_sistema: boolean;
  linhas: LinhaFolha[];
  contado: Record<string, number>;
  status: "aberta" | "aplicada" | "descartada";
  aplicada_em: string | null;
  ajustes: number | null;
};

// sem 0/O, 1/I/L: o codigo e lido de papel
const LETRAS_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const novoCodigo = () => Array.from({ length: 4 }, () => LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]).join("");

/* guarda a folha antes de imprimir; sem a migration 0035 devolve null e a folha sai sem codigo */
export async function salvarFolha(
  linhas: LinhaContagem[],
  o: { recorte: string; mostrarSistema: boolean },
): Promise<{ id: string; codigo: string; linhas: LinhaFolha[] } | null> {
  if (!supabase) return null;
  const numeradas = linhas.map((l, i) => ({ ...l, n: i + 1 }));
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const codigo = novoCodigo();
    const { data, error } = await supabase
      .from("ibk_contagens")
      .insert({ codigo, recorte: o.recorte, mostrar_sistema: o.mostrarSistema, linhas: numeradas })
      .select("id")
      .single();
    if (!error && data) return { id: data.id, codigo, linhas: numeradas };
    if (!/duplicate|unique/i.test(error?.message ?? "")) return null;
  }
  return null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hoje = () => new Date().toLocaleDateString("pt-BR");

/* tamanho de roupa em ordem de prateleira: numeros em ordem numerica, letras de RN a GG */
const LETRAS = ["RN", "PP", "P", "M", "G", "GG", "XG"];
export function ordemTamanho(a: string, b: string) {
  const na = Number(a.replace(",", ".")), nb = Number(b.replace(",", "."));
  if (a && b && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  const la = LETRAS.indexOf(a.toUpperCase()), lb = LETRAS.indexOf(b.toUpperCase());
  if (la >= 0 && lb >= 0) return la - lb;
  return a.localeCompare(b, "pt-BR", { numeric: true });
}

/* agrupa mantendo a ordem em que os grupos aparecem na lista */
export function porGrupo<L extends { grupo: string }>(linhas: L[]) {
  const mapa = new Map<string, L[]>();
  for (const l of linhas) mapa.set(l.grupo, [...(mapa.get(l.grupo) ?? []), l]);
  return [...mapa.entries()];
}

const CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Nunito", "Segoe UI", Arial, sans-serif; color: #111; font-size: 10.5pt; }
  .topo { display: flex; align-items: center; gap: 4mm; border-bottom: 0.6mm solid #111; padding-bottom: 3mm; }
  .topo img { width: 14mm; height: 14mm; object-fit: contain; }
  .topo h1 { margin: 0; font-size: 16pt; font-weight: 900; }
  .topo .codigo { margin-left: auto; text-align: right; font-size: 8pt; color: #444; text-transform: uppercase; letter-spacing: 0.5pt; }
  .topo .codigo b { display: block; font-size: 18pt; color: #111; letter-spacing: 1pt; }
  td.n, th.n { width: 9mm; text-align: right; color: #444; font-weight: 700; }
  .topo .sub { font-size: 9pt; color: #444; margin-top: 0.5mm; }
  .assina { display: flex; gap: 8mm; margin: 4mm 0 2mm; font-size: 10pt; }
  .assina span { flex: 1; border-bottom: 0.3mm solid #111; padding-bottom: 1mm; }
  .dica { font-size: 9pt; color: #333; margin: 2mm 0 4mm; }
  h2 { font-size: 12pt; font-weight: 900; margin: 5mm 0 1.5mm; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3pt; color: #444; border-bottom: 0.4mm solid #111; padding: 1.5mm 2mm; }
  td { border-bottom: 0.25mm solid #999; padding: 0 2mm; height: 9mm; vertical-align: middle; }
  tr { page-break-inside: avoid; }
  td.num, th.num { text-align: center; width: 18mm; }
  td.caixa { width: 24mm; }
  td.caixa div { height: 6.5mm; border: 0.35mm solid #111; border-radius: 1.2mm; }
  td.obs { width: 40mm; }
  .total { margin-top: 5mm; font-size: 9pt; color: #444; }
`;

export function imprimirContagem(
  linhas: LinhaFolha[],
  o: { mostrarSistema: boolean; logoUrl: string; marca: string; recorte: string; codigo: string | null; janela?: Window },
) {
  const grupos = porGrupo(linhas);
  // coluna de cor so quando alguma peca tem cor: vazia ela so rouba espaco da linha
  const temCor = linhas.some((l) => l.cor);
  const cab = `<tr><th class="n">Nº</th><th>Produto</th><th class="num">Tam.</th>${temCor ? "<th>Cor / tipo</th>" : ""}${
    o.mostrarSistema ? '<th class="num">Sistema</th>' : ""
  }<th>Contado</th><th>Obs.</th></tr>`;
  const corpo = grupos
    .map(
      ([g, ls]) => `
    <h2>${esc(g)} <small style="font-weight:600;color:#666">(${ls.length})</small></h2>
    <table><thead>${cab}</thead><tbody>${ls
      .map(
        (l) =>
          `<tr><td class="n">${l.n}</td><td>${esc(l.produto)}</td><td class="num"><b>${esc(l.tamanho || "-")}</b></td>${temCor ? `<td>${esc(l.cor || "")}</td>` : ""}${
            o.mostrarSistema ? `<td class="num">${l.sistema}</td>` : ""
          }<td class="caixa"><div></div></td><td class="obs"></td></tr>`,
      )
      .join("")}</tbody></table>`,
    )
    .join("");
  const totalSistema = linhas.reduce((s, l) => s + l.sistema, 0);
  const html = `
    <div class="topo">
      <img src="${esc(o.logoUrl)}" alt="">
      <div><h1>Folha de contagem de estoque</h1><div class="sub">${esc(o.marca)} · ${hoje()} · ${esc(o.recorte)}</div></div>
      ${o.codigo ? `<div class="codigo">folha<b>#${esc(o.codigo)}</b></div>` : ""}
    </div>
    <div class="assina"><span>Contado por:</span><span>Conferido por:</span><span>Data:</span></div>
    <p class="dica">${
      o.mostrarSistema
        ? "Conte cada linha e escreva a quantidade em Contado, um número bem legível dentro do quadro. Não achou nenhuma? Escreva 0: quadro vazio fica como não contado."
        : "Contagem às cegas: conte sem olhar o sistema e escreva a quantidade em Contado. Não achou nenhuma? Escreva 0: quadro vazio fica como não contado."
    }${o.codigo ? ` Depois, lance em Estoque > Contagem, folha #${esc(o.codigo)}: digitando ou pela foto destas páginas.` : ""}</p>
    ${corpo}
    <p class="total">${linhas.length} linhas para contar${o.mostrarSistema ? ` · ${totalSistema} unidades no sistema` : ""}.</p>`;

  const w = o.janela ?? window.open("", "_blank", "width=820,height=900");
  if (!w) throw new Error("o navegador bloqueou a janela de impressão");
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contagem de estoque ${hoje()}</title><style>${CSS}</style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  // espera a fonte e o logo
  setTimeout(() => w.print(), 400);
}

/* CSV com ponto e virgula e BOM: e o formato que o Excel em portugues abre direto */
export function baixarPlanilhaContagem(linhas: LinhaFolha[], o: { mostrarSistema: boolean; codigo: string | null }) {
  const cel = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ["Nº", "Grupo", "Produto", "Tamanho", "Cor / tipo", ...(o.mostrarSistema ? ["Sistema"] : []), "Contado", "Diferença", "Obs."];
  const corpo = linhas.map((l) =>
    [l.n, l.grupo, l.produto, l.tamanho, l.cor, ...(o.mostrarSistema ? [l.sistema] : []), "", "", ""].map(cel).join(";"),
  );
  const blob = new Blob(["﻿" + [cab.join(";"), ...corpo].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `contagem-estoque-${hojeIso()}${o.codigo ? `-${o.codigo}` : ""}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
