"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { grupoDoProduto } from "@/lib/estoque";
import { nomeExibido } from "@/lib/reposicao";
import { EMPRESA } from "@/lib/empresa";
import { baixarPlanilhaContagem, imprimirContagem, ordemTamanho, salvarFolha, type LinhaContagem, type LinhaFolha } from "@/lib/contagem";
import { btnPrimario, btnSecundario } from "../ui";

type Item = {
  id: string;
  nome: string | null;
  categoria: string | null;
  linha: "verao" | "inverno" | null;
  genero: "menino" | "menina" | "unissex" | null;
  tamanho: string | null;
  cor: string | null;
  qtd_atual: number;
  produto_pai_id: string | null;
};

const INSUMOS = "Insumos (embalagem)";
// grupos de roupa primeiro, na ordem da prateleira; o resto em ordem alfabetica e insumos no fim
const peso = (g: string) => (g === "Roupas de verão" ? 0 : g === "Roupas de inverno" ? 1 : g === INSUMOS ? 3 : 2);

/*
  Painel do botao "Folha de contagem": monta uma linha por peca que se conta
  (cada variacao ou o produto simples) e imprime ou baixa em planilha. A folha
  e salva antes, numerada e com codigo, para ser lancada na tela Contagem.
*/
export function FolhaContagem({ produtos, onFechar }: { produtos: Item[]; onFechar: () => void }) {
  const [mostrarSistema, setMostrarSistema] = useState(true);
  const [zerados, setZerados] = useState(true);
  const [insumosLig, setInsumosLig] = useState(true);
  const [grupo, setGrupo] = useState("todos");
  const [insumos, setInsumos] = useState<{ id: string; nome: string; qtd_atual: number }[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  // a folha ja salva para estas linhas: imprimir de novo nao cria outra
  const [folha, setFolha] = useState<{ id: string; codigo: string | null; linhas: LinhaFolha[]; assinatura: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase
      ?.from("ibk_insumos")
      .select("id, nome, qtd_atual")
      .order("nome")
      .then(({ data }) => setInsumos((data as { id: string; nome: string; qtd_atual: number }[]) ?? []));
  }, []);

  const linhasProdutos: LinhaContagem[] = produtos
    .filter((p) => !p.produto_pai_id)
    .flatMap((pai) => {
      const filhos = produtos.filter((f) => f.produto_pai_id === pai.id);
      const base = { grupo: grupoDoProduto(pai), produto: nomeExibido(pai) };
      return (filhos.length ? filhos : [pai]).map((p) => ({
        ...base,
        tamanho: p.tamanho ?? "",
        cor: p.cor ?? "",
        sistema: p.qtd_atual,
        tipo: "produto" as const,
        id: p.id,
      }));
    });
  const linhasInsumos: LinhaContagem[] = insumos.map((i) => ({
    grupo: INSUMOS,
    produto: i.nome,
    tamanho: "",
    cor: "",
    sistema: Number(i.qtd_atual),
    tipo: "insumo" as const,
    id: i.id,
  }));
  const grupos = [...new Set([...linhasProdutos, ...linhasInsumos].map((l) => l.grupo))].sort((a, b) => peso(a) - peso(b) || a.localeCompare(b, "pt-BR"));

  const linhas = [...linhasProdutos, ...(insumosLig ? linhasInsumos : [])]
    .filter((l) => zerados || l.sistema > 0)
    .filter((l) => grupo === "todos" || l.grupo === grupo)
    .sort(
      (a, b) =>
        peso(a.grupo) - peso(b.grupo) ||
        a.grupo.localeCompare(b.grupo, "pt-BR") ||
        a.produto.localeCompare(b.produto, "pt-BR") ||
        ordemTamanho(a.tamanho, b.tamanho) ||
        a.cor.localeCompare(b.cor, "pt-BR"),
    );

  const recorte = grupo === "todos" ? "todo o estoque" : grupo;
  const assinatura = JSON.stringify([mostrarSistema, recorte, linhas.map((l) => [l.id, l.sistema])]);

  /* salva a folha (uma vez para as mesmas linhas) e devolve as linhas numeradas com o codigo */
  const garantirFolha = async () => {
    if (folha && folha.assinatura === assinatura) return folha;
    const salva = await salvarFolha(linhas, { recorte, mostrarSistema });
    const nova = salva
      ? { ...salva, assinatura }
      : { id: "", codigo: null, linhas: linhas.map((l, i) => ({ ...l, n: i + 1 })), assinatura };
    setAviso(salva ? "" : "A folha saiu sem código porque a tabela de contagens ainda não existe: rode a migration 0035 no SQL Editor do Supabase.");
    setFolha(nova);
    return nova;
  };

  const imprimir = async () => {
    setErro("");
    setSalvando(true);
    try {
      const f = await garantirFolha();
      imprimirContagem(f.linhas, {
        mostrarSistema,
        logoUrl: `${window.location.origin}/logo.png`,
        marca: EMPRESA.nomeFantasia,
        recorte,
        codigo: f.codigo,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao imprimir");
    }
    setSalvando(false);
  };

  const baixar = async () => {
    setErro("");
    setSalvando(true);
    const f = await garantirFolha();
    baixarPlanilhaContagem(f.linhas, { mostrarSistema, codigo: f.codigo });
    setSalvando(false);
  };

  const opcao = (rotulo: string, dica: string, valor: boolean, set: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-[var(--purple)]/6 px-3 py-2 text-sm">
      <input type="checkbox" checked={valor} onChange={(e) => set(e.target.checked)} className="mt-0.5 accent-[var(--purple)]" />
      <span>
        <span className="font-bold text-[var(--ink)]">{rotulo}</span>
        <span className="block text-[11px] text-[var(--ink)]/65">{dica}</span>
      </span>
    </label>
  );

  return (
    <div className="card fade-in mt-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">Folha de contagem</h2>
          <p className="text-xs text-[var(--ink)]/70">
            Uma linha por tamanho e cor, separada por grupo, com espaço para escrever o que foi contado. Imprima ou baixe em planilha.
            Folha já contada?{" "}
            <Link href="/admin/estoque/contagem" className="font-bold text-[var(--purple)] underline">Lance a contagem</Link>.
          </p>
        </div>
        <button onClick={onFechar} className={btnSecundario}>fechar</button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {opcao("Mostrar o sistema", "desmarque para contar às cegas, sem ver o número do ERP", mostrarSistema, setMostrarSistema)}
        {opcao("Incluir zerados", "confere se o que está zerado está mesmo vazio", zerados, setZerados)}
        {opcao("Incluir insumos", "sacos e etiquetas de envio", insumosLig, setInsumosLig)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold text-[var(--ink)]/80">
          Contar
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="ml-2 rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2 text-sm">
            <option value="todos">todo o estoque</option>
            {grupos.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-[var(--ink)]/65">{linhas.length} linhas</span>
        <div className="ml-auto flex gap-2">
          <button onClick={baixar} disabled={!linhas.length || salvando} className={btnSecundario}>
            baixar planilha
          </button>
          <button onClick={imprimir} disabled={!linhas.length || salvando} className={btnPrimario}>
            imprimir folha
          </button>
        </div>
      </div>
      {folha?.codigo && folha.assinatura === assinatura && (
        <p className="mt-3 rounded-xl bg-[var(--mint)]/25 px-3 py-2 text-sm text-[var(--ink)]">
          Folha <b>#{folha.codigo}</b> salva. Depois de contar,{" "}
          <Link href={`/admin/estoque/contagem?folha=${folha.id}`} className="font-bold text-[var(--purple)] underline">
            lance a contagem
          </Link>{" "}
          digitando ou pela foto das páginas.
        </p>
      )}
      {aviso && <p className="mt-2 text-sm font-semibold text-amber-700">{aviso}</p>}
      {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}
    </div>
  );
}
