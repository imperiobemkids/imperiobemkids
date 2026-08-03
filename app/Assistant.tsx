"use client";

import { useEffect, useRef, useState } from "react";

/*
  Ursinha do Imperio: atendente que direciona a cliente pra vitrine, pra loja
  ou pro WhatsApp. Destino com `url` abre o link; sem url, rola a pagina ate
  a ancora do bloco (ids definidos em pedido/page.tsx).
*/

const WHATSAPP = "https://wa.me/5511940553038?text=";
const LOJA_SHOPEE =
  "https://shopee.com.br/douglasben?categoryId=100633&entryPoint=ShopByPDP&itemId=58265431662";

type Destino = {
  key: string;
  label: string;
  anchor?: string; // id do bloco na pagina
  url?: string; // link externo (abre em nova aba)
  resposta: string; // fala da ursinha ao escolher
  cta: string;
};

const DESTINOS: Destino[] = [
  {
    key: "tendencia",
    label: "ver os kits de verão ☀️",
    anchor: "tendencia",
    resposta: "amei! temos kit com 4 peças por R$ 49,90, menino e menina. dá uma olhada 👇",
    cta: "ver os kits 👇",
  },
  {
    key: "loja",
    label: "ver a lojinha completa 🛒",
    url: LOJA_SHOPEE,
    resposta: "na lojinha tem tudo o que a gente tem disponível agora 🛍️",
    cta: "abrir a lojinha",
  },
  {
    key: "duvida",
    label: "tenho uma dúvida 💬",
    resposta: "sem problema! me chama no WhatsApp que a gente te responde rapidinho 💜",
    cta: "chamar no WhatsApp",
  },
  {
    key: "pedido",
    label: "quero fazer um pedido 🎁",
    resposta: "que delícia! é só me chamar no WhatsApp que eu monto seu pedido 💜",
    cta: "fazer meu pedido",
  },
];

const IDADES = [
  { key: "bebe", label: "bebê (0 a 2 anos)" },
  { key: "peq", label: "pequenininho (3 a 5)" },
  { key: "grande", label: "criançona (6+)" },
  { key: "presente", label: "é presente, me surpreende 🎁" },
];

type Msg = { from: "bot" | "user"; text: string };
type Stage = "idade" | "destino" | "fim";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tempoDigitando = (t: string) => Math.min(1600, 500 + t.length * 20);

function Chat({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [stage, setStage] = useState<Stage>("idade");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [idade, setIdade] = useState("");

  const alive = useRef(true);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, stage]);

  const fala = async (texts: string[], next: Stage) => {
    for (const t of texts) {
      if (!alive.current) return;
      setTyping(true);
      await sleep(tempoDigitando(t));
      if (!alive.current) return;
      setTyping(false);
      setMsgs((p) => [...p, { from: "bot", text: t }]);
      await sleep(200);
    }
    if (alive.current) setStage(next);
  };

  useEffect(() => {
    alive.current = true;
    if (!started.current) {
      started.current = true;
      fala(
        [
          "oi, oi! eu sou a Ursinha do Império Bem Kids 🧸",
          "vou te ajudar a achar o presentinho perfeito! primeiro: pra qual idadezinha é?",
        ],
        "idade",
      );
    }
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = (text: string) => setMsgs((p) => [...p, { from: "user", text }]);

  const pickIdade = (i: (typeof IDADES)[number]) => {
    say(i.label);
    setIdade(i.label);
    fala(["perfeito! e o que você quer ver primeiro?"], "destino");
  };

  const pickDestino = (d: Destino) => {
    setDestino(d);
    say(d.label);
    fala([d.resposta], "fim");
  };

  /*
    Leva a cliente ao destino: ancora rola a pagina, url abre a loja e,
    quando nao ha nem um nem outro, manda pro WhatsApp com a conversa
    resumida na mensagem (a idade que ela escolheu e o que ela quer).
  */
  const irPara = (d: Destino) => {
    if (d.anchor) {
      onClose();
      setTimeout(() => {
        document.getElementById(d.anchor!)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return;
    }
    const destinoUrl =
      d.url ??
      WHATSAPP +
        encodeURIComponent(
          `Oi! Vim pelo site do Império Bem Kids 💜` +
            (idade ? `\nÉ para: ${idade}` : "") +
            `\n${d.key === "duvida" ? "Tenho uma dúvida." : "Quero fazer um pedido."}`,
        );
    window.open(destinoUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center bg-[rgba(60,40,80,0.5)] backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--cream)] shadow-2xl">
        {/* header */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-[var(--purple)]/10 bg-white px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--pink)] to-[var(--teal)] text-2xl">
            🧸
          </div>
          <div className="flex-1">
            <div className="font-[family-name:var(--font-baloo)] text-base font-extrabold text-[var(--purple-dark)]">
              Ursinha do Império
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--teal)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--teal)]" />
              {typing ? "digitando..." : "online agora"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--purple)]/8 text-lg text-[var(--purple)] transition-colors hover:bg-[var(--purple)]/15"
          >
            ✕
          </button>
        </div>

        {/* mensagens */}
        <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-5">
          {msgs.map((m, i) =>
            m.from === "bot" ? (
              <div key={i} className="flex max-w-[88%] items-end gap-2 self-start">
                <span className="mb-1 text-lg">🧸</span>
                <div className="rounded-[16px_16px_16px_4px] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[var(--ink)] shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div
                key={i}
                className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-[var(--purple)] px-3.5 py-2.5 text-sm font-semibold leading-relaxed text-white"
              >
                {m.text}
              </div>
            ),
          )}

          {typing && (
            <div className="flex items-end gap-2 self-start">
              <span className="mb-1 text-lg">🧸</span>
              <div className="flex items-center gap-1 rounded-[16px_16px_16px_4px] bg-white px-4 py-3.5 shadow-sm">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="block h-1.5 w-1.5 rounded-full bg-[var(--purple)]/50"
                    style={{ animation: "float 1s infinite", animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* cartao final */}
          {stage === "fim" && !typing && destino && (
            <div className="mt-3 rounded-2xl border-2 border-[var(--purple)]/20 bg-white p-4 shadow-sm">
              <button
                onClick={() => irPara(destino)}
                className="w-full rounded-full bg-[var(--purple)] py-3 text-center text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]"
              >
                {destino.cta}
              </button>
            </div>
          )}
        </div>

        {/* opcoes */}
        <div className="flex-shrink-0 border-t border-[var(--purple)]/10 bg-white px-4 py-3">
          {stage === "idade" && !typing && (
            <div className="flex flex-col gap-2">
              {IDADES.map((i) => (
                <button
                  key={i.key}
                  onClick={() => pickIdade(i)}
                  className="w-full rounded-xl border-2 border-[var(--purple)]/20 bg-[var(--purple)]/5 px-4 py-3 text-left text-sm font-semibold text-[var(--purple-dark)] transition-colors hover:border-[var(--purple)] hover:bg-[var(--purple)]/10"
                >
                  {i.label}
                </button>
              ))}
            </div>
          )}

          {stage === "destino" && !typing && (
            <div className="flex flex-col gap-2">
              {DESTINOS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => pickDestino(d)}
                  className="w-full rounded-xl border-2 border-[var(--purple)]/20 bg-[var(--purple)]/5 px-4 py-3 text-left text-sm font-semibold text-[var(--purple-dark)] transition-colors hover:border-[var(--purple)] hover:bg-[var(--purple)]/10"
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {stage === "fim" && !typing && (
            <button
              onClick={onClose}
              className="w-full rounded-full bg-[var(--purple)]/8 py-3 text-sm font-semibold text-[var(--purple)] transition-colors hover:bg-[var(--purple)]/15"
            >
              fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Assistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Falar com a Ursinha"
          className="animate-float fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-[var(--purple)] py-2 pl-2 pr-3.5 text-white shadow-lg shadow-[var(--purple)]/30 transition-transform hover:scale-105"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base">
            🧸
          </span>
          <span className="font-[family-name:var(--font-baloo)] text-xs font-extrabold">
            me ajuda a escolher
          </span>
        </button>
      )}
      {open && <Chat onClose={() => setOpen(false)} />}
    </>
  );
}
