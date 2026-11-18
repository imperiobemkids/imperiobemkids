import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { abrirImpressao } from "./impressao";

/*
  Etiquetas 100x150 mm para a impressora termica. Gera um HTML proprio e abre
  por cima do painel (lib/impressao.ts), com o CSS isolado: o do painel nao
  entra no meio e cada etiqueta vira uma pagina do tamanho da bobina.
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
  body { font-family: var(--font-nunito, "Nunito"), "Segoe UI", Arial, sans-serif; color: #111; }
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
  /* na previa da tela cada etiqueta aparece separada, como sai da bobina */
  @media screen { .et { background: #fff; margin-bottom: 4mm; box-shadow: 0 2px 10px rgba(60, 40, 80, 0.15); } }
`;

function abrirEImprimir(corpo: string, titulo: string) {
  abrirImpressao({ titulo, css: CSS, html: corpo, papel: { larguraMm: 100, margemMm: 0, solto: true } });
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

/*
  Etiqueta de presente ("Com carinho / De / Para") no visual da marca: Baloo
  (a fonte do "IMPERIO" do logo), roxo escuro nos textos, cartao arredondado
  com a borda de baixo mais grossa (o mesmo "degrau" dos cartoes do site), o
  ursinho do logo no canto e o coracao roxo. Dois formatos: na termica 100x150
  saem 2 por etiqueta, em preto, com linha de corte; em folha A4 saem 8 por
  folha (90 x 60 mm), na cor de destaque escolhida, para papel adesivo. De e
  Para em branco viram linha para escrever a mao.
*/
export type EtiquetaPresente = {
  frase: string;
  de: string;
  para: string;
  qtd: number;
  formato: "termica" | "a4";
  cor: "roxo" | "rosa" | "menta";
  comMarca: boolean;
};

// tokens de app/globals.css; o "sombra" e o tom escuro da borda de baixo
const CORES_PRESENTE = {
  roxo: { borda: "#6d28b8", sombra: "#4c1d80", linha: "#c4b5fd", coracao: "#f472b6" },
  rosa: { borda: "#f472b6", sombra: "#db2777", linha: "#f9a8d4", coracao: "#6d28b8" },
  menta: { borda: "#34d399", sombra: "#059669", linha: "#6ee7b7", coracao: "#6d28b8" },
};

const CORACAO =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const ESTRELA =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';

function cssPresente(o: EtiquetaPresente) {
  const termica = o.formato === "termica";
  const c = termica ? { borda: "#000", sombra: "#000", linha: "#000", coracao: "#000" } : CORES_PRESENTE[o.cor];
  const roxo = termica ? "#000" : "#4c1d80";
  return `
  @page { size: ${termica ? "100mm 150mm" : "A4"}; margin: ${termica ? "0" : "10mm"}; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: ${roxo}; font-family: var(--font-nunito, "Nunito"), "Segoe UI", Arial, sans-serif; }
  .folha { ${
    termica
      ? "width: 100mm; height: 150mm; display: flex; flex-direction: column; page-break-after: always; background: #fff;"
      : "display: grid; grid-template-columns: repeat(2, 90mm); grid-auto-rows: 60mm; gap: 6mm; justify-content: center; page-break-after: always;"
  } }
  .folha:last-child { page-break-after: auto; }
  .vaga { ${termica ? "height: 75mm; display: flex; align-items: center; justify-content: center;" : ""} }
  .vaga + .vaga { ${termica ? "border-top: 0.3mm dashed #000;" : ""} }
  /* cartao da marca: borda arredondada e a de baixo mais grossa */
  .tag { position: relative; width: ${termica ? "92mm" : "90mm"}; height: ${termica ? "66mm" : "60mm"}; border-radius: 5mm;
    background: #fff; border: 0.9mm solid ${c.borda}; border-bottom: 2.4mm solid ${c.sombra}; padding: 3mm 5mm 4mm;
    display: flex; flex-direction: column; justify-content: space-evenly; overflow: hidden; }
  .topo { display: flex; align-items: center; gap: 2mm; padding-right: 19mm; }
  .frase { font-family: var(--font-baloo, "Baloo 2"), "Nunito", sans-serif; font-weight: 800; line-height: 1; color: ${roxo};
    white-space: nowrap; overflow: hidden; }
  .topo svg { width: 7mm; height: 7mm; flex: none; fill: ${c.coracao}; }
  .logo { position: absolute; top: 1.5mm; right: 2.5mm; width: 20mm; height: 20mm; object-fit: contain; }
  .campo { display: flex; align-items: flex-end; gap: 2mm; }
  .campo b { font-family: var(--font-baloo, "Baloo 2"), "Nunito", sans-serif; font-weight: 700; font-size: 17pt; line-height: 1;
    color: ${termica ? "#000" : c.borda === "#6d28b8" ? "#6d28b8" : roxo}; }
  .campo span { flex: 1; min-height: 8mm; border-bottom: 0.5mm ${termica ? "solid" : "dashed"} ${c.linha}; font-weight: 800;
    font-size: 14pt; line-height: 1.1; padding: 0 1mm 0.8mm; overflow: hidden; white-space: nowrap; color: ${roxo}; }
  /* assinatura como no logo: IMPERIO grosso e BEM KIDS espacado */
  .marca { position: absolute; right: 4.5mm; bottom: 1.2mm; display: flex; align-items: baseline; gap: 1.2mm; }
  .marca b { font-family: var(--font-baloo, "Baloo 2"), sans-serif; font-weight: 800; font-size: 9pt; letter-spacing: 0.4pt; color: ${termica ? "#000" : "#6d28b8"}; }
  .marca span { font-size: 6pt; font-weight: 700; letter-spacing: 1.6pt; color: ${roxo}; }
  .marca svg { width: 2.6mm; height: 2.6mm; fill: ${termica ? "#000" : "#fbbf24"}; align-self: center; }
  /* na previa da tela cada folha aparece separada, como sai da impressora */
  @media screen { .folha { background: #fff; margin-bottom: 4mm; ${termica ? "box-shadow: 0 2px 10px rgba(60, 40, 80, 0.15);" : ""} } }
`;
}

export async function imprimirEtiquetasPresente(o: EtiquetaPresente, opts: { logoUrl: string; marca: string }) {
  // Baloo e Nunito ja vem do layout (next/font); so espera estarem prontas antes da previa
  await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 2000))]);
  const qtd = Math.max(1, Math.min(200, Math.round(o.qtd)));
  const frase = o.frase.trim();
  const tamanho = frase.length > 16 ? 17 : frase.length > 12 ? 20 : 24;
  // so o ursinho do logo (o nome ja vai no rodape): na termica, a versao com pastel em cinza
  // claro e contorno preto (public/logo-termica.png), porque o colorido em preto e branco sai apagado
  const logo = opts.logoUrl.replace(/logo\.png$/, o.formato === "termica" ? "logo-termica.png" : "logo-urso.png");
  const tag = `
    <div class="tag">
      ${o.comMarca ? `<img class="logo" src="${esc(logo)}" alt="">` : ""}
      <div class="topo"><div class="frase" style="font-size: ${tamanho}pt">${esc(frase)}</div>${CORACAO}</div>
      <div class="campo"><b>De:</b><span>${esc(o.de.trim())}</span></div>
      <div class="campo"><b>Para:</b><span>${esc(o.para.trim())}</span></div>
      ${o.comMarca ? `<div class="marca">${ESTRELA}<b>IMPÉRIO</b><span>BEM KIDS</span></div>` : ""}
    </div>`;
  const porFolha = o.formato === "termica" ? 2 : 8;
  const folhas = Array.from({ length: Math.ceil(qtd / porFolha) }, (_, f) => {
    const nessa = Math.min(porFolha, qtd - f * porFolha);
    return `<div class="folha">${Array.from({ length: nessa }, () => `<div class="vaga">${tag}</div>`).join("")}</div>`;
  }).join("");
  abrirImpressao({
    titulo: `Etiqueta de presente (${qtd})`,
    css: cssPresente(o),
    html: folhas,
    papel: o.formato === "termica" ? { larguraMm: 100, margemMm: 0, solto: true } : { larguraMm: 210, margemMm: 10 },
  });
}
