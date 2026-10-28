"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { GRUPOS } from "../AdminNav";
import { btnSecundario } from "../ui";

/*
  Ver no celular: as telas do ERP no tamanho de iPhone e de Android, lado a
  lado, para conferir proporcao, quebra de texto e o que fica escondido. Cada
  aparelho e a pagina de verdade dentro de um quadro do tamanho da tela (o que
  for feito ali vale no ERP). As medidas sao a area util aproximada: no
  navegador, a tela menos as barras do Safari ou do Chrome; como app
  instalado, a tela menos a barra de status.
*/

type Aparelho = {
  id: string;
  nome: string;
  sistema: "ios" | "android";
  tela: [number, number];
  status: number;
  navegador: number; // altura util com as barras do navegador
  ilha?: boolean; // iPhone com Dynamic Island
};

const APARELHOS: Aparelho[] = [
  { id: "iphone-se", nome: "iPhone SE", sistema: "ios", tela: [375, 667], status: 20, navegador: 553 },
  { id: "iphone-15", nome: "iPhone 15", sistema: "ios", tela: [393, 852], status: 59, navegador: 659, ilha: true },
  { id: "iphone-pro-max", nome: "iPhone 15 Pro Max", sistema: "ios", tela: [430, 932], status: 59, navegador: 739, ilha: true },
  { id: "android-compacto", nome: "Android compacto (Galaxy A)", sistema: "android", tela: [360, 800], status: 28, navegador: 712 },
  { id: "android", nome: "Android (Galaxy S, Pixel)", sistema: "android", tela: [412, 915], status: 28, navegador: 827 },
];

const PAGINAS = [{ href: "/admin", label: "Painel" }, ...GRUPOS.flatMap((g) => g.itens.map((i) => ({ href: i.href, label: i.label })))];

const BARRA_CHROME = 56; // barra de endereco do Chrome no Android, em cima

function Telefone({ ap, pagina, modo, escala, chave }: { ap: Aparelho; pagina: string; modo: "navegador" | "app"; escala: number; chave: number }) {
  const [w, h] = ap.tela;
  const util = modo === "navegador" ? ap.navegador : h - ap.status;
  const topoAndroid = modo === "navegador" && ap.sistema === "android" ? BARRA_CHROME : 0;
  const rodape = h - ap.status - topoAndroid - util;
  const borda = 10;
  const ref = useRef<HTMLIFrameElement>(null);
  const [atual, setAtual] = useState(pagina);

  // a navegacao dentro do ERP nao recarrega o quadro: confere o endereco de tempos em tempos
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const p = ref.current?.contentWindow?.location.pathname;
        if (p) setAtual(p);
      } catch {
        // quadro ainda carregando
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <figure className="flex flex-col items-center">
      <div style={{ width: (w + borda * 2) * escala, height: (h + borda * 2) * escala }}>
        <div
          style={{ width: w + borda * 2, height: h + borda * 2, padding: borda, transform: `scale(${escala})`, transformOrigin: "top left" }}
          className={`bg-[#1d1726] shadow-xl ${ap.sistema === "ios" ? "rounded-[52px]" : "rounded-[40px]"}`}
        >
          <div className={`relative flex h-full w-full flex-col overflow-hidden bg-white ${ap.sistema === "ios" ? "rounded-[42px]" : "rounded-[30px]"}`}>
            {/* barra de status */}
            <div style={{ height: ap.status }} className="relative flex shrink-0 items-end justify-between px-7 pb-1.5 text-[13px] font-bold text-black">
              <span>9:41</span>
              {ap.ilha && <span className="absolute left-1/2 top-[11px] h-[34px] w-[120px] -translate-x-1/2 rounded-full bg-black" />}
              {ap.sistema === "android" && <span className="absolute left-1/2 top-[8px] h-3 w-3 -translate-x-1/2 rounded-full bg-black" />}
              <span className="tracking-widest">▮▮ ◔</span>
            </div>
            {topoAndroid > 0 && (
              <div style={{ height: topoAndroid }} className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#f1f3f4] px-3">
                <span className="flex-1 truncate rounded-full bg-white px-3 py-1.5 text-[13px] text-black/70">imperiobemkids.com.br{atual}</span>
              </div>
            )}
            <iframe
              key={chave}
              ref={ref}
              src={pagina}
              title={`${ap.nome}: ${pagina}`}
              style={{ width: w, height: util }}
              className="shrink-0 border-0 bg-[var(--cream)]"
              onLoad={() => {
                try {
                  setAtual(ref.current?.contentWindow?.location.pathname ?? pagina);
                } catch {
                  setAtual(pagina);
                }
              }}
            />
            {rodape > 0 && (
              <div style={{ height: rodape }} className="flex shrink-0 flex-col items-center justify-center gap-1.5 border-t border-black/10 bg-[#f6f6f6] px-3">
                {modo === "navegador" && ap.sistema === "ios" && (
                  <span className="w-full truncate rounded-xl bg-white px-3 py-2 text-center text-[13px] text-black/70 shadow-sm">imperiobemkids.com.br</span>
                )}
                <span className="h-[5px] w-[120px] rounded-full bg-black/80" />
              </div>
            )}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-sm">
        <b className="text-[var(--purple-dark)]">{ap.nome}</b>
        <span className="block text-xs text-[var(--ink)]/60">
          {w} x {util} px úteis · {atual}
        </span>
      </figcaption>
    </figure>
  );
}

export function VerNoCelular({ enderecos, porta }: { enderecos: string[]; porta: string }) {
  const [pagina, setPagina] = useState("/admin");
  const [livre, setLivre] = useState("");
  const [aparelhos, setAparelhos] = useState(["iphone-15", "android"]);
  const [modo, setModo] = useState<"navegador" | "app">("navegador");
  const [chave, setChave] = useState(0);
  const [escala, setEscala] = useState(1);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [origem, setOrigem] = useState("");

  // os aparelhos cabem na altura da janela, sem rolar
  useEffect(() => {
    const ajustar = () => setEscala(Math.min(1, Math.max(0.45, (window.innerHeight - 250) / 952)));
    ajustar();
    window.addEventListener("resize", ajustar);
    setOrigem(window.location.origin);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  // enderecos para o celular de verdade: o PC na rede (servidor local) ou o site publicado
  const links = enderecos.length ? enderecos.map((ip) => `http://${ip}:${porta}${pagina}`) : origem ? [`${origem}${pagina}`] : [];
  const chaveLinks = links.join(" ");
  useEffect(() => {
    let vivo = true;
    Promise.all(links.map(async (l) => [l, await QRCode.toDataURL(l, { margin: 1, width: 240 })] as const)).then((pares) => {
      if (vivo) setQrs(Object.fromEntries(pares));
    });
    return () => {
      vivo = false;
    };
    // refaz so quando o endereco muda (a lista e recriada a cada render)
  }, [chaveLinks]);

  const irPara = (href: string) => {
    if (!href.startsWith("/") || href.startsWith("/admin/celular")) return;
    setPagina(href);
    setChave((c) => c + 1);
  };

  const campo = "rounded-xl border border-[var(--purple)]/20 bg-white px-3 py-2 text-sm";

  return (
    <div>
      <h1 className="font-[family-name:var(--font-baloo)] text-2xl font-extrabold text-[var(--purple-dark)]">Ver no celular</h1>
      <p className="text-sm text-[var(--ink)]/70">
        As telas do ERP no tamanho de iPhone e de Android, para conferir proporção e o que fica escondido. É o ERP de verdade: o que fizer aqui vale.
      </p>

      <div className="card mt-4 flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm font-bold text-[var(--ink)]/80">
          Tela
          <select value={PAGINAS.some((p) => p.href === pagina) ? pagina : ""} onChange={(e) => irPara(e.target.value)} className={`${campo} mt-1 block`}>
            {!PAGINAS.some((p) => p.href === pagina) && <option value="">{pagina}</option>}
            {PAGINAS.map((p) => (
              <option key={p.href} value={p.href}>{p.label}</option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            irPara(livre.trim());
          }}
          className="text-sm font-bold text-[var(--ink)]/80"
        >
          Ou o endereço
          <input value={livre} onChange={(e) => setLivre(e.target.value)} placeholder="/admin/estoque/..." className={`${campo} mt-1 block w-56`} />
        </form>
        {[0, 1].map((i) => (
          <label key={i} className="text-sm font-bold text-[var(--ink)]/80">
            Aparelho {i + 1}
            <select
              value={aparelhos[i]}
              onChange={(e) => setAparelhos((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${campo} mt-1 block`}
            >
              {APARELHOS.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-sm font-bold text-[var(--ink)]/80">
          Como abre
          <select value={modo} onChange={(e) => setModo(e.target.value as "navegador" | "app")} className={`${campo} mt-1 block`}>
            <option value="navegador">no navegador (Safari, Chrome)</option>
            <option value="app">como app na tela inicial</option>
          </select>
        </label>
        <button onClick={() => setChave((c) => c + 1)} className={btnSecundario}>
          recarregar
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-center gap-10">
        {aparelhos.map((id, i) => {
          const ap = APARELHOS.find((a) => a.id === id)!;
          return <Telefone key={`${i}-${id}`} ap={ap} pagina={pagina} modo={modo} escala={escala} chave={chave} />;
        })}
      </div>
      <p className="mt-3 text-center text-xs text-[var(--ink)]/55">
        Medidas aproximadas da área útil de cada aparelho. Gestos de toque (puxar o menu, voltar do sistema) só dá para testar no celular de verdade.
      </p>

      {links.length > 0 && (
        <div className="card mx-auto mt-6 max-w-2xl p-4">
          <h2 className="font-[family-name:var(--font-baloo)] text-lg font-extrabold text-[var(--purple-dark)]">No celular de verdade</h2>
          <p className="text-sm text-[var(--ink)]/70">
            {enderecos.length
              ? "Com o servidor local ligado e o celular no mesmo Wi-Fi do PC, aponte a câmera para o código: abre esta tela com as mudanças que ainda não foram publicadas. Na primeira vez o celular pede para entrar no ERP. Se não abrir, o Windows pode estar bloqueando: permita o Node.js em redes privadas."
              : "Aponte a câmera do celular para o código para abrir esta tela no site publicado."}
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            {links.map((l) => (
              <div key={l} className="flex items-center gap-3">
                {qrs[l] && <img src={qrs[l]} alt={`QR code de ${l}`} width={120} height={120} className="rounded-lg" />}
                <code className="break-all text-sm font-bold text-[var(--purple-dark)]">{l}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
