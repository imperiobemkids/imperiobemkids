/*
  Avaliacoes REAIS do Enxoval na Medida, mostradas na pagina /enxoval.

  Regras, sem excecao:
  - So entra opiniao de quem usou de verdade, com autorizacao por escrito para publicar
    o primeiro nome e a cidade. Guarde o print da conversa e anote em `autorizacao`.
  - O texto e o da pessoa. Pode corrigir digitacao, nunca mudar o sentido nem juntar falas.
  - Quem ganhou a planilha para testar fica com `ganhouParaTestar: true`, e a pagina mostra isso.
  - Nada inventado: depoimento falso e publicidade enganosa (CDC art. 37) e vai contra o CONAR.

  Enquanto a lista estiver vazia, a secao de avaliacoes nao aparece.
*/

export type Avaliacao = {
  nome: string; // so o primeiro nome
  cidade: string; // "Cidade/UF"
  texto: string;
  nota: 1 | 2 | 3 | 4 | 5;
  data: string; // ISO, quando a pessoa mandou
  ganhouParaTestar: boolean;
  autorizacao: string; // onde esta o print da autorizacao, ex.: "WhatsApp 05/11/2026"
};

export const AVALIACOES: Avaliacao[] = [];
