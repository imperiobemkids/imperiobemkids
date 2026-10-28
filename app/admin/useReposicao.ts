"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { calcularReposicao, type ItemEstoque } from "@/lib/reposicao";
import { diasAtrasIso } from "@/lib/formato";

/*
  Quantos itens estao para repor, pela mesma regra do Estoque e do Painel
  (lib/reposicao). Vai no menu para o aviso aparecer em qualquer tela; recarrega
  a cada troca de pagina, entao uma baixa feita em Movimentar ja aparece aqui.
*/
export function useReposicao() {
  const pathname = usePathname();
  const [total, setTotal] = useState<{ itens: number; zerados: number } | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    let vivo = true;
    (async () => {
      const [{ data: ps }, { data: itens }] = await Promise.all([
        supabase!
          .from("ibk_produtos")
          .select("id, nome, linha, genero, tamanho, cor, qtd_atual, estoque_minimo, tem_variacoes, produto_pai_id, fornecedor_id")
          .eq("ativo", true),
        supabase!
          .from("ibk_venda_itens")
          .select("produto_id, qtd, venda:ibk_vendas!inner(data, status)")
          .gte("venda.data", diasAtrasIso(30))
          .not("venda.status", "in", '("cancelado","devolvido")'),
      ]);
      if (!vivo || !ps) return;
      const vendidos = new Map<string, number>();
      for (const it of (itens as { produto_id: string | null; qtd: number }[]) ?? []) {
        if (it.produto_id) vendidos.set(it.produto_id, (vendidos.get(it.produto_id) ?? 0) + it.qtd);
      }
      const lista = calcularReposicao(ps as ItemEstoque[], vendidos);
      setTotal({ itens: lista.length, zerados: lista.filter((r) => r.p.qtd_atual === 0).length });
    })();
    return () => {
      vivo = false;
    };
  }, [pathname]);

  return total;
}
