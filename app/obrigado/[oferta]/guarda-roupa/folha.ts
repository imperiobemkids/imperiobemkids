import type { GuardaRoupa } from "@/lib/checkout/guardaRoupa";
import { abrirImpressao } from "@/lib/impressao";
import { CSS, blocoHtml, caixaRs, esc, fechar, linha, somar, type Grupo, type Itens } from "../lista/folha";

/*
  Contas da pagina Meu guarda-roupa e a folha A4 com o timbrado da IBK. Usa as
  mesmas linhas, totais e estilos da Minha lista: muda o cabecalho, que traz o
  nascimento, e a tabela de quando a crianca usa cada tamanho.
*/

export function montarGrupos(g: GuardaRoupa, itens: Itens): Grupo[] {
  return g.blocos.map((b) =>
    fechar({
      id: b.id,
      titulo: `Tamanho ${b.tamanho}, ${b.guardaRoupa}`,
      sub: `${b.idade}, ${b.altura}`,
      uso: `Uso: ${b.periodos}` + (b.virada ? `. Meça antes de comprar para ${b.virada}` : ""),
      rotuloTotal: "Total do guarda-roupa",
      linhas: b.pecas.map((p) => linha(b.id, p.id, p.nome, p.qtd, itens)),
    }),
  );
}

const CSS_EXTRA = `
table.quando { margin-bottom: 4mm; }
table.quando td { text-align: center; }
table.quando td:first-child { text-align: left; font-weight: 800; color: #4c1d80; }
`;

export function imprimirGuardaRoupa(g: GuardaRoupa, grupos: Grupo[], crianca: string, produto: string) {
  const s = somar(grupos);
  const nome = crianca.trim();
  const quando = g.tamanhos
    .map((t) => `<tr><td>Tamanho ${t.codigo}</td><td>${esc(t.idade)}, ${esc(t.altura)}</td><td>${esc(t.quando)}</td><td>${esc(t.meca)}</td></tr>`)
    .join("");
  const html =
    `<header class="timbrado"><img src="${location.origin}/logo.png" alt="Império Bem Kids">` +
    `<div class="marca"><h1>${nome ? `Guarda-roupa de ${esc(nome)}` : "Meu guarda-roupa"}</h1><p><b>${esc(produto)}</b> da Império Bem Kids</p></div>` +
    `<div class="dados"><b>Nascimento:</b> ${esc(g.mes)} de ${g.ano}<br><b>Região:</b> ${esc(g.regiao)}<br><b>Lavagem:</b> a cada ${g.dias} ${g.dias === 1 ? "dia" : "dias"}</div></header>` +
    `<table class="quando"><thead><tr><th>Tamanho</th><th>Idade e altura</th><th>Quando usa</th><th>Meça antes de comprar a partir de</th></tr></thead><tbody>${quando}</tbody></table>` +
    grupos.map(blocoHtml).join("") +
    `<section class="resumo"><h2>Quanto vai custar o guarda-roupa</h2><div class="caixas" style="grid-template-columns: repeat(${grupos.length}, 1fr) 1.6fr">` +
    grupos.map((gr) => caixaRs(esc(gr.titulo), gr.total, gr.linhas.some((l) => l.valor !== null))).join("") +
    caixaRs("Total", s.enxoval, s.temValor, "geral") +
    `</div></section>` +
    `<footer class="rodape"><span><b>Império Bem Kids</b> · www.imperiobemkids.com.br · @imperiobemkids</span><span>A altura manda: meça antes de comprar.</span></footer>`;
  abrirImpressao({ titulo: "Meu guarda-roupa", css: CSS + CSS_EXTRA, html, papel: { larguraMm: 210, margemMm: 10 } });
}
