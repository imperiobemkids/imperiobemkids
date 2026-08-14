"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { calcularTaxas } from "@/lib/canais";
import type { Canal } from "../canais/CanaisClient";

/*
  Detalhe da venda: mostra os itens com preco unitario e a quebra da taxa, e
  permite corrigir os dados do pedido.

  O que da para editar aqui: data, cliente, forma de pagamento e o total.
  Mexer no total refaz a comissao e os lancamentos de caixa daquela venda.
  Trocar os itens NAO entra aqui de proposito, porque mexeria no estoque: para
  isso o caminho e devolver a venda e registrar de novo.
*/

export type VendaDetalhe = {
  id: string;
  data: string;
  canal: string;
  canal_id: string | null;
  cliente: string | null;
  forma_pagamento: string | null;
  preco_venda: number;
  desconto: number;
  taxa_pct: number;
  taxa_fixa: number;
  insumo_custo: number;
  frete: number;
  frete_cobrado: number;
  devolvida: boolean;
  custo_devolucao: number;
  qtd_itens: number;
  ibk_venda_itens: {
    qtd: number;
    preco_unit: number;
    produto_id: string | null;
    produto: { nome: string | null; tamanho: string | null; cor: string | null; custo_unit: number } | null;
  }[];
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const num = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
const txt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");

const nomeItem = (i: VendaDetalhe["ibk_venda_itens"][number]) => {
  const p = i.produto;
  if (!p) return "produto removido";
  const base = p.nome?.trim() || "Produto";
  return [base, p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ");
};

export function DetalheVenda({
  venda,
  canais,
  onFechar,
  onSalvo,
}: {
  venda: VendaDetalhe;
  canais: Canal[];
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState(venda.data);
  const [cliente, setCliente] = useState(venda.cliente ?? "");
  const [forma, setForma] = useState(venda.forma_pagamento ?? "");
  const [totalTexto, setTotalTexto] = useState(txt(venda.preco_venda));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const canal = canais.find((c) => c.id === venda.canal_id);
  const custoProdutos = venda.ibk_venda_itens.reduce(
    (s, i) => s + (i.produto?.custo_unit ?? 0) * i.qtd,
    0,
  );
  const comissao = venda.preco_venda * venda.taxa_pct;
  const lucro = venda.devolvida
    ? -(venda.custo_devolucao ?? 0)
    : venda.preco_venda - comissao - (venda.taxa_fixa ?? 0) - venda.insumo_custo - venda.frete - custoProdutos;

  const salvar = async () => {
    if (!supabase) return;
    setErro("");
    setSalvando(true);
    const novoTotal = num(totalTexto);

    // se o total mudou, a comissao e o caixa daquela venda precisam acompanhar
    const mudouTotal = Math.abs(novoTotal - venda.preco_venda) > 0.001;
    const taxas = mudouTotal
      ? calcularTaxas(
          canal,
          venda.ibk_venda_itens.map((i) => ({ precoUnit: i.preco_unit, qtd: i.qtd })),
          Math.max(0, venda.ibk_venda_itens.reduce((s, i) => s + i.preco_unit * i.qtd, 0) - novoTotal),
        )
      : null;

    const { error } = await supabase
      .from("ibk_vendas")
      .update({
        data,
        cliente: cliente.trim() || null,
        forma_pagamento: forma || null,
        ...(taxas
          ? {
              preco_venda: novoTotal,
              taxa_pct: novoTotal > 0 ? taxas.comissao / novoTotal : 0,
              taxa_fixa: taxas.fixa,
            }
          : {}),
      })
      .eq("id", venda.id);
    if (error) {
      setErro(error.message);
      setSalvando(false);
      return;
    }

    if (taxas) {
      // refaz os lancamentos de caixa desta venda, para o saldo nao ficar torto
      await supabase.from("ibk_movimentos").delete().eq("ref_venda_id", venda.id);
      const nomeCanal = canal?.nome ?? venda.canal;
      const movs: Record<string, unknown>[] = [
        { data, tipo: "entrada", categoria: "venda", valor: novoTotal, descricao: `Venda ${nomeCanal}`, ref_venda_id: venda.id },
      ];
      if (taxas.comissao > 0) movs.push({ data, tipo: "saida", categoria: "taxa_shopee", valor: taxas.comissao, descricao: `Comissão ${nomeCanal}`, ref_venda_id: venda.id });
      if (taxas.fixa > 0) movs.push({ data, tipo: "saida", categoria: "taxa_shopee", valor: taxas.fixa, descricao: `Tarifa fixa ${nomeCanal}`, ref_venda_id: venda.id });
      await supabase.from("ibk_movimentos").insert(movs);
    }

    setSalvando(false);
    setEditando(false);
    onSalvo();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onFechar}>
      <div className="mt-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-baloo)] text-xl font-extrabold text-[var(--purple-dark)]">
              Venda de {new Date(venda.data + "T12:00:00").toLocaleDateString("pt-BR")}
            </h2>
            <p className="text-sm capitalize text-[var(--ink)]/60">
              {venda.canal}
              {venda.cliente ? ` · ${venda.cliente}` : ""}
              {venda.forma_pagamento ? ` · ${venda.forma_pagamento}` : ""}
              {venda.devolvida && " · devolvida"}
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg bg-[var(--purple)]/8 px-3 py-1.5 text-sm font-bold text-[var(--purple)]">
            fechar
          </button>
        </div>

        {/* itens */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--purple)]/15">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--purple)]/10 text-[10px] uppercase text-[var(--ink)]/45">
                <th className="p-2.5">Produto</th>
                <th className="p-2.5">Qtd</th>
                <th className="p-2.5">Preço un.</th>
                <th className="p-2.5">Subtotal</th>
                <th className="hidden p-2.5 sm:table-cell">Custo</th>
              </tr>
            </thead>
            <tbody>
              {venda.ibk_venda_itens.map((i, idx) => (
                <tr key={idx} className="border-b border-[var(--purple)]/6 last:border-0">
                  <td className="p-2.5 font-semibold text-[var(--ink)]">{nomeItem(i)}</td>
                  <td className="p-2.5">{i.qtd}</td>
                  <td className="p-2.5">{brl(i.preco_unit)}</td>
                  <td className="p-2.5 font-bold text-[var(--purple-dark)]">{brl(i.preco_unit * i.qtd)}</td>
                  <td className="hidden p-2.5 text-[var(--ink)]/55 sm:table-cell">{brl((i.produto?.custo_unit ?? 0) * i.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* quebra ate o lucro */}
        <div className="mt-4 rounded-xl bg-[var(--cream)] p-3 text-sm">
          <Linha rotulo="Total da venda" valor={brl(venda.preco_venda)} forte />
          {venda.desconto > 0 && <Linha rotulo="Desconto aplicado" valor={brl(venda.desconto)} sutil />}
          <div className="my-2 border-t border-[var(--purple)]/15" />
          <Linha rotulo={`Comissão (${Math.round(venda.taxa_pct * 1000) / 10}%)`} valor={`− ${brl(comissao)}`} sutil />
          {venda.taxa_fixa > 0 && (
            <Linha rotulo={`Tarifa fixa (${venda.qtd_itens || venda.ibk_venda_itens.length} itens)`} valor={`− ${brl(venda.taxa_fixa)}`} sutil />
          )}
          <Linha rotulo="Embalagem" valor={`− ${brl(venda.insumo_custo)}`} sutil />
          <Linha rotulo="Custo dos produtos" valor={`− ${brl(custoProdutos)}`} sutil />
          {venda.frete > 0 && <Linha rotulo="Frete pago pela loja" valor={`− ${brl(venda.frete)}`} sutil />}
          <div className="my-2 border-t border-[var(--purple)]/15" />
          <Linha rotulo="Lucro" valor={brl(lucro)} forte positivo={lucro >= 0} />
          {venda.preco_venda > 0 && !venda.devolvida && (
            <p className="mt-1 text-right text-[11px] text-[var(--ink)]/50">
              margem de {Math.round((lucro / venda.preco_venda) * 100)}%
            </p>
          )}
        </div>

        {/* edicao */}
        {editando ? (
          <div className="mt-4 rounded-xl border-2 border-[var(--purple)]/25 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <Campo label="Data">
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
              </Campo>
              <Campo label="Cliente">
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} className={`${inp} w-40`} />
              </Campo>
              <Campo label="Forma de pagamento">
                <select value={forma} onChange={(e) => setForma(e.target.value)} className={inp}>
                  <option value="">nao informada</option>
                  <option value="pix">Pix</option>
                  <option value="cartao">Cartão</option>
                  <option value="boleto">Boleto</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência</option>
                  <option value="marketplace">Pelo marketplace</option>
                </select>
              </Campo>
              <Campo label="Total da venda">
                <input inputMode="decimal" value={totalTexto} onChange={(e) => setTotalTexto(e.target.value)} className={`${inp} w-28`} />
              </Campo>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink)]/50">
              Mudar o total refaz a comissão e os lançamentos de caixa desta venda. Para trocar
              os produtos, devolva a venda e registre de novo, senão o estoque fica errado.
            </p>
            {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={salvar} disabled={salvando} className="rounded-xl bg-[var(--purple)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60">
                {salvando ? "salvando..." : "salvar"}
              </button>
              <button onClick={() => setEditando(false)} className="rounded-xl bg-[var(--purple)]/8 px-4 py-2 text-sm font-bold text-[var(--purple)]">
                cancelar
              </button>
            </div>
          </div>
        ) : (
          !venda.devolvida && (
            <button onClick={() => setEditando(true)} className="mt-4 rounded-xl bg-[var(--purple)]/8 px-4 py-2.5 text-sm font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16">
              editar venda
            </button>
          )
        )}
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

function Linha({ rotulo, valor, forte, sutil, positivo }: { rotulo: string; valor: string; forte?: boolean; sutil?: boolean; positivo?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={sutil ? "text-[var(--ink)]/55" : "text-[var(--ink)]/75"}>{rotulo}</span>
      <span className={`${forte ? "font-[family-name:var(--font-baloo)] text-base font-extrabold" : "font-semibold"} ${positivo === false ? "text-red-500" : forte ? "text-[var(--purple-dark)]" : "text-[var(--ink)]/70"}`}>
        {valor}
      </span>
    </div>
  );
}
