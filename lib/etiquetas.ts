import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

/*
  Etiquetas 100x150 mm para a impressora termica. Gera um HTML proprio,
  abre numa janela nova e manda imprimir: assim o CSS do painel nao entra
  no meio e cada etiqueta vira uma pagina do tamanho da bobina.
*/

export type ItemRomaneio = { qtd: number; nome: string };
export type QrRomaneio = { rotulo: string; detalhe: string; url: string }; // rotulo e o convite ("Siga no TikTok"); detalhe, a linha pequena
export type EscritoRomaneio = { rotulo: string; texto: string }; // contato sem QR ("Fale com a gente" / "WhatsApp (11) ...")
export type Romaneio = {
  pedido: string; // numero do pedido ou data
  canal: string;
  cliente: string;
  data: string;
  itens: ItemRomaneio[];
  qrs: QrRomaneio[]; // QRs do rodape, lado a lado (2)
  escritos: EscritoRomaneio[]; // contatos por escrito, abaixo dos QRs
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
  .rom { padding: 6mm 6mm 5mm; }
  .rom .cabeca { display: flex; justify-content: space-between; align-items: flex-end; gap: 3mm; margin-top: 3mm; }
  .rom .rotulo { display: block; font-size: 6.5pt; font-weight: 800; letter-spacing: 1pt; color: #555; margin-bottom: 0.6mm; }
  .rom .pedido b { font-size: 15pt; font-weight: 900; letter-spacing: 0.2pt; line-height: 1; }
  .rom .cliente { text-align: right; font-size: 11pt; font-weight: 800; line-height: 1.1; max-width: 42mm; overflow-wrap: anywhere; }
  .rom table { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 10pt; }
  .rom td { padding: 1.6mm 0; border-bottom: 0.25mm solid #999; vertical-align: top; }
  .rom td.q { width: 9mm; font-weight: 900; font-size: 12pt; }
  .rom td.c { width: 7mm; text-align: right; }
  .rom .box { display: inline-block; width: 4.5mm; height: 4.5mm; border: 0.4mm solid #111; border-radius: 0.8mm; }
  .rom .rodape { margin-top: auto; border-top: 0.45mm dashed #111; padding-top: 3mm; }
  .rom .obrigado { text-align: center; font-size: 13pt; font-weight: 900; line-height: 1.1; }
  .rom .sub { text-transform: capitalize; }
  .rom .qrs { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 2.5mm; }
  .rom .qr { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.3mm; border: 0.35mm solid #111; border-radius: 2.5mm; padding: 2.2mm 2mm 2mm; }
  .rom .qr img { width: 24mm; height: 24mm; image-rendering: pixelated; }
  .rom .qr .txt { display: flex; flex-direction: column; gap: 0.5mm; }
  .rom .qr b { font-size: 10pt; font-weight: 900; line-height: 1.12; text-wrap: balance; }
  .rom .qr span { font-size: 7pt; line-height: 1.15; color: #444; }
  .rom .escritos { margin-top: 3mm; display: flex; flex-direction: column; gap: 1.4mm; }
  .rom .escrito { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; font-size: 9pt; border-bottom: 0.25mm dotted #888; padding-bottom: 1.2mm; }
  .rom .escrito:last-child { border-bottom: none; padding-bottom: 0; }
  .rom .escrito b { font-weight: 900; white-space: nowrap; }
  .rom .escrito span { font-weight: 700; text-align: right; overflow-wrap: anywhere; }
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

export async function imprimirRomaneios(lista: Romaneio[], opts: { logoUrl: string; marca: string }) {
  // cada link vira imagem uma vez so (o do WhatsApp muda por pedido, os outros se repetem)
  const imagens = new Map<string, string>();
  for (const url of new Set(lista.flatMap((r) => r.qrs.map((q) => q.url)))) {
    imagens.set(url, await QRCode.toDataURL(url, { margin: 1, width: 300, errorCorrectionLevel: "M" }));
  }
  const corpo = lista
    .map(
      (r) => `
    <div class="et rom">
      <div class="topo">
        <img src="${esc(opts.logoUrl)}" alt="">
        <div><div class="marca">${esc(opts.marca)}</div><div class="sub">${esc(r.canal)} · ${esc(r.data)}</div></div>
      </div>
      <div class="cabeca">
        <div class="pedido"><span class="rotulo">PEDIDO</span><b>${esc(r.pedido)}</b></div>
        ${r.cliente ? `<div class="cliente"><span class="rotulo">PARA</span>${esc(r.cliente)}</div>` : ""}
      </div>
      <table>${r.itens
        .map((i) => `<tr><td class="q">${i.qtd}x</td><td>${esc(i.nome)}</td><td class="c"><span class="box"></span></td></tr>`)
        .join("")}</table>
      <div class="rodape">
        <div class="obrigado">Obrigada pela compra! ♥</div>
        ${r.qrs.length ? `<div class="qrs">${r.qrs
          .map((q) => `<div class="qr"><img src="${imagens.get(q.url)}" alt=""><div class="txt"><b>${esc(q.rotulo)}</b><span>${esc(q.detalhe)}</span></div></div>`)
          .join("")}</div>` : ""}
        ${r.escritos.length ? `<div class="escritos">${r.escritos
          .map((e) => `<div class="escrito"><b>${esc(e.rotulo)}</b><span>${esc(e.texto)}</span></div>`)
          .join("")}</div>` : ""}
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
