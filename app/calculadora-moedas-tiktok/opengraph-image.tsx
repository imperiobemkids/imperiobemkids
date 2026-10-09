import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/*
  Imagem que aparece quando o link da calculadora e compartilhado (WhatsApp,
  TikTok, Instagram). Gerada no build, nas cores e fontes da marca.
*/
export const alt = "Calculadora de Moedas do TikTok em Reais, do Império Bem Kids";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SELO = "Ferramenta grátis";
const TITULO = "Calculadora de Moedas do TikTok em Reais";
const SUB = "Quanto valem os presentes da sua live";
const SITE = "imperiobemkids.com.br";

/*
  Baixa da Google so as letras usadas (o gerador nao aceita woff2, e sem
  navegador moderno a Google entrega truetype). Se falhar, a imagem sai com a
  fonte padrao em vez de quebrar o build.
*/
async function fonte(familia: string, peso: number, texto: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${familia}:wght@${peso}&text=${encodeURIComponent(texto)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  const [baloo, nunito] = await Promise.all([
    fonte("Baloo+2", 800, SELO + TITULO),
    fonte("Nunito", 700, SUB + SITE),
  ]);
  const fonts = [
    ...(baloo ? [{ name: "Baloo 2", data: baloo, weight: 800 as const, style: "normal" as const }] : []),
    ...(nunito ? [{ name: "Nunito", data: nunito, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          background: "#4c1d80",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={110} height={110} alt="" style={{ borderRadius: 28 }} />
          <div
            style={{
              display: "flex",
              background: "#fde68a",
              color: "#4c1d80",
              fontFamily: "Baloo 2",
              fontSize: 32,
              fontWeight: 800,
              padding: "6px 24px",
              borderRadius: 999,
            }}
          >
            {SELO}
          </div>
        </div>
        <div style={{ display: "flex", fontFamily: "Baloo 2", fontSize: 88, fontWeight: 800, lineHeight: 1, marginTop: 44 }}>
          {TITULO}
        </div>
        <div style={{ display: "flex", fontFamily: "Nunito", fontSize: 38, fontWeight: 700, marginTop: 28, color: "rgba(255,255,255,0.85)" }}>
          {SUB}
        </div>
        <div style={{ display: "flex", fontFamily: "Nunito", fontSize: 30, fontWeight: 700, marginTop: "auto", color: "#fde68a" }}>
          {SITE}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
