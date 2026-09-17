import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

/*
  Etiquetas 100x150 mm para a impressora termica. Gera um HTML proprio,
  abre numa janela nova e manda imprimir: assim o CSS do painel nao entra
  no meio e cada etiqueta vira uma pagina do tamanho da bobina.
*/

export type ItemRomaneio = { qtd: number; nome: string };
export type Romaneio = {
  pedido: string; // numero do pedido ou data
  canal: string;
  cliente: string;
  data: string;
  itens: ItemRomaneio[];
};

export type EtiquetaProduto = {
  nome: string;
  tamanho: string;
  cor: string;
  sku: string;
  qtd: number;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function barcodeSvg(valor: string): string {
  if (!valor) return "";
  // jsbarcode desenha num <svg> do DOM; aqui cria um solto e pega o markup
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, valor, { format: "CODE128", displayValue: false, height: 60, width: 2, margin: 0 });
  } catch {
    return "";
  }
  svg.setAttribute("width", "100%");
  svg.removeAttribute("height");
  return svg.outerHTML;
}

const CSS = `
  @page { size: 100mm 150mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Nunito", "Segoe UI", Arial, sans-serif; color: #111; }
  .et { width: 100mm; height: 150mm; padding: 7mm 7mm 6mm; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; }
  .et:last-child { page-break-after: auto; }
  .topo { display: flex; align-items: center; gap: 3mm; border-bottom: 0.5mm solid #111; padding-bottom: 2.5mm; }
  .topo img { width: 12mm; height: 12mm; object-fit: contain; }
  .marca { font-weight: 900; font-size: 15pt; letter-spacing: -0.2pt; line-height: 1; }
  .sub { font-size: 8pt; color: #444; margin-top: 1mm; }
  .pedido { font-size: 9pt; color: #444; margin-top: 3mm; }
  .pedido b { font-size: 14pt; color: #111; display: block; letter-spacing: 0.3pt; }
  .cliente { font-size: 12pt; font-weight: 800; margin-top: 1mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 10pt; }
  td { padding: 1.6mm 0; border-bottom: 0.25mm solid #999; vertical-align: top; }
  td.q { width: 9mm; font-weight: 900; font-size: 12pt; }
  td.c { width: 7mm; text-align: right; }
  .box { display: inline-block; width: 4.5mm; height: 4.5mm; border: 0.4mm solid #111; border-radius: 0.8mm; }
  .rodape { margin-top: auto; display: flex; align-items: center; gap: 3mm; border-top: 0.5mm solid #111; padding-top: 3mm; }
  .rodape img { width: 22mm; height: 22mm; }
  .obrigado { font-size: 9.5pt; line-height: 1.35; }
  .obrigado b { font-size: 11pt; display: block; margin-bottom: 1mm; }
  .prod .nome { font-size: 18pt; font-weight: 900; line-height: 1.1; margin-top: 4mm; }
  .prod .tam { font-size: 40pt; font-weight: 900; line-height: 1; margin-top: 3mm; }
  .prod .tam small { font-size: 12pt; font-weight: 700; color: #444; display: block; margin-bottom: 1mm; }
  .prod .cor { font-size: 14pt; font-weight: 700; margin-top: 2mm; }
  .prod .sku { margin-top: auto; font-family: Consolas, monospace; font-size: 12pt; font-weight: 700; text-align: center; letter-spacing: 1pt; }
  .prod svg { width: 100%; height: 22mm; margin-top: 2mm; }
  .prod .qtd { font-size: 9pt; color: #444; text-align: right; margin-top: 1mm; }
`;

function abrirEImprimir(corpo: string, titulo: string) {
  const w = window.open("", "_blank", "width=480,height=720");
  if (!w) throw new Error("o navegador bloqueou a janela de impressão");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>${corpo}</body></html>`);
  w.document.close();
  w.focus();
  // espera a fonte e as imagens
  setTimeout(() => {
    w.print();
  }, 400);
}

export async function imprimirRomaneios(lista: Romaneio[], opts: { logoUrl: string; qrUrl: string; qrTexto: string; marca: string }) {
  const qr = opts.qrUrl ? await QRCode.toDataURL(opts.qrUrl, { margin: 0, width: 220 }) : "";
  const corpo = lista
    .map(
      (r) => `
    <div class="et">
      <div class="topo">
        <img src="${esc(opts.logoUrl)}" alt="">
        <div><div class="marca">${esc(opts.marca)}</div><div class="sub">${esc(r.canal)} · ${esc(r.data)}</div></div>
      </div>
      <div class="pedido">pedido<b>${esc(r.pedido)}</b></div>
      ${r.cliente ? `<div class="cliente">${esc(r.cliente)}</div>` : ""}
      <table>${r.itens
        .map((i) => `<tr><td class="q">${i.qtd}x</td><td>${esc(i.nome)}</td><td class="c"><span class="box"></span></td></tr>`)
        .join("")}</table>
      <div class="rodape">
        ${qr ? `<img src="${qr}" alt="">` : ""}
        <div class="obrigado"><b>Obrigada pela compra! ♥</b>${esc(opts.qrTexto)}</div>
      </div>
    </div>`,
    )
    .join("");
  abrirEImprimir(corpo, `Romaneio (${lista.length})`);
}

export function imprimirEtiquetasProduto(lista: EtiquetaProduto[], opts: { logoUrl: string; marca: string }) {
  const corpo = lista
    .flatMap((e) => Array.from({ length: Math.max(1, e.qtd) }, () => e))
    .map(
      (e) => `
    <div class="et prod">
      <div class="topo">
        <img src="${esc(opts.logoUrl)}" alt="">
        <div><div class="marca">${esc(opts.marca)}</div></div>
      </div>
      <div class="nome">${esc(e.nome)}</div>
      ${e.tamanho ? `<div class="tam"><small>tamanho</small>${esc(e.tamanho)}</div>` : ""}
      ${e.cor ? `<div class="cor">${esc(e.cor)}</div>` : ""}
      <div class="sku">${esc(e.sku)}</div>
      ${barcodeSvg(e.sku)}
    </div>`,
    )
    .join("");
  abrirEImprimir(corpo, `Etiquetas (${lista.length})`);
}
