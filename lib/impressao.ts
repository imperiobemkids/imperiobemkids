/*
  Impressao dentro da propria pagina, no celular e no computador. A folha abre
  por cima do ERP com "Voltar" e "Imprimir", e a impressao esconde o resto da
  pagina. Antes cada impressao abria uma janela nova, que no celular vira uma
  aba sem historico: depois da tela de impressao a pessoa ficava presa nela.

  O CSS de cada documento fica isolado num shadow root: nao vaza para o painel
  nem recebe o CSS dele. A regra @page so vale no documento principal, entao
  sai do CSS e vai para um <style> que existe enquanto a folha esta aberta.
  O voltar do celular (botao ou gesto) tambem fecha a folha.
*/

type Papel = {
  larguraMm: number; // largura da folha, para encaixar a previa na tela
  margemMm: number; // margem do @page, simulada na previa
  solto?: boolean; // etiquetas: cada uma ja e o papel, sem folha branca por tras
};

const ID = "impressao";
const MM = 96 / 25.4;

let fechar: (() => void) | null = null;

export function fecharImpressao() {
  fechar?.();
}

export function abrirImpressao(o: { titulo: string; css: string; html: string; papel: Papel }) {
  fecharImpressao();

  const regraPagina = (o.css.match(/@page\s*{[^}]*}/) ?? [""])[0];
  const cssDoc = o.css
    .replace(/@page\s*{[^}]*}/, "")
    .replace(/\bhtml,\s*body\b/g, ".doc")
    .replace(/\bbody\b/g, ".doc");

  const estilo = document.createElement("style");
  estilo.textContent = `
    ${regraPagina}
    #${ID} { position: fixed; inset: 0; z-index: 1000; overflow: auto; background: #ebe6f0; -webkit-overflow-scrolling: touch; }
    #${ID} .barra { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px;
      padding: 10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
      background: #fff; box-shadow: 0 2px 10px rgba(60, 40, 80, 0.12); font-family: var(--font-nunito), sans-serif; }
    #${ID} .barra button { border: 0; border-radius: 14px; padding: 11px 16px; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
    #${ID} .voltar { background: rgba(109, 40, 184, 0.1); color: #4c1d80; }
    #${ID} .imprimir { background: #6d28b8; color: #fff; }
    #${ID} .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 700; color: #3b2b4f; }
    #${ID} .area { padding: 12px 12px max(24px, env(safe-area-inset-bottom)); }
    #${ID} .papel { margin: 0 auto; width: ${o.papel.larguraMm}mm; ${
      o.papel.solto ? "" : `background: #fff; padding: ${o.papel.margemMm}mm; box-shadow: 0 2px 12px rgba(60, 40, 80, 0.15);`
    } box-sizing: border-box; }
    @media print {
      html, body { background: #fff !important; overflow: visible !important; }
      body > *:not(#${ID}) { display: none !important; }
      #${ID} { position: static; overflow: visible; background: none; }
      #${ID} .barra { display: none; }
      #${ID} .area { padding: 0; }
      #${ID} .papel { zoom: 1 !important; width: auto; padding: 0; box-shadow: none; }
    }`;

  const camada = document.createElement("div");
  camada.id = ID;
  camada.setAttribute("role", "dialog");
  camada.setAttribute("aria-label", o.titulo);

  const barra = document.createElement("div");
  barra.className = "barra";
  const voltar = document.createElement("button");
  voltar.className = "voltar";
  voltar.textContent = "← Voltar";
  const titulo = document.createElement("span");
  titulo.className = "titulo";
  titulo.textContent = o.titulo;
  const imprimir = document.createElement("button");
  imprimir.className = "imprimir";
  imprimir.textContent = "Imprimir";
  barra.append(voltar, titulo, imprimir);

  const area = document.createElement("div");
  area.className = "area";
  const papel = document.createElement("div");
  papel.className = "papel";
  papel.attachShadow({ mode: "open" }).innerHTML = `<style>${cssDoc}</style><div class="doc">${o.html}</div>`;
  area.append(papel);
  camada.append(barra, area);

  document.head.append(estilo);
  document.body.append(camada);
  const overflowAntes = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  // a folha cabe na largura da tela; na impressao o zoom volta a 1
  const encaixar = () => {
    const escala = Math.min(1, (camada.clientWidth - 24) / (o.papel.larguraMm * MM));
    papel.style.zoom = String(escala);
  };
  encaixar();
  window.addEventListener("resize", encaixar);

  // uma entrada no historico: o voltar do celular fecha a folha em vez de sair da tela
  history.pushState({ ...(history.state ?? {}), impressao: true }, "");
  let aberta = true;
  const aoVoltar = () => desmontar();
  const aoTeclar = (e: KeyboardEvent) => {
    if (e.key === "Escape") history.back();
  };
  window.addEventListener("popstate", aoVoltar);
  window.addEventListener("keydown", aoTeclar);

  function desmontar() {
    if (!aberta) return;
    aberta = false;
    window.removeEventListener("popstate", aoVoltar);
    window.removeEventListener("keydown", aoTeclar);
    window.removeEventListener("resize", encaixar);
    camada.remove();
    estilo.remove();
    document.documentElement.style.overflow = overflowAntes;
    fechar = null;
  }
  // fechar por fora (outra impressao abrindo) so desmonta: um history.back aqui
  // chegaria depois e fecharia a folha nova
  fechar = desmontar;

  voltar.addEventListener("click", () => history.back());
  imprimir.addEventListener("click", () => window.print());

  // no computador manda imprimir direto, como antes; no celular a pessoa ve a folha e toca em Imprimir
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const imagens = [...papel.shadowRoot!.querySelectorAll("img")];
    const prontas = Promise.all(imagens.map((i) => i.decode().catch(() => undefined)));
    Promise.race([prontas, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (aberta) window.print();
    });
  }
}
