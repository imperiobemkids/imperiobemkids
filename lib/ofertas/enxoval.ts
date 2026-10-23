/*
  GERADO, nao edite a mao. Fonte: lowticket/ofertas/ibk-enxoval/oferta.json
  (versao 1) e a tabela do Calendario de Tamanhos.
  Para mudar a copy, mude a oferta e rode pagina/exportar_pagina.py.
*/

export const OFERTA_ENXOVAL = {
  "id": "ibk-enxoval",
  "versao": 1,
  "nome": "Enxoval na Medida: o enxoval pelo mês do parto",
  "nomeCurto": "Enxoval na Medida",
  "preco": 19.9,
  "precoTexto": "R$ 19,90",
  "headline": "Feche o enxoval em uma tarde, com a quantidade certa de cada tamanho",
  "subheadline": "O Calendário de Tamanhos liga o mês previsto do parto à estação de cada tamanho e monta sua lista com as quantidades, peça por peça.",
  "bullets": [
    "A planilha que mostra em que estação o bebê vai usar cada tamanho",
    "Quantas peças de cada tipo comprar em RN, P, M, G e GG, com o porquê de cada número",
    "O que não comprar agora e o que deixar para o chá de bebê",
    "Onde dá para economizar e onde vale comprar novo",
    "Lista final para imprimir e riscar o que já tem",
    "Garantia de 7 dias: se não ajudar, o dinheiro volta"
  ],
  "cta": "Quero meu enxoval na medida",
  "promessa": "Feche o enxoval do seu bebê em uma tarde, com a quantidade certa de cada tamanho para a estação em que ele vai usar.",
  "mecanismo": {
    "nome": "Calendário de Tamanhos",
    "oQueE": "Você coloca o mês previsto do parto na planilha. Ela mostra em que meses o bebê deve usar cada tamanho (RN, P, M, G e GG) e, portanto, em que estação do ano. Com isso diz quantas peças de cada tipo comprar em cada tamanho, e se é manga curta ou longa.",
    "porQueFunciona": "Quando cada tamanho está ligado a um mês do ano, fica claro quanto e o que comprar: o bebê que nasce em março, por exemplo, deve usar o tamanho M entre junho e setembro, no frio. A quantidade de cada peça passa a seguir o tempo que o bebê fica naquele tamanho.",
    "porQueORestoFalha": "Lista de loja é feita para vender, e lista de internet não sabe quando o seu bebê nasce. As duas tratam todo bebê igual, então a gestante compra de tudo em todos os tamanhos e descobre depois que parte não serviu ou não era da estação. A culpa não é dela, é da lista."
  },
  "tentativas": [
    "Listas de enxoval de loja, feitas para vender mais",
    "Listas gratuitas da internet, que tratam todo bebê igual",
    "Kits grandes comprados na promoção, cheios de peça repetida",
    "Conselhos de parentes que se contradizem"
  ],
  "produto": {
    "descricao": "Planilha Calendário de Tamanhos (Google Sheets e Excel) com guia em PDF de cerca de 25 páginas. A planilha monta a lista pelo mês do parto; o guia explica cada número e o que não comprar.",
    "quickWin": "Logo depois da compra, a gestante coloca o mês previsto do parto na planilha e vê quantas peças de cada tamanho precisa, já riscando o que ganhou ou já tem.",
    "paginas": 25,
    "capitulos": [
      {
        "titulo": "Como usar o Calendário de Tamanhos",
        "objetivo": "Gerar a lista personalizada em 10 minutos"
      },
      {
        "titulo": "Quantas peças de cada tamanho",
        "objetivo": "Entregar o coração da promessa"
      },
      {
        "titulo": "Manga curta ou longa: a estação de cada tamanho",
        "objetivo": "Evitar peça fora de estação"
      },
      {
        "titulo": "O que não comprar agora",
        "objetivo": "Remover gasto antes que ele aconteça"
      },
      {
        "titulo": "Onde vale economizar e onde não",
        "objetivo": "Responder à objeção de custo"
      },
      {
        "titulo": "Lista final e guarda-roupa organizado",
        "objetivo": "Fechar com tudo pronto"
      }
    ]
  },
  "bonus": [
    {
      "nome": "Lista do chá de bebê pronta para mandar",
      "descricao": "Lista dirigida por tamanho e a mensagem pronta para os convidados, para o chá completar o enxoval em vez de repetir peça RN."
    },
    {
      "nome": "Etiquetas de tamanho para as gavetas",
      "descricao": "Etiquetas RN, P, M e G para separar o guarda-roupa e achar cada peça na hora certa."
    }
  ],
  "garantia": {
    "dias": 7,
    "texto": "Use a planilha por 7 dias. Se ela não ajudar você a fechar o enxoval, devolvemos seu dinheiro, sem perguntas."
  },
  "avisos": [
    "As faixas de tamanho são aproximadas e variam entre marcas; confira a tabela de cada fabricante.",
    "Confira com a sua maternidade a lista de itens que ela exige na internação."
  ],
  "exemplo": {
    "mes": "março",
    "regiao": "Sudeste e Centro-Oeste",
    "dias": 3,
    "tamanhos": [
      {
        "tamanho": "RN",
        "altura": "até 50 cm",
        "periodo": "março",
        "estacao": "calor",
        "total": 10
      },
      {
        "tamanho": "P",
        "altura": "50 a 60 cm",
        "periodo": "março a maio",
        "estacao": "meia-estação e calor",
        "total": 22
      },
      {
        "tamanho": "M",
        "altura": "60 a 66 cm",
        "periodo": "junho a agosto",
        "estacao": "frio e meia-estação",
        "total": 23
      },
      {
        "tamanho": "G",
        "altura": "66 a 72 cm",
        "periodo": "setembro a novembro",
        "estacao": "calor e meia-estação",
        "total": 14
      },
      {
        "tamanho": "GG",
        "altura": "72 a 78 cm",
        "periodo": "dezembro a fevereiro",
        "estacao": "calor",
        "total": 9
      }
    ],
    "bodiesInicio": 14,
    "totalPecas": 78,
    "pecasP": {
      "Body manga curta": 6,
      "Body manga longa": 3,
      "Calça ou mijão": 3,
      "Shortinho ou culote": 2,
      "Macacão": 2,
      "Casaquinho ou moletom": 1,
      "Meia (pares)": 4,
      "Touca": 1
    }
  }
} as const;
