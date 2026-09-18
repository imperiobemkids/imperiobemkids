"use client";

import { useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { btnPrimario, btnSecundario } from "../ui";

/*
  Conferencia do lote no recebimento. Quem revende roupa infantil responde
  pelo que vende: a etiqueta textil (composicao, tamanho, CNPJ do fabricante)
  e obrigatoria e cordao em capuz ou cintura tem regra do Inmetro para 0 a 14
  anos. Conferir aqui e a prova de que foi olhado.
*/
export type Conferencia = {
  qtd_pedida: number;
  qtd_recebida: number;
  etiqueta_ok: boolean;
  cordoes_ok: boolean;
  avarias: number;
  obs: string;
};

export function ConferirLote({
  loteId,
  qtdPedida,
  atual,
  onFechar,
  onSalvo,
}: {
  loteId: string;
  qtdPedida: number;
  atual: Conferencia | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [f, setF] = useState<Conferencia>(
    atual ?? { qtd_pedida: qtdPedida, qtd_recebida: qtdPedida, etiqueta_ok: true, cordoes_ok: true, avarias: 0, obs: "" },
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    if (!supabase) return;
    setSalvando(true);
    setErro("");
    const { error } = await supabase
      .from("ibk_lotes")
      .update({ conferido_em: new Date().toISOString().slice(0, 10), conferencia: f })
      .eq("id", loteId);
    setSalvando(false);
    if (error) return setErro(error.message);
    onSalvo();
  };

  const faltou = f.qtd_pedida - f.qtd_recebida;
  const problema = faltou > 0 || !f.etiqueta_ok || !f.cordoes_ok || f.avarias > 0;

  return (
    <div className="rounded-xl border-2 border-[var(--purple)]/20 bg-[var(--cream)] p-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Campo label="Pedido (un)">
          <input value={f.qtd_pedida} onChange={(e) => setF({ ...f, qtd_pedida: parseInt(e.target.value) || 0 })} inputMode="numeric" className={`${inp} num w-20`} />
        </Campo>
        <Campo label="Chegou (un)">
          <input value={f.qtd_recebida} onChange={(e) => setF({ ...f, qtd_recebida: parseInt(e.target.value) || 0 })} inputMode="numeric" className={`${inp} num w-20`} autoFocus />
        </Campo>
        <Campo label="Com avaria">
          <input value={f.avarias} onChange={(e) => setF({ ...f, avarias: parseInt(e.target.value) || 0 })} inputMode="numeric" className={`${inp} num w-20`} />
        </Campo>
        <Toggle label="Etiqueta têxtil ok" dica="composição, tamanho e CNPJ do fabricante em toda peça" on={f.etiqueta_ok} onChange={(v) => setF({ ...f, etiqueta_ok: v })} />
        <Toggle label="Cordões ok" dica="sem cordão solto em capuz ou cintura (Inmetro 0 a 14 anos)" on={f.cordoes_ok} onChange={(v) => setF({ ...f, cordoes_ok: v })} />
        <Campo label="Obs">
          <input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="o que faltou, o que veio errado" className={`${inp} w-56`} />
        </Campo>
      </div>
      {faltou > 0 && <p className="mt-2 text-xs font-semibold text-red-600">faltaram {faltou} unidades: cobre o fornecedor e ajuste o estoque no kardex.</p>}
      {erro && <p className="mt-2 text-xs font-semibold text-red-500">{erro}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={salvar} disabled={salvando} className={`flex items-center gap-1 ${btnPrimario} ${problema ? "" : ""}`}>
          <Check size={14} weight="bold" /> {salvando ? "salvando..." : problema ? "salvar com pendência" : "conferido, tudo certo"}
        </button>
        <button onClick={onFechar} className={`flex items-center gap-1 ${btnSecundario}`}>
          <X size={14} weight="bold" /> fechar
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, dica, on, onChange }: { label: string; dica: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      title={dica}
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${
        on ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded ${on ? "bg-emerald-500 text-white" : "bg-red-400 text-white"}`}>
        {on ? <Check size={10} weight="bold" /> : <X size={10} weight="bold" />}
      </span>
      {label}
    </button>
  );
}

const inp = "rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase text-[var(--ink)]/45">{label}</span>
      {children}
    </label>
  );
}
