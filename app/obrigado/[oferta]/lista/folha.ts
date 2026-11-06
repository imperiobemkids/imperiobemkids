import type { Lista } from "@/lib/checkout/calendario";
import { brl, num } from "@/lib/formato";
import { abrirImpressao } from "@/lib/impressao";

/*
  Contas da pagina Minha lista (as mesmas colunas da aba Meu enxoval da planilha)
  e a folha A4 com o timbrado da IBK, que sai pelo abrirImpressao: no celular
  mostra a folha com Voltar e Imprimir, e dali da para salvar em PDF.
*/

export type Item = { tenho?: string; valor?: string; comprei?: boolean };
export type Itens = Record<string, Item>;

export type Linha = {
  chave: string;
  nome: string;
  obs?: string;
  qtd: number;
  tenho: string;
  falta: number;
  valorTexto: string; // como foi digitado, para o campo nao mudar enquanto a pessoa escreve
  valor: number | null;
  total: number | null;
  comprei: boolean;
};

export type Grupo = {
  id: string;
  titulo: string;
  sub: string;
  uso?: string;
  rotuloTotal: string;
  linhas: Linha[];
  pecas: number; // o que ainda falta comprar
  total: number;
};

function linha(grupo: string, id: string, nome: string, qtd: number, itens: Itens, obs?: string): Linha {
  const chave = `${grupo}:${id}`;
  const item = itens[chave] ?? {};
  const tenho = item.tenho ?? "";
  const falta = Math.max(0, qtd - num(tenho));
  const valor = item.valor?.trim() ? num(item.valor) : null;
  const total = valor === null ? null : falta * valor;
  return { chave, nome, obs, qtd, tenho, falta, valorTexto: item.valor ?? "", valor, total, comprei: !!item.comprei };
}

function fechar(g: Omit<Grupo, "pecas" | "total">): Grupo {
  return {
    ...g,
    pecas: g.linhas.reduce((n, l) => n + (l.comprei ? 0 : l.falta), 0),
    total: g.linhas.reduce((n, l) => n + (l.total ?? 0), 0),
  };
}

export function montarGrupos(lista: Lista, itens: Itens): Grupo[] {
  const tamanhos = lista.tamanhos.map((t) =>
    fechar({
      id: t.tamanho,
      titulo: `Tamanho ${t.tamanho}`,
      sub: `${t.idade}, ${t.altura}`,
      uso: `Uso: ${t.periodo}. Estação: ${t.estacao}`,
      rotuloTotal: "Total do tamanho",
      // peca que o periodo nao pede fica fora, como o cinza da planilha
      linhas: t.pecas.filter((p) => p.qtd > 0).map((p) => linha(t.tamanho, p.id, p.nome, p.qtd, itens)),
    }),
  );
  const sem = fechar({
    id: "sem",
    titulo: "Itens sem tamanho",
    sub: "a mesma quantidade para todo bebê",
    rotuloTotal: "Total dos itens",
    linhas: lista.semTamanho.map((s) => linha("sem", s.nome, s.nome, s.qtd, itens, s.obs)),
  });
  return [...tamanhos, sem];
}

export function somar(grupos: Grupo[]) {
  const linhas = grupos.flatMap((g) => g.linhas);
  const enxoval = grupos.reduce((n, g) => n + g.total, 0);
  const comprado = linhas.reduce((n, l) => n + (l.comprei ? (l.total ?? 0) : 0), 0);
  return {
    enxoval,
    comprado,
    faltaGastar: enxoval - comprado,
    pecas: grupos.reduce((n, g) => n + g.pecas, 0),
    temValor: linhas.some((l) => l.valor !== null),
  };
}

/* ---------- folha A4 ---------- */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
@page { size: A4; margin: 10mm; }
body { font-family: var(--font-nunito), Arial, sans-serif; color: #3b2b4f; font-size: 9.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
.timbrado { display: flex; align-items: center; gap: 4mm; border-bottom: 0.8mm solid #6d28b8; padding-bottom: 2.5mm; margin-bottom: 4mm; }
.timbrado img { width: 20mm; height: 20mm; }
.marca { flex: 1; min-width: 0; }
.marca h1 { font-family: var(--font-baloo), Arial, sans-serif; font-weight: 800; color: #4c1d80; font-size: 22pt; line-height: 1; margin: 0; }
.marca p { margin: 1mm 0 0; font-size: 9.5pt; color: #6b5b80; }
.marca b { color: #6d28b8; }
.dados { font-size: 8.5pt; text-align: right; line-height: 1.5; }
.dados b { color: #4c1d80; }
.bloco { margin-bottom: 3.5mm; break-inside: avoid; }
.pill { font-family: var(--font-baloo), Arial, sans-serif; font-weight: 800; color: #fff; background: #db2777; display: inline-block; padding: 0.5mm 3.5mm; border-radius: 3mm 3mm 0 0; font-size: 11pt; }
.pill small { font-family: var(--font-nunito), Arial, sans-serif; font-weight: 600; font-size: 8pt; margin-left: 2mm; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th { background: #6d28b8; color: #fff; font-weight: 700; font-size: 8pt; padding: 1mm 1.2mm; border: 0.3mm solid #e9d5ff; line-height: 1.15; }
td { border: 0.3mm solid #e9d5ff; height: 6.2mm; padding: 0 1.8mm; }
td.ck { width: 7mm; text-align: center; }
.caixa { display: inline-block; width: 3.6mm; height: 3.6mm; line-height: 3.2mm; border: 0.35mm solid #6d28b8; border-radius: 0.8mm; font-size: 8pt; font-weight: 800; color: #6d28b8; vertical-align: middle; }
td.peca { font-weight: 600; }
td.n { width: 14mm; text-align: center; font-weight: 800; color: #4c1d80; }
td.rs { width: 25mm; text-align: right; font-weight: 700; }
td.rs.vazio { color: #a78bfa; font-size: 8pt; font-weight: 600; text-align: left; }
tr.total td { background: #f5f3ff; font-weight: 800; color: #4c1d80; }
.resumo { border: 0.4mm solid #e9d5ff; border-radius: 3mm; padding: 2mm 3mm 2.5mm; background: #fffbf5; break-inside: avoid; }
.resumo h2 { font-family: var(--font-baloo), Arial, sans-serif; font-weight: 800; color: #4c1d80; font-size: 12pt; margin: 0 0 1.5mm; }
.caixas { display: grid; grid-template-columns: repeat(6, 1fr) 1.6fr; gap: 1.6mm; }
.caixas div { background: #fff; border: 0.3mm solid #e9d5ff; border-radius: 1.5mm; padding: 1mm 1.6mm; height: 12mm; display: flex; flex-direction: column; justify-content: space-between; }
.caixas span { font-size: 7.4pt; font-weight: 700; color: #4c1d80; }
.caixas b { font-size: 8.5pt; color: #3b2b4f; }
.caixas b.vazio { color: #a78bfa; font-weight: 600; }
.caixas .geral { background: #fde68a; border-color: #fcd34d; }
.rodape { margin-top: 3mm; display: flex; justify-content: space-between; font-size: 7.6pt; color: #8b7aa0; border-top: 0.3mm solid #e9d5ff; padding-top: 1.5mm; }
.rodape b { color: #6d28b8; }
`;

const celulaRs = (v: number | null) => (v === null ? `<td class="rs vazio">R$</td>` : `<td class="rs">${brl(v)}</td>`);
const caixaRs = (rotulo: string, v: number, temValor: boolean, classe = "") =>
  `<div class="${classe}"><span>${rotulo}</span>${temValor ? `<b>${brl(v)}</b>` : `<b class="vazio">R$</b>`}</div>`;

function blocoHtml(g: Grupo) {
  const linhas = g.linhas
    .map(
      (l) =>
        `<tr><td class="ck"><span class="caixa">${l.comprei ? "&#10003;" : ""}</span></td><td class="peca">${esc(l.nome)}</td>` +
        `<td class="n">${l.qtd}</td><td class="n">${esc(l.tenho)}</td><td class="n">${l.falta}</td>${celulaRs(l.valor)}${celulaRs(l.total)}</tr>`,
    )
    .join("");
  const temValor = g.linhas.some((l) => l.valor !== null);
  return (
    `<section class="bloco"><div class="pill">${esc(g.titulo)}<small>${esc(g.sub)}${g.uso ? `. ${esc(g.uso)}` : ""}</small></div>` +
    `<table><thead><tr><th></th><th>Peça</th><th>Preciso</th><th>Tenho</th><th>Falta</th><th>Valor médio (unidade)</th><th>Total</th></tr></thead>` +
    `<tbody>${linhas}<tr class="total"><td></td><td colspan="5">${g.rotuloTotal}</td>${celulaRs(temValor ? g.total : null)}</tr></tbody></table></section>`
  );
}

export function imprimirLista(lista: Lista, grupos: Grupo[], bebe: string) {
  const s = somar(grupos);
  const nome = bebe.trim();
  const html =
    `<header class="timbrado"><img src="${location.origin}/logo.png" alt="Império Bem Kids">` +
    `<div class="marca"><h1>${nome ? `Enxoval de ${esc(nome)}` : "Meu enxoval"}</h1><p><b>Enxoval na Medida</b> da Império Bem Kids</p></div>` +
    `<div class="dados"><b>Parto previsto:</b> ${esc(lista.mes)}<br><b>Região:</b> ${esc(lista.regiao)}<br><b>Lavagem:</b> a cada ${lista.dias} ${lista.dias === 1 ? "dia" : "dias"}</div></header>` +
    grupos.map(blocoHtml).join("") +
    `<section class="resumo"><h2>Quanto vai custar o enxoval</h2><div class="caixas">` +
    grupos.map((g) => caixaRs(g.id === "sem" ? "Sem tamanho" : esc(g.titulo), g.total, g.linhas.some((l) => l.valor !== null))).join("") +
    caixaRs("Total do enxoval", s.enxoval, s.temValor, "geral") +
    `</div></section>` +
    `<footer class="rodape"><span><b>Império Bem Kids</b> · www.imperiobemkids.com.br · @imperiobemkids</span></footer>`;
  abrirImpressao({ titulo: "Minha lista do enxoval", css: CSS, html, papel: { larguraMm: 210, margemMm: 10 } });
}
