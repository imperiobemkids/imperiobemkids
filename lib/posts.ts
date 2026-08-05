/*
  Conteudo do blog. Fica em arquivo mesmo (sem banco) porque sao poucos textos
  e assim a pagina e estatica e rapida. Para publicar um post novo, acrescente
  um item aqui: a listagem, a rota e o sitemap se atualizam sozinhos.
*/

export type Bloco =
  | { tipo: "p"; texto: string }
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
    slug: "guia-de-tamanhos-roupa-infantil",
    titulo: "Guia de tamanhos de roupa infantil: como acertar de primeira",
    resumo:
      "A dúvida que mais chega no nosso WhatsApp. Uma tabela de referência e o jeito simples de medir sem erro.",
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
        tipo: "p",
        texto:
          "E se bater dúvida, chama a gente no WhatsApp. A gente confere a medida do kit junto com você antes de fechar o pedido. 💜",
      },
    ],
  },
  {
    slug: "quantas-roupas-crianca-precisa",
    titulo: "Quantas roupas uma criança realmente precisa?",
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
        tipo: "p",
        texto:
          "Se quiser, a gente monta uma sugestão de enxoval enxuto para a idade do seu filho. É só chamar. 💜",
      },
    ],
  },
  {
    slug: "como-fazer-roupa-infantil-durar-mais",
    titulo: "Como fazer a roupa infantil durar mais",
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
        tipo: "p",
        texto:
          "Peça bem cuidada ainda passa para o irmão mais novo ou é revendida. Cuidar é economia. 💜",
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
