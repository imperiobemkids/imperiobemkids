"use client";

import { useEffect, useRef, useState } from "react";

/*
  Ursinha do Imperio: atendente que direciona a cliente pra vitrine,
  grupo de promos ou loja. Cada opcao rola a pagina ate a ancora certa
  (ids definidos no page.tsx) ou, se em breve, avisa e sugere seguir nas redes.
*/

type Destino = {
  key: string;
  label: string;
  anchor: string; // id do bloco na pagina
  resposta: string; // fala da ursinha ao escolher
  emBreve?: boolean;
};

const DESTINOS: Destino[] = [
  {
    key: "tendencia",
    label: "ver o que tá bombando 🔥",
    anchor: "tendencia",
    resposta: "amei! esses são os queridinhos do momento, separei aqui 👇",
  },
  {
    key: "achadinhos",
    label: "quero as pechinchas ✨",
    anchor: "achadinhos",
    resposta: "você tem bom gosto! os melhores achadinhos tão logo abaixo 👇",
  },
  {
    key: "loja",
    label: "ver a lojinha completa 🛒",
    anchor: "loja",
    resposta: "nossa lojinha na Shopee tá quase pronta! te levo até lá 👇",
    emBreve: true,
  },
  {
    key: "promos",
    label: "receber promoções todo dia 🎁",
    anchor: "promos",
    resposta: "essa é a melhor parte! toda promoção cai primeiro no grupinho 👇",
    emBreve: true,
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
    fala(["perfeito! e o que você quer ver primeiro?"], "destino");
  };

  const pickDestino = (d: Destino) => {
    setDestino(d);
    say(d.label);
    fala([d.resposta], "fim");
  };

  const irPara = (anchor: string) => {
    onClose();
    setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
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
              {destino.emBreve && (
                <p className="mb-3 text-sm leading-relaxed text-[var(--ink)]/75">
                  ainda tá em preparação, mas te levo até lá pra você não perder de vista.
                  enquanto isso, segue a gente pra ficar por dentro! 💜
                </p>
              )}
              <button
                onClick={() => irPara(destino.anchor)}
                className="w-full rounded-full bg-[var(--purple)] py-3 text-center text-sm font-extrabold text-white transition-colors hover:bg-[var(--purple-dark)]"
              >
                {destino.emBreve ? "me mostra 👀" : "ver agora 👇"}
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
