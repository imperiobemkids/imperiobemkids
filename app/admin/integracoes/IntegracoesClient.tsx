"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowsClockwise, CheckCircle, CloudArrowDown, CloudArrowUp, LinkSimple, Plug, Warning } from "@phosphor-icons/react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { dataBr } from "@/lib/formato";
import { acharPorNome, chaveVinculo, conjuntosDoAnuncio, type ProdutoRef } from "@/lib/importacao";
import {
  PLATAFORMAS,
  canalDaPlataforma,
  chamarApi,
  enviarEstoque,
  estoqueDoAnuncio,
  type Plataforma,
  type ResultadoEstoque,
  type Vinculo,
} from "@/lib/integracoes";
import { SetupCard } from "../SetupCard";
import { PageHeader, SkeletonRows, btnPrimario, btnSecundario } from "../ui";

/*
  Integracoes por API com os marketplaces (Shopee e Mercado Livre hoje; TikTok
  Shop e Kwai entram aqui quando o app delas for aprovado). Cada plataforma tem
  uma secao com:
  1) Conexao: o link de autorizacao leva a conta para a plataforma, que volta
     para esta pagina com ?code=; a rota troca o codigo pelos tokens.
  2) Vinculos: cada variacao de anuncio aponta para um produto do estoque e
     diz quantos conjuntos leva (avulso 1, kit 2, kit 3). E o que deixa o
     mesmo conjunto aparecer em varios anuncios: estoque = saldo / conjuntos.
  3) Estoque: envia para a plataforma o numero calculado de cada anuncio.
  Pedidos entram pela tela de importar, na opcao "(direto da loja)".
*/

type Status = {
  configurado: boolean;
  ambiente: "teste" | "producao";
  migracao: boolean;
  retorno?: string | null; // endereco fixo de retorno (Mercado Livre)
  conexao: {
    canal_id: string;
    loja_id: string | null;
    apelido?: string | null;
    ambiente: string;
    access_expira_em: string | null;
    refresh_expira_em: string | null;
    conectado_em: string | null;
    ultima_sync: string | null;
  } | null;
};
type Modelo = { idVariacao: string; nome: string; sku: string; estoque: number; reservado: number; preco: number };
type Anuncio = { idAnuncio: string; titulo: string; sku: string; modelos: Modelo[] };
type Produto = ProdutoRef & { qtd_atual: number };

type Linha = {
  idAnuncio: string;
  idVariacao: string;
  titulo: string;
  variacao: string;
  sku: string;
  naPlataforma: number | null; // null = ainda nao leu os anuncios
  reservado: number;
  produtoId: string; // "" = sem vinculo
  conjuntos: number;
  salvo: boolean; // ja existe no banco
  sugerido: boolean; // produto veio da sugestao por nome, nao foi salvo
  alterado: boolean; // mexido na tela depois de salvo
};

// pedido de conexao em andamento nesta aba (state confere a volta; verifier e o PKCE do ML)
type Pendente = { plataforma?: Plataforma; state?: string; canalId?: string | null; verifier?: string };
const ESTADO = "ibk-integracao-pendente";
const lerPendente = (): Pendente => {
  try {
    return JSON.parse(sessionStorage.getItem(ESTADO) ?? "{}") as Pendente;
  } catch {
    return {};
  }
};

const COM_API = (Object.keys(PLATAFORMAS) as Plataforma[]).filter((k) => PLATAFORMAS[k].api);

export function IntegracoesClient() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [versao, setVersao] = useState(0); // muda depois de conectar: as secoes releem
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [colado, setColado] = useState("");
  const [concluindo, setConcluindo] = useState(false);

  const carregarProdutos = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("ibk_produtos").select("id, nome, tamanho, cor, produto_pai_id, tem_variacoes, qtd_atual").eq("ativo", true).order("nome");
    setProdutos((data as Produto[]) ?? []);
  }, []);

  /*
    Volta da autorizacao. A Shopee devolve ?code=&shop_id=; o Mercado Livre,
    ?code=&state=. O endereco pode vir da barra (retorno nesta pagina) ou
    colado (o ML so volta para o endereco HTTPS cadastrado: testando no
    computador, a volta cai no site e o endereco e colado aqui).
  */
  const concluir = useCallback(async (endereco: string) => {
    setErro("");
    setAviso("");
    let q: URLSearchParams;
    try {
      q = new URL(endereco).searchParams;
    } catch {
      setErro("cole o endereço inteiro da página de retorno (começa com https://)");
      return;
    }
    const code = q.get("code");
    if (!code) {
      setErro("o endereço não tem o código da autorização (?code=)");
      return;
    }
    const pend = lerPendente();
    const shopId = q.get("shop_id");
    const plataforma: Plataforma = shopId ? "shopee" : pend.plataforma ?? "mercadolivre";
    const state = q.get("state");
    /*
      So aceita a volta de um pedido de conexao feito NESTA aba (state igual ao
      guardado ao clicar em conectar). Sem isso, um link com o codigo de outra
      loja aberto por um admin ligaria a loja de terceiros ao ERP. Por isso a
      conexao e sempre pelo botao daqui, nao pelo "Authorize" do console da Shopee.
    */
    if (!state || !pend.state || state !== pend.state || (pend.plataforma && pend.plataforma !== plataforma)) {
      setErro("a resposta não confere com um pedido de conexão feito nesta aba; clique em conectar de novo");
      return;
    }
    setConcluindo(true);
    try {
      const canalId = pend.canalId ?? (await canalDaPlataforma(plataforma));
      await chamarApi(plataforma, "token", { code, shopId, canalId, verifier: pend.verifier ?? "" });
      try {
        sessionStorage.removeItem(ESTADO);
      } catch {
        /* sem sessionStorage nao ha o que limpar */
      }
      setAviso(`${PLATAFORMAS[plataforma].rotulo} conectado.`);
      setColado("");
      setVersao((v) => v + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "nao consegui concluir a conexao");
    }
    setConcluindo(false);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    carregarProdutos();
    if (new URLSearchParams(window.location.search).get("code")) {
      const endereco = window.location.href;
      window.history.replaceState(null, "", window.location.pathname);
      concluir(endereco);
    }
  }, [carregarProdutos, concluir]);

  if (!supabaseConfigured) return <SetupCard />;

  const proximas = (Object.keys(PLATAFORMAS) as Plataforma[]).filter((k) => !PLATAFORMAS[k].api).map((k) => PLATAFORMAS[k].rotulo);

  return (
    <div className="page-in">
      <PageHeader
        titulo="Integrações"
        sub="Marketplaces ligados ao ERP pela API oficial: pedidos entram como vendas e o estoque de cada anúncio sai do estoque daqui."
      />

      {erro && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          <Warning size={18} weight="bold" className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
      {aviso && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">{aviso}</p>}
      {concluindo && <p className="mt-4 text-sm font-semibold text-[var(--ink)]/70">concluindo a conexão...</p>}

      {COM_API.map((p) => (
        <SecaoPlataforma key={`${p}-${versao}`} plataforma={p} produtos={produtos} recarregarProdutos={carregarProdutos} />
      ))}

      <details className="mt-6 rounded-xl bg-white/70 p-4 text-sm">
        <summary className="cursor-pointer font-bold text-[var(--purple-dark)]">A autorização voltou para outra página?</summary>
        <p className="mt-2 text-xs text-[var(--ink)]/70">
          O Mercado Livre só devolve para o endereço HTTPS cadastrado no app. Testando no computador, a volta cai no site. Copie o endereço inteiro daquela página (com <code>?code=</code>) e cole aqui, nesta mesma aba em que clicou em conectar.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            placeholder="https://www.imperiobemkids.com.br/admin/integracoes?code=..."
            className="min-w-[280px] flex-1 rounded-lg border border-[var(--purple)]/20 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[var(--purple)]"
          />
          <button onClick={() => concluir(colado.trim())} disabled={!colado.trim() || concluindo} className={btnSecundario}>
            concluir conexão
          </button>
        </div>
      </details>

      {proximas.length > 0 && (
        <p className="mt-4 text-xs text-[var(--ink)]/65">
          Próximas: {proximas.join(", ")}. Entram nesta tela, com conexão, vínculos e estoque iguais, quando o app de cada uma for aprovado.
        </p>
      )}
    </div>
  );
}

/* ---------- uma plataforma: conexao, vinculos e estoque ---------- */

const CHAVES: Record<Plataforma, string> = {
  shopee: "SHOPEE_PARTNER_ID=...\nSHOPEE_PARTNER_KEY=...\nSHOPEE_AMBIENTE=teste",
  mercadolivre: "ML_CLIENT_ID=...\nML_CLIENT_SECRET=...\nML_REDIRECT_URI=https://www.imperiobemkids.com.br/admin/integracoes",
  tiktok: "",
  kwai: "",
};
const ONDE: Record<Plataforma, string> = {
  shopee: "No console da Shopee Open Platform (App List), copie o Partner ID e a Partner Key",
  mercadolivre: "No DevCenter do Mercado Livre (Minhas aplicações), copie o App ID e a Secret Key",
  tiktok: "",
  kwai: "",
};

function SecaoPlataforma({ plataforma, produtos, recarregarProdutos }: { plataforma: Plataforma; produtos: Produto[]; recarregarProdutos: () => Promise<void> }) {
  const rotulo = PLATAFORMAS[plataforma].rotulo;
  const [status, setStatus] = useState<Status | null>(null);
  const [canalId, setCanalId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "conectar" | "anuncios" | "salvar" | "estoque">("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [resultados, setResultados] = useState<ResultadoEstoque[] | null>(null);
  const [soSemVinculo, setSoSemVinculo] = useState(false);
  // calculado no navegador depois de montar, para o servidor e a tela renderizarem igual
  const [origem, setOrigem] = useState("");

  const carregarVinculos = useCallback(async (cid: string | null) => {
    if (!supabase || !cid) return;
    const { data, error } = await supabase.from("ibk_anuncio_vinculos").select("*").eq("canal_id", cid);
    const vs = error ? [] : ((data as Vinculo[]) ?? []);
    // sem ler a plataforma, a tabela mostra o que ja esta vinculado
    setLinhas((atual) =>
      atual.length
        ? atual.map((l) => {
            const s = vs.find((x) => x.id_anuncio === l.idAnuncio && x.id_variacao === l.idVariacao);
            return s
              ? { ...l, produtoId: s.produto_id, conjuntos: s.conjuntos, salvo: true, sugerido: false, alterado: false }
              : { ...l, salvo: false, alterado: false };
          })
        : vs.map((x) => ({
            idAnuncio: x.id_anuncio,
            idVariacao: x.id_variacao,
            titulo: x.titulo ?? `anúncio ${x.id_anuncio}`,
            variacao: x.variacao ?? "",
            sku: x.sku ?? "",
            naPlataforma: null,
            reservado: 0,
            produtoId: x.produto_id,
            conjuntos: x.conjuntos,
            salvo: true,
            sugerido: false,
            alterado: false,
          })),
    );
  }, []);

  useEffect(() => {
    setOrigem(window.location.origin);
    (async () => {
      const cid = await canalDaPlataforma(plataforma);
      setCanalId(cid);
      try {
        setStatus(await chamarApi<Status>(plataforma, "status", { canalId: cid }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "erro ao ler a integracao");
      }
      await carregarVinculos(cid);
      setCarregando(false);
    })();
  }, [plataforma, carregarVinculos]);

  const retornoShopee = origem ? `${origem}/admin/integracoes` : "";
  const retorno = plataforma === "shopee" ? retornoShopee : status?.retorno ?? "";

  const conectar = async () => {
    setErro("");
    setOcupado("conectar");
    try {
      const r = await chamarApi<{ url: string; state: string; verifier?: string }>(plataforma, "conectar", { retorno: retornoShopee, canalId });
      try {
        sessionStorage.setItem(ESTADO, JSON.stringify({ plataforma, state: r.state, canalId, verifier: r.verifier } satisfies Pendente));
      } catch {
        /* sem sessionStorage a volta segue sem conferir o state */
      }
      window.location.href = r.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao gerar o link");
      setOcupado("");
    }
  };

  const lerAnuncios = async () => {
    setErro("");
    setAviso("");
    setOcupado("anuncios");
    try {
      const { anuncios } = await chamarApi<{ anuncios: Anuncio[] }>(plataforma, "anuncios", { canalId });
      const salvos = new Map(linhas.filter((l) => l.salvo).map((l) => [chaveVinculo(l.idAnuncio, l.idVariacao), l]));
      const novas: Linha[] = [];
      for (const a of anuncios) {
        for (const m of a.modelos) {
          const s = salvos.get(chaveVinculo(a.idAnuncio, m.idVariacao));
          const sugestao = s ? null : acharPorNome(a.titulo, m.nome, produtos);
          novas.push({
            idAnuncio: a.idAnuncio,
            idVariacao: m.idVariacao,
            titulo: a.titulo,
            variacao: m.nome,
            sku: m.sku,
            naPlataforma: m.estoque,
            reservado: m.reservado,
            produtoId: s?.produtoId ?? sugestao ?? "",
            conjuntos: s?.conjuntos ?? conjuntosDoAnuncio(a.titulo, m.nome),
            salvo: Boolean(s),
            sugerido: !s && Boolean(sugestao),
            alterado: false,
          });
        }
      }
      setLinhas(novas);
      await recarregarProdutos();
      setAviso(`${anuncios.length} anúncios e ${novas.length} variações lidos. Confira as sugestões e salve.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao ler os anuncios");
    }
    setOcupado("");
  };

  const mudar = (i: number, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch, sugerido: false, alterado: true } : l)));

  const salvar = async () => {
    if (!supabase || !canalId) return;
    // sugestao pelo nome pode errar o tamanho: salvar sem conferir baixaria o produto errado
    const sugeridas = linhas.filter((l) => l.sugerido && l.produtoId).length;
    if (sugeridas && !window.confirm(`${sugeridas} vínculos são sugestões pelo nome (marcados em amarelo). Conferiu produto e tamanho de cada um? OK salva todos.`)) return;
    setErro("");
    setAviso("");
    setOcupado("salvar");
    const agora = new Date().toISOString();
    const comProduto = linhas.filter((l) => l.produtoId);
    const { error } = comProduto.length
      ? await supabase.from("ibk_anuncio_vinculos").upsert(
          comProduto.map((l) => ({
            canal_id: canalId,
            id_anuncio: l.idAnuncio,
            id_variacao: l.idVariacao,
            produto_id: l.produtoId,
            conjuntos: l.conjuntos,
            titulo: l.titulo,
            variacao: l.variacao,
            sku: l.sku || null,
            updated_at: agora,
          })),
          { onConflict: "canal_id,id_anuncio,id_variacao" },
        )
      : { error: null };
    // linha que tinha vinculo e ficou sem produto: desfaz o vinculo
    const desfazer = linhas.filter((l) => l.salvo && !l.produtoId);
    for (const l of desfazer) {
      if (error) break;
      await supabase.from("ibk_anuncio_vinculos").delete().eq("canal_id", canalId).eq("id_anuncio", l.idAnuncio).eq("id_variacao", l.idVariacao);
    }
    if (error) setErro(/ibk_anuncio_vinculos/.test(error.message) ? "rode a migration 0034 no SQL Editor" : error.message);
    else setAviso(`${comProduto.length} vínculos salvos${desfazer.length ? `, ${desfazer.length} desfeitos` : ""}.`);
    await carregarVinculos(canalId);
    setOcupado("");
  };

  const enviar = async () => {
    if (!canalId) return;
    setErro("");
    setAviso("");
    setResultados(null);
    setOcupado("estoque");
    try {
      const r = await enviarEstoque(plataforma, { canalId });
      setResultados(r);
      const falhas = r.filter((x) => !x.ok).length;
      setAviso(r.length ? `${r.length - falhas} variações atualizadas${falhas ? `, ${falhas} recusadas (veja abaixo)` : ""}.` : "Nenhum vínculo salvo para enviar.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro ao enviar o estoque");
    }
    setOcupado("");
  };

  const saldo = useMemo(() => new Map(produtos.map((p) => [p.id, p.qtd_atual])), [produtos]);
  const opcoes = useMemo(() => produtos.filter((p) => !p.tem_variacoes), [produtos]);
  const nomeProduto = (p: ProdutoRef) => [p.nome, p.tamanho && `tam ${p.tamanho}`, p.cor].filter(Boolean).join(" · ");
  const falhaDe = (l: Linha) => resultados?.find((r) => r.idAnuncio === l.idAnuncio && r.idVariacao === l.idVariacao && !r.ok)?.motivo;

  // novo com produto, salvo que mudou, ou salvo que ficou sem produto
  const pendentes = linhas.filter((l) => (l.produtoId && (!l.salvo || l.alterado)) || (l.salvo && !l.produtoId)).length;
  const visiveis = linhas.map((l, i) => ({ l, i })).filter(({ l }) => !soSemVinculo || !l.produtoId || l.sugerido);
  const conexao = status?.conexao;
  const conectada = Boolean(conexao?.loja_id);

  return (
    <section className="mt-5">
      {/* 1) conexao */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">
              <Plug size={20} weight="duotone" /> {rotulo}
              {status && plataforma === "shopee" && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${status.ambiente === "producao" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {status.ambiente === "producao" ? "produção" : "teste (sandbox)"}
                </span>
              )}
            </h2>
            {erro && <p className="mt-1 text-sm font-semibold text-red-600">{erro}</p>}
            {aviso && <p className="mt-1 text-sm font-semibold text-emerald-700">{aviso}</p>}
            {carregando && <p className="mt-1 text-sm text-[var(--ink)]/65">lendo a integração...</p>}
            {status && !status.configurado && (
              <div className="mt-2 max-w-2xl text-sm text-[var(--ink)]/80">
                <p className="font-semibold">Faltam as chaves do app no servidor.</p>
                <p className="mt-1">{ONDE[plataforma]} e coloque no arquivo <code>.env.local</code> e nas variáveis do projeto na Vercel:</p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--ink)]/5 p-3 text-xs">{CHAVES[plataforma]}</pre>
                <p className="mt-1">Depois reinicie o servidor. A chave secreta nunca vai para o navegador.</p>
              </div>
            )}
            {status && status.configurado && !status.migracao && (
              <p className="mt-2 text-sm font-semibold text-amber-800">Rode a migration 0034 no SQL Editor do Supabase.</p>
            )}
            {status && status.configurado && status.migracao && (
              <div className="mt-1 text-sm text-[var(--ink)]/80">
                {conectada ? (
                  <>
                    <p className="flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle size={16} weight="fill" /> Conta {conexao!.apelido ?? conexao!.loja_id} conectada
                      {conexao!.conectado_em && ` em ${dataBr(conexao!.conectado_em)}`}
                    </p>
                    {conexao!.ambiente !== status.ambiente && (
                      <p className="font-semibold text-amber-800">Conectada no ambiente de {conexao!.ambiente}: conecte de novo para usar {status.ambiente}.</p>
                    )}
                    <p className="text-xs text-[var(--ink)]/65">
                      O acesso se renova sozinho a cada uso.
                      {conexao!.refresh_expira_em && ` Se o ERP ficar sem falar com a plataforma até ${dataBr(conexao!.refresh_expira_em)}, conecte de novo.`}
                      {conexao!.ultima_sync && ` Última busca de pedidos: ${new Date(conexao!.ultima_sync).toLocaleString("pt-BR")}.`}
                    </p>
                  </>
                ) : (
                  <p>Conta ainda não conectada. O botão leva para o {rotulo}; entre com a conta principal da loja e autorize.</p>
                )}
                {!canalId && <p className="mt-1 font-semibold text-amber-800">Não achei o canal {rotulo} em Canais: cadastre antes de conectar.</p>}
                {retorno && (
                  <p className="mt-2 text-xs text-[var(--ink)]/65">
                    Endereço de retorno para cadastrar no app: <code className="font-semibold">{retorno}</code>
                  </p>
                )}
              </div>
            )}
          </div>
          {status?.configurado && status.migracao && (
            <button onClick={conectar} disabled={ocupado !== "" || !canalId} className={conectada ? btnSecundario : btnPrimario}>
              <LinkSimple size={16} weight="bold" className="mr-1 inline-block align-[-3px]" />
              {ocupado === "conectar" ? `abrindo o ${rotulo}...` : conectada ? "reconectar" : "conectar conta"}
            </button>
          )}
        </div>
      </div>

      {/* 2) vinculos e 3) estoque */}
      {conectada && (
        <div className="mt-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-3xl text-xs text-[var(--ink)]/70">
              Cada variação aponta para um produto do estoque. Conjuntos = quantos conjuntos saem em cada venda do anúncio (avulso 1, kit 2, kit 3). O estoque do anúncio é o saldo do produto dividido pelos conjuntos.
              Depois de qualquer venda registrada aqui, os anúncios do mesmo tamanho baixam sozinhos (só baixam; para subir, use o botão de enviar).
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={lerAnuncios} disabled={ocupado !== ""} className={btnSecundario}>
                <CloudArrowDown size={16} weight="bold" className="mr-1 inline-block align-[-3px]" />
                {ocupado === "anuncios" ? "lendo..." : "ler anúncios"}
              </button>
              <button onClick={salvar} disabled={ocupado !== "" || !canalId || pendentes === 0} className={btnSecundario}>
                {ocupado === "salvar" ? "salvando..." : `salvar vínculos${pendentes ? ` (${pendentes})` : ""}`}
              </button>
              <button onClick={enviar} disabled={ocupado !== "" || !linhas.some((l) => l.salvo)} className={btnPrimario}>
                <CloudArrowUp size={16} weight="bold" className="mr-1 inline-block align-[-3px]" />
                {ocupado === "estoque" ? "enviando..." : `enviar estoque para o ${rotulo}`}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 font-semibold text-[var(--ink)]/75">
              <input type="checkbox" checked={soSemVinculo} onChange={(e) => setSoSemVinculo(e.target.checked)} />
              só o que falta conferir
            </label>
            <Link href={`/admin/vendas/importar?fonte=${plataforma}`} className="font-bold text-[var(--purple)] underline">
              importar pedidos do {rotulo}
            </Link>
            <span className="text-[var(--ink)]/60">Antes de enviar estoque, importe os pedidos novos: o ERP só conhece a venda depois de importada.</span>
          </div>

          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--purple)]/10 text-[11px] uppercase text-[var(--ink)]/70">
                  <th className="p-3">Anúncio e variação</th>
                  <th className="p-3 text-right">No {rotulo}</th>
                  <th className="p-3">Produto do estoque</th>
                  <th className="p-3 text-right">Conjuntos</th>
                  <th className="p-3 text-right">Vai ficar</th>
                </tr>
              </thead>
              <tbody>
                {carregando && <SkeletonRows cols={5} />}
                {!carregando && linhas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-[var(--ink)]/65">
                      Nenhum vínculo ainda. Clique em &quot;ler anúncios&quot; para começar.
                    </td>
                  </tr>
                )}
                {visiveis.map(({ l, i }) => {
                  const calc = l.produtoId ? estoqueDoAnuncio(saldo.get(l.produtoId) ?? 0, l.conjuntos) : null;
                  const muda = calc != null && l.naPlataforma != null && calc !== l.naPlataforma;
                  const falha = falhaDe(l);
                  return (
                    <tr key={`${l.idAnuncio}|${l.idVariacao}`} className="border-b border-[var(--purple)]/6 align-top last:border-0">
                      <td className="max-w-[340px] p-3">
                        <div className="truncate font-semibold text-[var(--ink)]" title={l.titulo}>{l.titulo}</div>
                        <div className="text-[11px] text-[var(--ink)]/70">
                          {l.variacao || "sem variação"}
                          {l.sku && ` · SKU ${l.sku}`}
                        </div>
                        {falha && <div className="mt-1 text-[11px] font-semibold text-red-600">Recusado: {falha}</div>}
                      </td>
                      <td className="num p-3 text-right">
                        {l.naPlataforma == null ? <span className="text-[var(--ink)]/45">-</span> : l.naPlataforma}
                        {l.reservado > 0 && <div className="text-[10px] text-amber-700">{l.reservado} reservado</div>}
                      </td>
                      <td className="p-3">
                        <select
                          value={l.produtoId}
                          onChange={(e) => mudar(i, { produtoId: e.target.value })}
                          aria-label={`produto de ${l.titulo} ${l.variacao}`}
                          className={`w-full max-w-[300px] rounded-lg border bg-white px-2 py-1 text-xs outline-none focus:border-[var(--purple)] ${l.sugerido ? "border-amber-400" : "border-[var(--purple)]/20"}`}
                        >
                          <option value="">não vincular</option>
                          {opcoes.map((p) => (
                            <option key={p.id} value={p.id}>{nomeProduto(p)} ({p.qtd_atual})</option>
                          ))}
                        </select>
                        {l.sugerido && <div className="mt-0.5 text-[10px] font-bold uppercase text-amber-700">sugestão pelo nome: confira</div>}
                        {l.produtoId && !l.salvo && !l.sugerido && <div className="mt-0.5 text-[10px] font-bold uppercase text-[var(--purple)]">não salvo</div>}
                      </td>
                      <td className="p-3 text-right">
                        <select
                          value={l.conjuntos}
                          onChange={(e) => mudar(i, { conjuntos: Number(e.target.value) })}
                          aria-label={`conjuntos por venda de ${l.titulo} ${l.variacao}`}
                          className="rounded-lg border border-[var(--purple)]/20 bg-white px-2 py-1 text-xs outline-none focus:border-[var(--purple)]"
                        >
                          {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                            <option key={n} value={n}>{n === 1 ? "1 (avulso)" : `${n} (kit ${n})`}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`num p-3 text-right font-extrabold ${muda ? "text-[var(--purple-dark)]" : "text-[var(--ink)]/70"}`}>
                        {calc == null ? "-" : calc}
                        {muda && <div className="text-[10px] font-bold uppercase">{calc! > l.naPlataforma! ? "sobe" : "baixa"}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {linhas.length > 0 && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--ink)]/60">
              <ArrowsClockwise size={12} /> &quot;Vai ficar&quot; usa o saldo atual do estoque. Anúncio em promoção ou no Full pode recusar a mudança.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
