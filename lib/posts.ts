/*
  Conteudo do blog. Fica em arquivo mesmo (sem banco) porque sao poucos textos
  e assim a pagina e estatica e rapida. Para publicar um post novo, acrescente
  um item aqui: a listagem, a rota e o sitemap se atualizam sozinhos.
*/

export type Bloco =
  | { tipo: "p"; texto: string }
  // paragrafo com link interno: o texto ancora ajuda a busca a entender o destino
  | { tipo: "p-link"; antes: string; ancora: string; href: string; depois: string }
  | { tipo: "h2"; texto: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "destaque"; texto: string }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] };

export type Post = {
  slug: string;
  titulo: string;
  resumo: string;
  data: string; // ISO
  emoji: string;
  leitura: string;
  blocos: Bloco[];
};

export const POSTS: Post[] = [
  {
    slug: "tabela-de-tamanhos-roupa-infantil",
    titulo: "Tabela de tamanhos de roupa infantil por idade e altura",
    resumo:
      "A dúvida que mais chega no nosso WhatsApp. Tabela de RN ao 10 e o jeito simples de medir a criança sem errar.",
    data: "2026-08-05",
    emoji: "📏",
    leitura: "4 min",
    blocos: [
      {
        tipo: "p",
        texto:
          "Comprar roupa infantil pela internet dá um friozinho na barriga: e se vier pequeno? E se sobrar? A boa notícia é que dá para acertar quase sempre, e não é pela idade da criança.",
      },
      {
        tipo: "destaque",
        texto:
          "A idade é só um ponto de partida. O que manda mesmo é a altura da criança.",
      },
      { tipo: "h2", texto: "Por que a idade engana" },
      {
        tipo: "p",
        texto:
          "Duas crianças de 3 anos podem ter 10 cm de diferença de altura. Por isso a etiqueta que diz '3 anos' acerta em uma e falha na outra. As fábricas montam a grade por centímetros e depois traduzem para idade, e é nessa tradução que a confusão acontece.",
      },
      { tipo: "h2", texto: "Tabela de referência por altura" },
      {
        tipo: "p",
        texto:
          "Use como ponto de partida. Cada marca tem a sua grade, então vale sempre conferir a tabela do produto antes de fechar.",
      },
      {
        tipo: "tabela",
        cabecalho: ["Tamanho", "Idade aproximada", "Altura"],
        linhas: [
          ["RN", "recém-nascido", "até 50 cm"],
          ["P", "0 a 3 meses", "50 a 60 cm"],
          ["M", "3 a 6 meses", "60 a 66 cm"],
          ["G", "6 a 9 meses", "66 a 72 cm"],
          ["GG", "9 a 12 meses", "72 a 78 cm"],
          ["1", "1 ano", "78 a 84 cm"],
          ["2", "2 anos", "85 a 92 cm"],
          ["3", "3 anos", "93 a 99 cm"],
          ["4", "4 anos", "100 a 106 cm"],
          ["6", "5 a 6 anos", "107 a 118 cm"],
          ["8", "7 a 8 anos", "119 a 130 cm"],
          ["10", "9 a 10 anos", "131 a 140 cm"],
        ],
      },
      { tipo: "h2", texto: "Como medir em 30 segundos" },
      {
        tipo: "lista",
        itens: [
          "Encoste a criança na parede, descalça e de costas.",
          "Marque com o dedo no topo da cabeça e meça do chão até a marca.",
          "Compare com a coluna de altura da tabela.",
          "Se ficar entre dois tamanhos, pegue o maior. Roupa larga a criança usa, roupa curta não.",
        ],
      },
      { tipo: "h2", texto: "Três detalhes que salvam a compra" },
      {
        tipo: "lista",
        itens: [
          "Malha e algodão encolhem um pouco na primeira lavagem. Contar com isso ajuda.",
          "Se a criança está numa fase de estirão, subir um tamanho é quase sempre a escolha certa.",
          "Para presente, quando você não sabe a altura, prefira um tamanho acima. Guardar até servir é fácil; devolver dá trabalho.",
        ],
      },
      {
        tipo: "p-link",
        antes: "Depois de descobrir o tamanho, vale dar uma olhada nos ",
        ancora: "kits de roupa infantil com pronta entrega",
        href: "/pedido",
        depois: ", que vêm com quatro peças e já saem no tamanho que você escolher.",
      },
      {
        tipo: "p",
        texto:
          "E se bater dúvida, chama a gente no WhatsApp. A gente confere a medida do kit junto com você antes de fechar o pedido. 💜",
      },
    ],
  },
  {
    slug: "quantas-roupas-crianca-precisa",
    titulo: "Quantas roupas uma criança precisa? O enxoval que basta",
    resumo:
      "Guarda-roupa lotado e a criança usando sempre as mesmas 5 peças. Como montar um enxoval enxuto que funciona.",
    data: "2026-08-05",
    emoji: "👕",
    leitura: "3 min",
    blocos: [
      {
        tipo: "p",
        texto:
          "Toda mãe conhece a cena: gaveta transbordando e a criança girando nas mesmas cinco peças. O resto fica lá, esperando servir, até não servir mais.",
      },
      { tipo: "h2", texto: "A conta que faz sentido" },
      {
        tipo: "p",
        texto:
          "A referência que funciona na prática é pensar em quantos dias você quer aguentar sem lavar roupa. Para a maioria das famílias, entre 5 e 7 trocas completas resolve.",
      },
      {
        tipo: "tabela",
        cabecalho: ["Item", "Quantidade que costuma bastar"],
        linhas: [
          ["Conjuntos do dia a dia", "5 a 7"],
          ["Peças para sair ou ocasião", "2 a 3"],
          ["Pijamas", "3 a 4"],
          ["Peças de frio (casaco, moletom)", "2 a 3"],
        ],
      },
      {
        tipo: "destaque",
        texto:
          "Comprar menos e melhor sai mais barato do que comprar muito e barato demais.",
      },
      { tipo: "h2", texto: "Por que kit costuma render mais" },
      {
        tipo: "p",
        texto:
          "Kit com peças que combinam entre si multiplica as combinações. Quatro peças que conversam viram várias produções diferentes, enquanto quatro peças soltas e chamativas quase sempre viram quatro looks fixos.",
      },
      { tipo: "h2", texto: "O erro mais caro" },
      {
        tipo: "p",
        texto:
          "Comprar muitos números acima achando que vai durar. A peça fica guardada, sai de estação, e quando serve já não combina com o clima. Prefira comprar para agora e no máximo um tamanho à frente.",
      },
      {
        tipo: "p-link",
        antes: "É por isso que a gente trabalha com ",
        ancora: "kit de roupa infantil com peças que combinam",
        href: "/pedido",
        depois: ": rende mais combinação com menos peça no guarda-roupa.",
      },
      {
        tipo: "p",
        texto:
          "Se quiser, a gente monta uma sugestão de enxoval enxuto para a idade do seu filho. É só chamar. 💜",
      },
    ],
  },
  {
    slug: "como-lavar-roupa-infantil-sem-desbotar",
    titulo: "Como lavar roupa infantil sem desbotar nem descascar a estampa",
    resumo:
      "Mancha de suco, estampa descascando, malha desbotada. Cuidados simples que dobram a vida útil das peças.",
    data: "2026-08-05",
    emoji: "🧺",
    leitura: "3 min",
    blocos: [
      {
        tipo: "p",
        texto:
          "Roupa de criança sofre. Terra, suco, tinta, joelho no chão. Mas boa parte do desgaste que a gente culpa a qualidade vem, na verdade, da lavagem.",
      },
      { tipo: "h2", texto: "O básico que muda tudo" },
      {
        tipo: "lista",
        itens: [
          "Lave do avesso. Protege a estampa e segura a cor da malha.",
          "Água fria ou morna. Água quente é a principal vilã do encolhimento.",
          "Separe por cor de verdade, principalmente nas primeiras lavagens das peças escuras.",
          "Nada de alvejante em peça estampada ou colorida.",
        ],
      },
      { tipo: "h2", texto: "Estampa que descasca" },
      {
        tipo: "p",
        texto:
          "Estampa de silk racha quando pega calor direto. Duas atitudes resolvem: nunca passar ferro por cima da estampa (passe do avesso) e evitar secadora nessas peças.",
      },
      { tipo: "h2", texto: "Manchas, na hora certa" },
      {
        tipo: "lista",
        itens: [
          "Aja rápido: mancha fresca sai com água corrente e sabão neutro.",
          "Suco e fruta: água fria primeiro. Água quente cozinha o açúcar no tecido e fixa.",
          "Gordura: um pouco de detergente neutro direto na mancha antes de lavar.",
          "Nunca esfregue com força em malha fina, isso abre o tecido e cria bolinha.",
        ],
      },
      {
        tipo: "destaque",
        texto:
          "Secar na sombra parece bobagem, mas é o que mais preserva a cor. Sol forte desbota em poucas lavagens.",
      },
      {
        tipo: "p-link",
        antes: "E para a peça durar de verdade, ela precisa servir direito desde o começo: veja a ",
        ancora: "tabela de tamanhos de roupa infantil",
        href: "/blog/tabela-de-tamanhos-roupa-infantil",
        depois: " antes de comprar.",
      },
      {
        tipo: "p",
        texto:
          "Peça bem cuidada ainda passa para o irmão mais novo ou é revendida. Cuidar é economia. 💜",
      },
    ],
  },
  {
    // leva para a calculadora de moedas (pagina fora do nicho de roupa, precisa de link interno)
    slug: "quanto-vale-presente-live-tiktok",
    titulo: "Quanto vale um presente na live do TikTok? A conta em reais",
    resumo:
      "Moeda, presente e diamante: como funciona o dinheiro das lives do TikTok e quanto vale cada moeda em reais, com tabela.",
    data: "2026-10-08",
    emoji: "🪙",
    leitura: "3 min",
    blocos: [
      {
        tipo: "p",
        texto:
          "Quem já assistiu uma live no TikTok viu os presentes voando na tela: rosa, leão, foguete. Cada um custa moedas, e as moedas custam dinheiro de verdade. Mas quanto isso vale em reais, e quanto chega para quem está fazendo a live?",
      },
      {
        tipo: "destaque",
        texto:
          "1 moeda do TikTok vale cerca de US$ 0,013, perto de R$ 0,07. Quem faz a live fica com mais ou menos metade desse valor.",
      },
      { tipo: "h2", texto: "Como funcionam as moedas e os presentes" },
      {
        tipo: "lista",
        itens: [
          "Quem assiste compra moedas com dinheiro, pelo app ou pelo site do TikTok.",
          "Com as moedas, manda presentes na live ou nos vídeos. Cada presente custa um número de moedas: a rosa custa 1, e os maiores custam milhares.",
          "Quem recebe o presente ganha diamantes, que podem ser sacados em dinheiro.",
          "O TikTok fica com cerca de metade do valor do presente.",
        ],
      },
      { tipo: "h2", texto: "Quanto vale em reais" },
      {
        tipo: "p",
        texto:
          "A tabela usa a referência mais citada, US$ 0,013 por moeda, e o dólar perto de R$ 5,00 (outubro de 2026):",
      },
      {
        tipo: "tabela",
        cabecalho: ["Moedas", "Quem manda paga", "Quem faz a live recebe"],
        linhas: [
          ["100", "R$ 6,50", "R$ 3,25"],
          ["1.000", "R$ 65,00", "R$ 32,50"],
          ["10.000", "R$ 650,00", "R$ 325,00"],
          ["50.000", "R$ 3.250,00", "R$ 1.625,00"],
        ],
      },
      {
        tipo: "p",
        texto:
          "No Brasil, o pacote de moedas costuma sair entre R$ 0,05 e R$ 0,10 por moeda, conforme o tamanho do pacote e o lugar da compra. Por isso a tabela é uma estimativa.",
      },
      {
        tipo: "p-link",
        antes: "Para fazer a conta com o número exato de moedas e o dólar de hoje, use a nossa ",
        ancora: "calculadora de moedas do TikTok em reais",
        href: "/calculadora-moedas-tiktok",
        depois: ". É grátis e funciona no celular.",
      },
      { tipo: "h2", texto: "Por que o valor de verdade pode mudar" },
      {
        tipo: "lista",
        itens: [
          "O TikTok não publica uma tabela oficial de valores.",
          "O preço das moedas muda com o país, a loja de aplicativo e as promoções.",
          "O saque dos diamantes pode ter taxas e impostos.",
          "A cotação do dólar no dia do saque é outra.",
        ],
      },
      { tipo: "h2", texto: "Dá para apoiar uma live sem gastar moeda" },
      {
        tipo: "p",
        texto:
          "Numa live de loja pequena, como a nossa, comentar, curtir e compartilhar já ajuda muito: live com conversa costuma aparecer para mais gente. E se gostar de alguma peça, comprar pela sacolinha da live ajuda de verdade.",
      },
      {
        tipo: "p-link",
        antes: "A gente faz live mostrando roupinha infantil e achadinhos. Enquanto isso, ",
        ancora: "veja os achadinhos da Império",
        href: "/pedido",
        depois: " e siga @imperiobemkids no TikTok. 💜",
      },
    ],
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);

export const formatarData = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
