"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { calcularTaxas } from "@/lib/canais";
import { num, txt, brl, pct } from "@/lib/formato";
import { STATUS, estornarVenda, hojeIso, estornada, lucroDaVenda, type StatusPedido } from "@/lib/pedidos";
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
  status: StatusPedido;
  pedido_externo: string | null;
  rastreio: string | null;
  enviado_em: string | null;
  entregue_em: string | null;
  nf_numero: string | null;
  nf_chave: string | null;
  recebido?: number | null;
  obs_conciliacao?: string | null;
  ibk_venda_itens: {
    qtd: number;
    preco_unit: number;
    produto_id: string | null;
    produto: { nome: string | null; tamanho: string | null; cor: string | null; custo_unit: number } | null;
  }[];
};


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

  // ciclo do pedido
  const [rastreio, setRastreio] = useState(venda.rastreio ?? "");
  const [nfNumero, setNfNumero] = useState(venda.nf_numero ?? "");
  const [nfChave, setNfChave] = useState(venda.nf_chave ?? "");
  const [pedidoExterno, setPedidoExterno] = useState(venda.pedido_externo ?? "");
  const [confirmando, setConfirmando] = useState<"cancelar" | "devolver" | null>(null);
  const [custoDev, setCustoDev] = useState("0");
  const status: StatusPedido = venda.status ?? (venda.devolvida ? "devolvido" : "entregue");

  const mudarStatus = async (novo: StatusPedido) => {
    if (!supabase) return;
    setErro("");
    setSalvando(true);
    const hoje = hojeIso();
    const patch: Record<string, unknown> = { status: novo, pedido_externo: pedidoExterno.trim() || null };
    if (novo === "enviado") {
      patch.rastreio = rastreio.trim() || null;
      patch.enviado_em = venda.enviado_em ?? hoje;
    }
    if (novo === "entregue") patch.entregue_em = venda.entregue_em ?? hoje;
    const { error } = await supabase.from("ibk_vendas").update(patch).eq("id", venda.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    onSalvo();
  };

  const salvarPedido = async () => {
    if (!supabase) return;
    setErro("");
    setSalvando(true);
    const { error } = await supabase
      .from("ibk_vendas")
      .update({
        pedido_externo: pedidoExterno.trim() || null,
        rastreio: rastreio.trim() || null,
        nf_numero: nfNumero.trim() || null,
        nf_chave: nfChave.trim() || null,
      })
      .eq("id", venda.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    onSalvo();
  };

  const cancelar = async () => {
    setErro("");
    setSalvando(true);
    const erro = await estornarVenda(venda, "cancelado", 0);
    setSalvando(false);
    if (erro) return setErro(erro);
    onSalvo();
  };

  /* devolucao: peca volta, caixa estorna, e sobra o custo (frete reverso, taxa retida) */
  const devolver = async () => {
    setErro("");
    setSalvando(true);
    const erro = await estornarVenda(venda, "devolvido", num(custoDev));
    setSalvando(false);
    if (erro) return setErro(erro);
    onSalvo();
  };

  const canal = canais.find((c) => c.id === venda.canal_id);
  const custoProdutos = venda.ibk_venda_itens.reduce(
    (s, i) => s + (i.produto?.custo_unit ?? 0) * i.qtd,
    0,
  );
  const comissao = venda.preco_venda * venda.taxa_pct;
  const lucro = lucroDaVenda(venda);
  const foraDoCiclo = estornada(venda.status ?? (venda.devolvida ? "devolvido" : "entregue"));

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
              // venda direta recebida no ato: o recebido acompanha, senao a conciliacao acusa diferenca
              ...(venda.obs_conciliacao === "recebido no ato" ? { recebido: Math.round((novoTotal - (venda.frete ?? 0)) * 100) / 100 } : {}),
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
    } else if (data !== venda.data) {
      // so a data mudou: os lancamentos da venda vao junto, pro caixa do mes bater
      await supabase.from("ibk_movimentos").update({ data }).eq("ref_venda_id", venda.id);
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
              <tr className="border-b border-[var(--purple)]/10 text-[10px] uppercase text-[var(--ink)]/70">
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
                  <td className="hidden p-2.5 text-[var(--ink)]/75 sm:table-cell">{brl((i.produto?.custo_unit ?? 0) * i.qtd)}</td>
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
          <Linha rotulo={`Comissão (${pct(venda.taxa_pct)})`} valor={`− ${brl(comissao)}`} sutil />
          {venda.taxa_fixa > 0 && (
            <Linha rotulo={`Tarifa fixa (${venda.qtd_itens || venda.ibk_venda_itens.length} itens)`} valor={`− ${brl(venda.taxa_fixa)}`} sutil />
          )}
          <Linha rotulo="Embalagem" valor={`− ${brl(venda.insumo_custo)}`} sutil />
          <Linha rotulo="Custo dos produtos" valor={`− ${brl(custoProdutos)}`} sutil />
          {venda.frete > 0 && <Linha rotulo="Frete pago pela loja" valor={`− ${brl(venda.frete)}`} sutil />}
          <div className="my-2 border-t border-[var(--purple)]/15" />
          <Linha rotulo="Lucro" valor={brl(lucro)} forte positivo={lucro >= 0} />
          {venda.preco_venda > 0 && !foraDoCiclo && (
            <p className="mt-1 text-right text-[11px] text-[var(--ink)]/70">
              margem de {Math.round((lucro / venda.preco_venda) * 100)}%
            </p>
          )}
        </div>

        {/* ciclo do pedido: status, rastreio, nota fiscal */}
        <div className="mt-4 rounded-2xl border border-[var(--purple)]/10 bg-[var(--cream)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">Pedido</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS[status].cor}`}>
                {STATUS[status].rotulo}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {status === "aguardando" && (
                <>
                  <button onClick={() => mudarStatus("enviado")} disabled={salvando} className={btnP}>
                    marcar enviado
                  </button>
                  {confirmando === "cancelar" ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-[var(--ink)]/70">estoque e caixa voltam. cancelar?</span>
                      <button onClick={cancelar} disabled={salvando} className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-extrabold text-white">
                        sim
                      </button>
                      <button onClick={() => setConfirmando(null)} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1 text-xs font-bold text-[var(--purple)]">
                        não
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmando("cancelar")} className={btnS}>
                      cancelar pedido
                    </button>
                  )}
                </>
              )}
              {status === "enviado" && (
                <button onClick={() => mudarStatus("entregue")} disabled={salvando} className={btnP}>
                  marcar entregue
                </button>
              )}
              {status === "entregue" &&
                (confirmando === "devolver" ? (
                  <span className="fade-in flex flex-wrap items-end gap-1.5 text-xs">
                    <label className="flex flex-col gap-0.5 text-[10px] font-bold uppercase text-[var(--ink)]/70">
                      custo da devolução (frete reverso, taxa retida)
                      <input value={custoDev} onChange={(e) => setCustoDev(e.target.value)} inputMode="decimal" autoFocus className={`${inp} num w-24 normal-case`} />
                    </label>
                    <button onClick={devolver} disabled={salvando} className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-extrabold text-white disabled:opacity-60">
                      {salvando ? "..." : "devolver"}
                    </button>
                    <button onClick={() => setConfirmando(null)} className="rounded-lg bg-[var(--purple)]/8 px-2.5 py-1.5 text-xs font-bold text-[var(--purple)]">
                      não
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmando("devolver")} className={btnS}>
                    registrar devolução
                  </button>
                ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Campo label="Nº do pedido na plataforma">
              <input value={pedidoExterno} onChange={(e) => setPedidoExterno(e.target.value)} placeholder="ex: 2509171234ABCD" className={`${inp} num`} />
            </Campo>
            <Campo label="Código de rastreio">
              <input value={rastreio} onChange={(e) => setRastreio(e.target.value)} placeholder="BR123456789BR" className={`${inp} num`} />
            </Campo>
            <Campo label="Nota fiscal (número)">
              <input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} placeholder="000123" className={`${inp} num`} />
            </Campo>
            <Campo label="Chave da NF-e (44 dígitos)">
              <input value={nfChave} onChange={(e) => setNfChave(e.target.value)} placeholder="opcional" className={`${inp} num`} />
            </Campo>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink)]/70">
            <span>
              {venda.enviado_em && `enviado em ${new Date(venda.enviado_em + "T12:00:00").toLocaleDateString("pt-BR")}`}
              {venda.entregue_em && ` · entregue em ${new Date(venda.entregue_em + "T12:00:00").toLocaleDateString("pt-BR")}`}
            </span>
            <button onClick={salvarPedido} disabled={salvando} className={btnS}>
              {salvando ? "salvando..." : "salvar dados do pedido"}
            </button>
          </div>
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
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink)]/70">
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
          !foraDoCiclo && (
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

const btnP = "rounded-lg bg-[var(--purple)] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[var(--purple-dark)] disabled:opacity-60";
const btnS = "rounded-lg bg-[var(--purple)]/8 px-3 py-1.5 text-xs font-bold text-[var(--purple)] hover:bg-[var(--purple)]/16 disabled:opacity-60";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/70">{label}</span>
      {children}
    </label>
  );
}

function Linha({ rotulo, valor, forte, sutil, positivo }: { rotulo: string; valor: string; forte?: boolean; sutil?: boolean; positivo?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={sutil ? "text-[var(--ink)]/75" : "text-[var(--ink)]/75"}>{rotulo}</span>
      <span className={`${forte ? "font-[family-name:var(--font-baloo)] text-base font-extrabold" : "font-semibold"} ${positivo === false ? "text-red-500" : forte ? "text-[var(--purple-dark)]" : "text-[var(--ink)]/70"}`}>
        {valor}
      </span>
    </div>
  );
}
