import { SITE } from "@/lib/seo";

/*
  Ofertas de 1 clique depois da compra: o upsell e, para quem recusa, o downsell.

  Como funciona: a pagina de obrigado do produto principal na Kiwify aponta para
  o primeiro passo (enderecoDoPasso). A Kiwify traz a compradora com o token da
  compra no endereco e o script dela (SCRIPT_UPSELL) cobra no aceite, sem pedir
  os dados de novo. O script acha os botoes pelo id do link de checkout e le,
  no bloco da oferta, para onde ir ao aceitar e ao recusar.

  O codigo de acesso vai no caminho, e nao em ?acesso=, para o endereco que a
  Kiwify monta com os dados da compra nao depender de ja existir uma consulta.

  Quem aceita cai na pagina do produto principal com o aviso do que levou. O
  acesso ao produto extra chega pela area de membros: a pagina nao tem como
  conferir a cobranca, entao nao entrega o codigo dele.

  Preco e link sao os da Kiwify: mudou la, muda aqui.
*/
export const SCRIPT_UPSELL = "https://kiwify-snippets.netlify.app/upsell/upsell.min.js";

export type PassoUpsell = {
  passo: string; // parte do endereco: /obrigado/<oferta>/oferta/<passo>/<acesso>
  oferta: string; // slug do produto oferecido, em OFERTAS_ENTREGA
  link: string; // id do link de checkout na Kiwify (pay.kiwify.com.br/<link>)
  preco: number;
  chamada: string;
  titulo: string;
  texto: string;
  itens: string[];
  aceitar: string; // o preco entra depois, na pagina
  recusar: string;
};

export const UPSELL: Record<string, PassoUpsell[]> = {
  "ibk-enxoval": [
    {
      passo: "guarda-roupa",
      oferta: "ibk-guarda-roupa",
      link: "mxpDPfH",
      preco: 29.9,
      chamada: "Antes de abrir o seu enxoval",
      titulo: "E depois do primeiro aniversário?",
      texto:
        "O enxoval cuida do primeiro ano. O Guarda-roupa até os 3 anos faz a mesma conta para os tamanhos 1, 2 e 3, quando cada tamanho dura um ano inteiro e passa pelo calor e pelo frio.",
      itens: [
        "Página no celular, como a Minha lista: a lista de calor e a de frio de cada tamanho, na ordem em que a criança vai usar",
        "Calendário mês a mês, com o aviso de medir a criança antes de cada virada de tamanho",
        "Planilha para o computador e guia em PDF, com a conta de quando o kit compensa",
      ],
      aceitar: "Quero o guarda-roupa",
      recusar: "Agora não, quero só o enxoval",
    },
    {
      passo: "tamanho-1",
      oferta: "ibk-guarda-roupa-1",
      link: "NToQkZ0",
      preco: 14.9,
      chamada: "Uma opção menor",
      titulo: "Só o próximo tamanho, então?",
      texto:
        "O tamanho 1 é o primeiro depois do enxoval e dura cerca de um ano. O Guarda-roupa do tamanho 1 traz só ele: o que comprar para o calor e para o frio, e quando.",
      itens: [
        "Página no celular com a lista de calor e a de frio do tamanho 1",
        "Calendário do ano, com o aviso de medir antes de passar para o tamanho 2",
        "Planilha para o computador",
      ],
      aceitar: "Quero o tamanho 1",
      recusar: "Não, ir para o meu enxoval",
    },
  ],
};

const cod = encodeURIComponent;

// pagina do produto principal; com `levou`, mostra o aviso do produto extra
export const enderecoDoPedido = (oferta: string, acesso: string, levou?: string) =>
  `${SITE}/obrigado/${oferta}?acesso=${cod(acesso)}${levou ? `&levou=${cod(levou)}` : ""}`;

export const enderecoDoPasso = (oferta: string, passo: string, acesso: string) =>
  `${SITE}/obrigado/${oferta}/oferta/${passo}/${cod(acesso)}`;

// para onde o script da Kiwify leva: ao aceitar, o pedido; ao recusar, o passo seguinte ou o pedido
export function destinosDoPasso(oferta: string, passo: string, acesso: string) {
  const passos = UPSELL[oferta] ?? [];
  const i = passos.findIndex((p) => p.passo === passo);
  if (i < 0) return null;
  const seguinte = passos[i + 1];
  return {
    passo: passos[i],
    aoAceitar: enderecoDoPedido(oferta, acesso, passos[i].oferta),
    aoRecusar: seguinte ? enderecoDoPasso(oferta, seguinte.passo, acesso) : enderecoDoPedido(oferta, acesso),
  };
}
