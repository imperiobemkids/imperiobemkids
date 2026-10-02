"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Canal } from "../canais/CanaisClient";
import { calcularTaxas, descreverFaixas } from "@/lib/canais";
import { acharOuCriarCliente } from "@/lib/clientes";
import { registrarVenda, FIADO } from "@/lib/pedidos";
import { num, txt, brl, hojeIso, pct } from "@/lib/formato";

/*
  Registro de venda no formato de caixa: o produto entra como linha com preco
  unitario e subtotal, e o total e a soma dos itens menos desconto mais frete.
  Antes o preco ficava so na venda, entao vender dois produtos diferentes na
  mesma venda nao registrava quanto foi cada um.
*/

export type ProdutoVenda = {
  id: string;
  nome: string | null;
  linha: string | null;
  genero: string | null;
  tamanho: string | null;
  custo_unit: number;
  preco_venda: number | null;
  qtd_atual: number;
};

/*
  precoTexto guarda o TEXTO digitado, nao um numero: convertendo a cada tecla,
  "49," virava "49" e a virgula sumia antes dos centavos.
  A linha tem id proprio (nao o do produto) para o mesmo produto poder entrar
  duas vezes com precos diferentes na mesma venda.
*/
type Linha = { id: string; produto: ProdutoVenda; qtd: number; precoTexto: string };

// numero para texto com virgula, usado so quando o sistema preenche o campo

export const rotulo = (p: ProdutoVenda) => {
  if (p.nome && p.nome.trim()) return p.nome.trim() + (p.tamanho ? ` · ${p.tamanho}` : "");
  const linha = p.linha === "verao" ? "Verão" : p.linha === "inverno" ? "Inverno" : "";
  return [linha, p.genero, p.tamanho].filter(Boolean).join(" · ") || "Produto";
};

export function NovaVenda({
  produtos,
  canais,
  aoRegistrar,
}: {
  produtos: ProdutoVenda[];
  canais: Canal[];
  aoRegistrar: () => void;
}) {
  const hoje = hojeIso();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [canalId, setCanalId] = useState(canais[0]?.id ?? "");
  const [data, setData] = useState(hoje);
  const [cliente, setCliente] = useState("");
  const [pedidoExterno, setPedidoExterno] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase?.from("ibk_clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data ?? []));
  }, []);
  const [desconto, setDesconto] = useState("0");
  const [descontoPct, setDescontoPct] = useState("0");
  const [freteCobrado, setFreteCobrado] = useState("0"); // pago pelo cliente, entra na receita
  const [freteLoja, setFreteLoja] = useState("0"); // pago pela loja, e custo
  const [formaPagamento, setFormaPagamento] = useState("");
  const [vencimento, setVencimento] = useState(""); // so no fiado
  const [totalTexto, setTotalTexto] = useState("0");
  const [editandoTotal, setEditandoTotal] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // os canais chegam depois da primeira renderizacao, entao o padrao e definido aqui
  useEffect(() => {
    if (!canalId && canais.length) setCanalId(canais[0].id);
  }, [canais, canalId]);

  const canal = canais.find((c) => c.id === canalId);
  const insumo = canal?.insumo_custo ?? 0.4;

  // cada clique cria uma linha nova, mesmo se o produto ja estiver na venda
  const adicionar = () => {
    const p = produtos.find((x) => x.id === escolhido);
    if (!p) return;
    setErro("");
    setLinhas((ls) => [
      ...ls,
      {
        id: crypto.randomUUID(),
        produto: p,
        qtd: 1,
        precoTexto: p.preco_venda ? txt(p.preco_venda) : "",
      },
    ]);
    setEscolhido("");
  };

  const mudar = (id: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remover = (id: string) => setLinhas((ls) => ls.filter((l) => l.id !== id));

  /*
    Fechamento. O desconto e a fonte da verdade e o total sai dele, mas o campo
    do total tambem e editavel: quando o Richard digita o valor que o cliente
    pagou de fato (cupom da plataforma, negociacao), o desconto se ajusta sozinho.
    Frete cobrado do cliente entra na receita; frete pago pela loja e custo.
  */
  const subtotal = linhas.reduce((s, l) => s + num(l.precoTexto) * l.qtd, 0);
  const descontoN = Math.min(num(desconto), subtotal);
  const freteCobradoN = num(freteCobrado);
  const freteLojaN = num(freteLoja);
  const total = subtotal - descontoN + freteCobradoN;

  /*
    A tarifa fixa e cobrada por item do pedido e a faixa sai do preco de cada
    item, nao do total. O calculo fica em lib/canais para venda e precificacao
    usarem a mesma regra.
  */
  const taxas = calcularTaxas(
    canal,
    linhas.map((l) => ({ precoUnit: num(l.precoTexto), qtd: l.qtd })),
    descontoN,
  );
  const comissao = taxas.comissao;
  const taxaFixa = taxas.fixa;
  const taxaPct = total > 0 ? comissao / total : 0;
  const regraFaixas = descreverFaixas(canal);

  const custoProdutos = linhas.reduce((s, l) => s + l.produto.custo_unit * l.qtd, 0);
  const lucro = total - comissao - taxaFixa - insumo - custoProdutos - freteLojaN;

  /*
    O campo do total tem texto proprio. Enquanto esta em foco o sistema nao
    reescreve nele, senao a virgula seria apagada a cada tecla (o total se
    recalcula a partir do desconto que a propria digitacao acabou de mudar).
  */
  useEffect(() => {
    if (!editandoTotal) setTotalTexto(txt(total));
  }, [total, editandoTotal]);

  const mudarTotal = (v: string) => {
    setTotalTexto(v);
    const d = Math.max(0, subtotal + freteCobradoN - num(v));
    setDesconto(txt(d));
    setDescontoPct(subtotal > 0 ? txt((d / subtotal) * 100) : "0");
  };
  const mudarDescontoValor = (v: string) => {
    setDesconto(v);
    setDescontoPct(subtotal > 0 ? txt((num(v) / subtotal) * 100) : "0");
  };
  const mudarDescontoPct = (v: string) => {
    setDescontoPct(v);
    setDesconto(txt((num(v) / 100) * subtotal));
  };

  const registrar = async () => {
    if (!supabase) return;
    if (linhas.length === 0) return setErro("adicione ao menos um produto");
    if (total <= 0) return setErro("informe o preço dos produtos");
    // fiado sem nome vira divida de ninguem
    if (formaPagamento === FIADO && !cliente.trim()) return setErro("no fiado, informe quem vai pagar (campo Cliente)");
    // o mesmo produto pode estar em varias linhas, entao soma antes de conferir o estoque
    const porProduto = new Map<string, { p: ProdutoVenda; qtd: number }>();
    for (const l of linhas) {
      const atual = porProduto.get(l.produto.id);
      porProduto.set(l.produto.id, { p: l.produto, qtd: (atual?.qtd ?? 0) + l.qtd });
    }
    for (const { p, qtd } of porProduto.values()) {
      if (qtd > p.qtd_atual) {
        return setErro(`estoque insuficiente de ${rotulo(p)}: pedindo ${qtd}, tem ${p.qtd_atual}`);
      }
    }
    setErro("");
    setSalvando(true);

    const balcao = !!canal && /fisica/i.test(canal.nome);
    let r: Awaited<ReturnType<typeof registrarVenda>>;
    try {
      r = await registrarVenda({
        data,
        canalNome: canal?.nome ?? "outro",
        canalId: canalId || null,
        itens: linhas.map((l) => ({ produtoId: l.produto.id, qtd: l.qtd, precoUnit: num(l.precoTexto) })),
        total,
        desconto: descontoN,
        comissao,
        taxaFixa,
        insumo,
        freteCobrado: freteCobradoN,
        frete: freteLojaN,
        cliente: cliente.trim() || null,
        clienteId: await acharOuCriarCliente(cliente, balcao ? "loja" : undefined),
        pedidoExterno: pedidoExterno.trim() || null,
        // venda no balcao ja saiu entregue; o resto precisa ser enviado
        status: balcao ? "entregue" : "aguardando",
        formaPagamento: formaPagamento || null,
        vencimento: formaPagamento === FIADO ? vencimento || null : null,
      });
    } catch (e) {
      r = { erro: e instanceof Error ? e.message : "erro ao registrar a venda" };
    }
    if ("erro" in r) {
      setErro(r.erro);
      setSalvando(false);
      return;
    }

    setSalvando(false);
    setLinhas([]);
    setCliente("");
    setDesconto("0");
    setDescontoPct("0");
    setFreteCobrado("0");
    setFreteLoja("0");
    setVencimento("");
    aoRegistrar();
  };

  // a lista nao filtra o que ja foi adicionado: o mesmo produto pode entrar de novo

  return (
    <div className="card p-4">
      {/* dados da venda */}
      <div className="flex flex-wrap items-end gap-2">
        <Campo label="Data">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
        </Campo>
        <Campo label="Canal">
          <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={inp}>
            {canais.length === 0 && <option value="">cadastre em Canais</option>}
            {canais.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </Campo>
        <Campo label="Nº do pedido">
          <input value={pedidoExterno} onChange={(e) => setPedidoExterno(e.target.value)} placeholder="da Shopee / TikTok" className={`${inp} w-40`} />
        </Campo>
        <Campo label="Cliente (opcional)">
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="nome" list="clientes-lista" className={`${inp} w-40`} />
          <datalist id="clientes-lista">
            {clientes.map((c) => (<option key={c.id} value={c.nome} />))}
          </datalist>
        </Campo>
      </div>

      {/* adicionar produto */}
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--purple)]/10 pt-4">
        <Campo label="Adicionar produto">
          <select
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            className={`${inp} min-w-[200px]`}
          >
            <option value="">selecione...</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {rotulo(p)} ({p.qtd_atual} em estoque)
              </option>
            ))}
          </select>
        </Campo>
        <button
          onClick={adicionar}
          disabled={!escolhido}
          className="rounded-xl bg-[var(--purple)]/10 px-4 py-2 text-sm font-extrabold text-[var(--purple)] hover:bg-[var(--purple)]/20 disabled:opacity-40"
        >
          + adicionar
        </button>
      </div>

      {/* itens da venda */}
      {linhas.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-[var(--purple)]/20 p-5 text-center text-sm text-[var(--ink)]/70">
          nenhum produto na venda ainda
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[10px] uppercase text-[var(--ink)]/70">
                <th className="py-2">Produto</th>
                <th className="py-2">Qtd</th>
                <th className="py-2">Preço un.</th>
                <th className="py-2">Subtotal</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="py-2 pr-2 font-semibold text-[var(--ink)]">{rotulo(l.produto)}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      value={l.qtd}
                      onChange={(e) => mudar(l.id, { qtd: parseInt(e.target.value, 10) || 1 })}
                      className={`${inp} w-16`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      inputMode="decimal"
                      value={l.precoTexto}
                      onChange={(e) => mudar(l.id, { precoTexto: e.target.value })}
                      placeholder="0,00"
                      className={`${inp} w-24`}
                    />
                  </td>
                  <td className="py-2 pr-2 font-bold text-[var(--purple-dark)]">{brl(num(l.precoTexto) * l.qtd)}</td>
                  <td className="py-2">
                    <button onClick={() => remover(l.id)} className="text-xs font-bold text-red-400 hover:text-red-600">
                      remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* fechamento */}
      {linhas.length > 0 && (
        <div className="mt-4 grid gap-4 border-t border-[var(--purple)]/10 pt-4 lg:grid-cols-2">
          {/* fechamento editavel */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--ink)]/70">Subtotal dos produtos</span>
              <span className="font-bold text-[var(--ink)]">{brl(subtotal)}</span>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Campo label="Desconto R$">
                <input inputMode="decimal" value={desconto} onChange={(e) => mudarDescontoValor(e.target.value)} className={`${inp} w-24`} />
              </Campo>
              <Campo label="Desconto %">
                <input inputMode="decimal" value={descontoPct} onChange={(e) => mudarDescontoPct(e.target.value)} className={`${inp} w-20`} />
              </Campo>
              <Campo label="Frete cobrado do cliente">
                <input inputMode="decimal" value={freteCobrado} onChange={(e) => setFreteCobrado(e.target.value)} className={`${inp} w-28`} />
              </Campo>
            </div>

            {/* o total e editavel: digitar aqui recalcula o desconto */}
            <label className="flex flex-col gap-1 rounded-xl bg-[var(--purple)]/8 p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--purple)]">
                Total da venda (base de cálculo da comissão)
              </span>
              <input
                inputMode="decimal"
                value={totalTexto}
                onChange={(e) => mudarTotal(e.target.value)}
                onFocus={() => setEditandoTotal(true)}
                onBlur={() => setEditandoTotal(false)}
                placeholder="0,00"
                className="w-full rounded-lg border-2 border-[var(--purple)]/30 bg-white px-3 py-2 font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)] outline-none focus:border-[var(--purple)]"
              />
              <span className="text-[11px] text-[var(--ink)]/70">
                digite o valor sobre o qual a plataforma cobra a taxa. Em marketplace é o
                subtotal dos produtos, mesmo que o comprador tenha pago menos com moedas ou
                cupom da plataforma, porque esse desconto não sai do seu bolso
              </span>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Campo label="Forma de pagamento">
                <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={inp}>
                  <option value="">nao informada</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="boleto">Boleto</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                  <option value="marketplace">Pelo marketplace</option>
                  <option value={FIADO}>Fiado (paga depois)</option>
                </select>
              </Campo>
              {formaPagamento === FIADO && (
                <Campo label="Combinou pagar até">
                  <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inp} />
                </Campo>
              )}
              <Campo label="Frete pago pela loja">
                <input inputMode="decimal" value={freteLoja} onChange={(e) => setFreteLoja(e.target.value)} className={`${inp} w-28`} />
              </Campo>
            </div>
          </div>

          {/* resultado */}
          <div className="self-start rounded-xl bg-[var(--cream)] p-3 text-sm">
            <Linha2 rotulo="Total da venda" valor={brl(total)} forte />
            <div className="my-2 border-t border-[var(--purple)]/15" />
            <Linha2 rotulo={`Comissão ${canal?.nome ?? ""} (${pct(taxaPct)})`} valor={`− ${brl(comissao)}`} sutil />
            {regraFaixas && (
              <p className="py-0.5 text-[11px] leading-snug text-[var(--ink)]/70">
                faixa aplicada pelo total: {regraFaixas}
              </p>
            )}
            {taxaFixa > 0 && (
              <Linha2
                rotulo={`Tarifa fixa (${taxas.unidades} ${taxas.unidades === 1 ? "item" : "itens"})`}
                valor={`− ${brl(taxaFixa)}`}
                sutil
              />
            )}
            <Linha2 rotulo="Embalagem" valor={`− ${brl(insumo)}`} sutil />
            <Linha2 rotulo="Custo dos produtos" valor={`− ${brl(custoProdutos)}`} sutil />
            {freteLojaN > 0 && <Linha2 rotulo="Frete pago pela loja" valor={`− ${brl(freteLojaN)}`} sutil />}
            <div className="my-2 border-t border-[var(--purple)]/15" />
            <Linha2 rotulo="Lucro da venda" valor={brl(lucro)} forte positivo={lucro >= 0} />
            {total > 0 && (
              <p className="mt-1 text-right text-[11px] text-[var(--ink)]/70">
                margem de {Math.round((lucro / total) * 100)}%
              </p>
            )}
          </div>
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-semibold text-red-500">{erro}</p>}

      <div className="mt-4 flex justify-end">
        <button
          onClick={registrar}
          disabled={salvando || linhas.length === 0}
          className="rounded-xl bg-[var(--purple)] px-6 py-3 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-50"
        >
          {salvando ? "registrando..." : `registrar venda ${linhas.length ? brl(total) : ""}`}
        </button>
      </div>
    </div>
  );
}

const inp =
  "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-2 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}

function Linha2({
  rotulo, valor, forte, sutil, positivo,
}: { rotulo: string; valor: string; forte?: boolean; sutil?: boolean; positivo?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={sutil ? "text-[var(--ink)]/75" : "text-[var(--ink)]/75"}>{rotulo}</span>
      <span
        className={`${forte ? "font-[family-name:var(--font-baloo)] text-base font-extrabold" : "font-semibold"} ${
          positivo === false ? "text-red-500" : forte ? "text-[var(--purple-dark)]" : "text-[var(--ink)]/70"
        }`}
      >
        {valor}
      </span>
    </div>
  );
}
