/*
  Calendario de Tamanhos no servidor, para a pagina Minha lista. E a mesma conta
  de lowticket/ofertas/ibk-enxoval/entregavel/calendario.py, que e a referencia:
  mudou la, muda aqui. Os numeros (trocas, fatores, pesos) sao o produto e o
  repositorio e publico, entao nao ficam no codigo: vem cifrados de entregaveis/
  e so saem do servidor ja calculados, para pedido pago.

  quantidade = arredonda para cima(trocas por dia x dias entre lavagens x fator do tamanho x peso da estacao)
  peso da estacao = media dos pesos da peca nos meses em que o bebe usa aquele tamanho
*/

type Estacao = "Q" | "A" | "F";
type Grupo = "inicio" | "meio" | "fim";

export type DadosCalendario = {
  meses: string[];
  estacoes: Record<Estacao, string>;
  tamanhos: { codigo: string; idade: string; altura: string; meses_de_vida: number[]; grupo: Grupo; fator: number }[];
  regioes: { nome: string; descricao: string; meses: Estacao[] }[];
  pecas: { id: string; nome: string; trocas: Record<Grupo, number>; pesos: Record<Estacao, number> }[];
  sem_tamanho: { nome: string; qtd: number; obs: string }[];
  dias_entre_lavagens_padrao: number;
  dias_entre_lavagens_opcoes: number[];
};

export type TamanhoLista = {
  tamanho: string;
  idade: string;
  altura: string;
  periodo: string;
  estacao: string;
  pecas: { id: string; nome: string; qtd: number }[];
};

export type Lista = {
  mes: string;
  regiao: string;
  dias: number;
  tamanhos: TamanhoLista[];
  semTamanho: { nome: string; qtd: number; obs: string }[];
};

const mesDoCalendario = (mesParto: number, mesDeVida: number) => ((mesParto - 1 + mesDeVida - 1) % 12) + 1;

function rotuloEstacao(d: DadosCalendario, estacoes: Estacao[]) {
  const contagem = new Map<Estacao, number>();
  for (const e of estacoes) contagem.set(e, (contagem.get(e) ?? 0) + 1);
  // quem tem mais meses vem primeiro; empate na ordem frio, meia-estacao, calor
  const ordem = [...contagem.keys()].sort(
    (a, b) => (contagem.get(b) ?? 0) - (contagem.get(a) ?? 0) || "FAQ".indexOf(a) - "FAQ".indexOf(b),
  );
  return ordem.map((e) => d.estacoes[e]).join(" e ");
}

function periodo(d: DadosCalendario, meses: number[]) {
  const nome = (m: number) => d.meses[m - 1];
  return meses.length === 1 ? nome(meses[0]) : `${nome(meses[0])} a ${nome(meses[meses.length - 1])}`;
}

export function montarLista(d: DadosCalendario, mesParto: number, nomeRegiao: string, dias: number): Lista | null {
  const regiao = d.regioes.find((r) => r.nome === nomeRegiao);
  if (!regiao) return null;
  const tamanhos = d.tamanhos.map((t) => {
    const meses = t.meses_de_vida.map((k) => mesDoCalendario(mesParto, k));
    const estacoes = meses.map((m) => regiao.meses[m - 1]);
    const pecas = d.pecas.map((p) => {
      const peso = estacoes.reduce((soma, e) => soma + p.pesos[e], 0) / estacoes.length;
      const bruto = p.trocas[t.grupo] * dias * t.fator * peso;
      // mesma conta da planilha: ROUNDUP(ROUND(x, 6), 0), para nao errar por ruido de ponto flutuante
      return { id: p.id, nome: p.nome, qtd: Math.ceil(Number(bruto.toFixed(6))) };
    });
    return {
      tamanho: t.codigo,
      idade: t.idade,
      altura: t.altura,
      periodo: periodo(d, meses),
      estacao: rotuloEstacao(d, estacoes),
      pecas,
    };
  });
  return { mes: d.meses[mesParto - 1], regiao: regiao.nome, dias, tamanhos, semTamanho: d.sem_tamanho };
}
