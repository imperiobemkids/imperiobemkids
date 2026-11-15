/*
  Guarda-roupa ate os 3 anos no servidor, para a pagina Meu guarda-roupa. E a
  mesma conta de lowticket/ofertas/ibk-enxoval/upsell/guarda_roupa.py, que e a
  referencia: mudou la, muda aqui. Os numeros vem cifrados de entregaveis/,
  como os do enxoval, e so saem do servidor ja calculados, para pedido pago.

  Depois do 1o aniversario cada tamanho dura um ano e passa por todas as
  estacoes, entao cada tamanho tem o guarda-roupa de calor e o de frio:
  quantidade = arredonda para cima(trocas por dia do tamanho x dias entre lavagens x peso da peca no guarda-roupa)
  O mes e o ano de nascimento mudam QUANDO cada guarda-roupa entra em uso.
*/

type Estacao = "Q" | "A" | "F";
type IdGuardaRoupa = "calor" | "frio";

export type DadosGuardaRoupa = {
  meses: string[];
  estacoes: Record<Estacao, string>;
  regioes: { nome: string; descricao: string; meses: Estacao[] }[];
  dias_entre_lavagens_padrao: number;
  dias_entre_lavagens_opcoes: number[];
  virada_meses: number;
  proximo_tamanho: string;
  tamanhos: { codigo: string; idade: string; altura: string; ate_cm: number }[];
  guarda_roupas: { id: IdGuardaRoupa; nome: string; codigos: Estacao[]; peso: "Q" | "F" }[];
  pecas: { id: string; nome: string; trocas: Record<string, number>; pesos: Record<"Q" | "F", number> }[];
};

export type MesGuardaRoupa = {
  rotulo: string;
  idade: string;
  codigo: Estacao;
  estacao: string;
  usa: string; // guarda-roupa em uso: calor, frio ou os dois
  tamanho: string; // "1", ou "1 ou 2" na virada
  virada: boolean;
};

export type BlocoGuardaRoupa = {
  id: string;
  tamanho: string;
  idade: string;
  altura: string;
  guardaRoupa: IdGuardaRoupa;
  meses: number;
  desde: string;
  periodos: string;
  virada: string; // meses deste guarda-roupa que caem na virada, ou ""
  pecas: { id: string; nome: string; qtd: number }[];
  total: number;
};

export type TamanhoGuardaRoupa = {
  codigo: string;
  idade: string;
  altura: string;
  ateCm: number;
  proximo: string;
  quando: string;
  meca: string; // a partir de quando medir antes de comprar
};

export type GuardaRoupa = {
  mes: string;
  ano: number;
  regiao: string;
  dias: number;
  tamanhos: TamanhoGuardaRoupa[];
  blocos: BlocoGuardaRoupa[];
  calendario: MesGuardaRoupa[];
};

const USA: Record<Estacao, string> = { Q: "calor", F: "frio", A: "calor e frio" };

// anos que a pagina oferece: quem compra costuma estar gravida ou com bebe pequeno
export function anosDeNascimento(hoje = new Date()): number[] {
  const atual = hoje.getFullYear();
  return [atual - 3, atual - 2, atual - 1, atual, atual + 1];
}

type MesInterno = MesGuardaRoupa & { i: number; curto: string; codigoTamanho: string };

// "mar/2027" ou "mar/2027 a mai/2027 e ago/2027 a fev/2028": os trechos seguidos
function periodos(meses: MesInterno[]): string {
  const trechos: MesInterno[][] = [];
  for (const m of meses) {
    const atual = trechos.at(-1);
    if (atual && m.i === atual.at(-1)!.i + 1) atual.push(m);
    else trechos.push([m]);
  }
  return trechos.map((t) => (t.length === 1 ? t[0].curto : `${t[0].curto} a ${t.at(-1)!.curto}`)).join(" e ");
}

export function montarGuardaRoupa(
  d: DadosGuardaRoupa,
  mesNasc: number,
  anoNasc: number,
  nomeRegiao: string,
  dias: number,
  codigos?: string[],
): GuardaRoupa | null {
  const regiao = d.regioes.find((r) => r.nome === nomeRegiao);
  if (!regiao) return null;
  const tamanhos = d.tamanhos.filter((t) => !codigos || codigos.includes(t.codigo));
  const proximo = (codigo: string) => d.tamanhos[d.tamanhos.findIndex((t) => t.codigo === codigo) + 1]?.codigo ?? d.proximo_tamanho;

  const calendario: MesInterno[] = [];
  for (const t of tamanhos) {
    const ordem = d.tamanhos.indexOf(t);
    for (let m = 0; m < 12; m++) {
      const i = ordem * 12 + m; // meses desde o 1o aniversario
      const desloc = mesNasc - 1 + 12 + i;
      const mes = (desloc % 12) + 1;
      const ano = anoNasc + Math.floor(desloc / 12);
      const anos = 1 + Math.floor(i / 12);
      const nomeMes = d.meses[mes - 1];
      const codigo = regiao.meses[mes - 1];
      const virada = m >= 12 - d.virada_meses;
      calendario.push({
        i,
        rotulo: `${nomeMes} de ${ano}`,
        curto: `${nomeMes.slice(0, 3)}/${ano}`,
        idade: `${anos} ano${anos > 1 ? "s" : ""}` + (m ? ` e ${m} ${m === 1 ? "mês" : "meses"}` : ""),
        codigo,
        estacao: d.estacoes[codigo],
        usa: USA[codigo],
        tamanho: virada ? `${t.codigo} ou ${proximo(t.codigo)}` : t.codigo,
        codigoTamanho: t.codigo,
        virada,
      });
    }
  }

  const blocos: (BlocoGuardaRoupa & { primeiro: number })[] = [];
  for (const t of tamanhos) {
    const doTamanho = calendario.filter((m) => m.codigoTamanho === t.codigo);
    for (const g of d.guarda_roupas) {
      const uso = doTamanho.filter((m) => g.codigos.includes(m.codigo));
      if (!uso.length) continue; // regiao sem frio: o guarda-roupa de frio nao existe
      const pecas = d.pecas.map((p) => {
        const bruto = (p.trocas[t.codigo] ?? 0) * dias * p.pesos[g.peso];
        // mesma conta da planilha: ROUNDUP(ROUND(x, 6), 0)
        return { id: p.id, nome: p.nome, qtd: Math.ceil(Number(bruto.toFixed(6))) };
      });
      blocos.push({
        id: `${t.codigo}-${g.id}`,
        tamanho: t.codigo,
        idade: t.idade,
        altura: t.altura,
        guardaRoupa: g.id,
        meses: uso.length,
        primeiro: uso[0].i,
        desde: uso[0].curto,
        periodos: periodos(uso),
        virada: periodos(uso.filter((m) => m.virada)),
        pecas: pecas.filter((p) => p.qtd > 0),
        total: pecas.reduce((n, p) => n + p.qtd, 0),
      });
    }
  }
  // ordem de compra: o que a crianca usa primeiro vem primeiro (sort estavel, calor antes no empate)
  blocos.sort((a, b) => a.primeiro - b.primeiro || Number(a.guardaRoupa !== "calor") - Number(b.guardaRoupa !== "calor"));

  return {
    mes: d.meses[mesNasc - 1],
    ano: anoNasc,
    regiao: regiao.nome,
    dias,
    tamanhos: tamanhos.map((t) => {
      const ano = calendario.filter((m) => m.codigoTamanho === t.codigo);
      return {
        codigo: t.codigo,
        idade: t.idade,
        altura: t.altura,
        ateCm: t.ate_cm,
        proximo: proximo(t.codigo),
        quando: `${ano[0].curto} a ${ano[11].curto}`,
        meca: ano[12 - d.virada_meses].curto,
      };
    }),
    blocos: blocos.map(({ primeiro: _, ...b }) => b),
    calendario: calendario.map(({ i: _i, curto: _c, codigoTamanho: _t, ...m }) => m),
  };
}
