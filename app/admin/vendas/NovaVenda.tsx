"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saidaEstoque } from "@/lib/estoque";
import type { Canal } from "../canais/CanaisClient";

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
  O preco fica como TEXTO no estado, nao como numero. Guardando numero, a cada
  tecla o valor era convertido e devolvido formatado, entao "49," virava "49" e
  a virgula sumia antes de digitar os centavos.
*/
type Linha = { produto: ProdutoVenda; qtd: number; precoTexto: string };

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
// numero para texto com virgula, usado so quando o sistema preenche o campo
const txt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

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
  const hoje = new Date().toISOString().slice(0, 10);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [canalId, setCanalId] = useState(canais[0]?.id ?? "");
  const [data, setData] = useState(hoje);
  const [cliente, setCliente] = useState("");
  const [desconto, setDesconto] = useState("0");
  const [descontoPct, setDescontoPct] = useState("0");
  const [freteCobrado, setFreteCobrado] = useState("0"); // pago pelo cliente, entra na receita
  const [freteLoja, setFreteLoja] = useState("0"); // pago pela loja, e custo
  const [formaPagamento, setFormaPagamento] = useState("");
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
  const taxaPct = canal?.taxa_pct ?? 0.2;
  const taxaFixa = canal?.taxa_fixa ?? 0;
  const insumo = canal?.insumo_custo ?? 0.4;

  const adicionar = () => {
    const p = produtos.find((x) => x.id === escolhido);
    if (!p) return;
    setErro("");
    setLinhas((ls) => {
      const existe = ls.find((l) => l.produto.id === p.id);
      if (existe) return ls.map((l) => (l.produto.id === p.id ? { ...l, qtd: l.qtd + 1 } : l));
      return [...ls, { produto: p, qtd: 1, precoTexto: p.preco_venda ? txt(p.preco_venda) : "" }];
    });
    setEscolhido("");
  };

  const mudar = (id: string, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.produto.id === id ? { ...l, ...patch } : l)));
  const remover = (id: string) => setLinhas((ls) => ls.filter((l) => l.produto.id !== id));

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

  const custoProdutos = linhas.reduce((s, l) => s + l.produto.custo_unit * l.qtd, 0);
  const comissao = total * taxaPct;
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
    for (const l of linhas) {
      if (l.qtd > l.produto.qtd_atual) {
        return setErro(`estoque insuficiente de ${rotulo(l.produto)} (tem ${l.produto.qtd_atual})`);
      }
    }
    setErro("");
    setSalvando(true);

    const { data: venda, error: e1 } = await supabase
      .from("ibk_vendas")
      .insert({
        data,
        canal: canal ? canal.nome.toLowerCase().slice(0, 20) : "outro",
        canal_id: canalId || null,
        tipo: linhas.length > 1 ? "kit" : "avulso",
        cliente: cliente.trim() || null,
        forma_pagamento: formaPagamento || null,
        preco_venda: total,
        desconto: descontoN,
        taxa_pct: taxaPct,
        taxa_fixa: taxaFixa,
        insumo_custo: insumo,
        frete_cobrado: freteCobradoN,
        frete: freteLojaN,
      })
      .select("id")
      .single();
    if (e1 || !venda) {
      setErro(e1?.message ?? "erro ao criar a venda");
      setSalvando(false);
      return;
    }

    const { error: e2 } = await supabase.from("ibk_venda_itens").insert(
      linhas.map((l) => ({
        venda_id: venda.id,
        produto_id: l.produto.id,
        qtd: l.qtd,
        preco_unit: num(l.precoTexto),
      })),
    );
    if (e2) {
      setErro(e2.message);
      setSalvando(false);
      return;
    }

    for (const l of linhas) {
      await saidaEstoque(l.produto.id, l.qtd, "venda", { vendaId: venda.id, data });
    }

    const nomeCanal = canal?.nome ?? "canal";
    const movs: Record<string, unknown>[] = [
      { data, tipo: "entrada", categoria: "venda", valor: total, descricao: `Venda ${nomeCanal}${cliente ? ` para ${cliente}` : ""}`, ref_venda_id: venda.id },
    ];
    if (comissao > 0) movs.push({ data, tipo: "saida", categoria: "taxa_shopee", valor: comissao, descricao: `Comissão ${nomeCanal}`, ref_venda_id: venda.id });
    if (taxaFixa > 0) movs.push({ data, tipo: "saida", categoria: "taxa_shopee", valor: taxaFixa, descricao: `Tarifa fixa ${nomeCanal}`, ref_venda_id: venda.id });
    await supabase.from("ibk_movimentos").insert(movs);

    setSalvando(false);
    setLinhas([]);
    setCliente("");
    setDesconto("0");
    setDescontoPct("0");
    setFreteCobrado("0");
    setFreteLoja("0");
    aoRegistrar();
  };

  const disponiveis = produtos.filter((p) => !linhas.some((l) => l.produto.id === p.id));

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(109,40,184,0.1)]">
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
        <Campo label="Cliente (opcional)">
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="nome ou pedido" className={`${inp} w-40`} />
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
            {disponiveis.map((p) => (
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
        <p className="mt-4 rounded-xl border-2 border-dashed border-[var(--purple)]/20 p-5 text-center text-sm text-[var(--ink)]/50">
          nenhum produto na venda ainda
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[10px] uppercase text-[var(--ink)]/45">
                <th className="py-2">Produto</th>
                <th className="py-2">Qtd</th>
                <th className="py-2">Preço un.</th>
                <th className="py-2">Subtotal</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.produto.id} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="py-2 pr-2 font-semibold text-[var(--ink)]">{rotulo(l.produto)}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      value={l.qtd}
                      onChange={(e) => mudar(l.produto.id, { qtd: parseInt(e.target.value, 10) || 1 })}
                      className={`${inp} w-16`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      inputMode="decimal"
                      value={l.precoTexto}
                      onChange={(e) => mudar(l.produto.id, { precoTexto: e.target.value })}
                      placeholder="0,00"
                      className={`${inp} w-24`}
                    />
                  </td>
                  <td className="py-2 pr-2 font-bold text-[var(--purple-dark)]">{brl(num(l.precoTexto) * l.qtd)}</td>
                  <td className="py-2">
                    <button onClick={() => remover(l.produto.id)} className="text-xs font-bold text-red-400 hover:text-red-600">
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
                Total da venda (o que o cliente pagou)
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
              <span className="text-[11px] text-[var(--ink)]/50">
                pode digitar direto o valor do pedido; o desconto se ajusta sozinho
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
                </select>
              </Campo>
              <Campo label="Frete pago pela loja">
                <input inputMode="decimal" value={freteLoja} onChange={(e) => setFreteLoja(e.target.value)} className={`${inp} w-28`} />
              </Campo>
            </div>
          </div>

          {/* resultado */}
          <div className="self-start rounded-xl bg-[var(--cream)] p-3 text-sm">
            <Linha2 rotulo="Total da venda" valor={brl(total)} forte />
            <div className="my-2 border-t border-[var(--purple)]/15" />
            <Linha2 rotulo={`Comissão ${canal?.nome ?? ""} (${Math.round(taxaPct * 100)}%)`} valor={`− ${brl(comissao)}`} sutil />
            {taxaFixa > 0 && <Linha2 rotulo="Tarifa fixa" valor={`− ${brl(taxaFixa)}`} sutil />}
            <Linha2 rotulo="Embalagem" valor={`− ${brl(insumo)}`} sutil />
            <Linha2 rotulo="Custo dos produtos" valor={`− ${brl(custoProdutos)}`} sutil />
            {freteLojaN > 0 && <Linha2 rotulo="Frete pago pela loja" valor={`− ${brl(freteLojaN)}`} sutil />}
            <div className="my-2 border-t border-[var(--purple)]/15" />
            <Linha2 rotulo="Lucro da venda" valor={brl(lucro)} forte positivo={lucro >= 0} />
            {total > 0 && (
              <p className="mt-1 text-right text-[11px] text-[var(--ink)]/50">
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
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}

function Linha2({
  rotulo, valor, forte, sutil, positivo,
}: { rotulo: string; valor: string; forte?: boolean; sutil?: boolean; positivo?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={sutil ? "text-[var(--ink)]/55" : "text-[var(--ink)]/75"}>{rotulo}</span>
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
