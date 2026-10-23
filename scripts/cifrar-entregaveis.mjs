/*
  Cifra os arquivos pagos para entregaveis/<oferta>/<id>.enc, porque o
  repositorio e publico. Le a lista em entregaveis/manifesto.json e a chave
  ENTREGA_CHAVE do .env.local. Sem chave, cria uma e grava no .env.local, sem
  mostrar na tela: a MESMA chave vai na Vercel, senao o download falha.
  Mesmo formato de lib/checkout/entrega.ts (AES-256-GCM, iv + tag + corpo).

  Uso: node scripts/cifrar-entregaveis.mjs
  Rode de novo sempre que o guia ou a planilha mudarem, e faca commit dos .enc.
*/
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const arquivoEnv = path.join(raiz, ".env.local");

function lerChave() {
  if (process.env.ENTREGA_CHAVE) return process.env.ENTREGA_CHAVE;
  const env = existsSync(arquivoEnv) ? readFileSync(arquivoEnv, "utf8") : "";
  const achada = env.match(/^ENTREGA_CHAVE=(.+)$/m);
  if (achada) return achada[1].trim();
  const nova = randomBytes(32).toString("base64url");
  const quebra = env === "" || env.endsWith("\n") ? "" : "\n";
  appendFileSync(
    arquivoEnv,
    `${quebra}\n# Chave dos arquivos pagos (scripts/cifrar-entregaveis.mjs). A mesma vai na Vercel.\nENTREGA_CHAVE=${nova}\n`,
  );
  console.log("ENTREGA_CHAVE criada no .env.local (copie para a Vercel).");
  return nova;
}

const chave = createHash("sha256").update(`ibk-entrega:${lerChave()}`).digest();
const manifesto = JSON.parse(readFileSync(path.join(raiz, "entregaveis", "manifesto.json"), "utf8"));

for (const [oferta, arquivos] of Object.entries(manifesto)) {
  mkdirSync(path.join(raiz, "entregaveis", oferta), { recursive: true });
  for (const a of arquivos) {
    const original = readFileSync(path.resolve(raiz, a.origem));
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", chave, iv);
    const corpo = Buffer.concat([c.update(original), c.final()]);
    const cifrado = Buffer.concat([iv, c.getAuthTag(), corpo]);

    // confere na volta antes de gravar
    const d = createDecipheriv("aes-256-gcm", chave, cifrado.subarray(0, 12));
    d.setAuthTag(cifrado.subarray(12, 28));
    if (!Buffer.concat([d.update(cifrado.subarray(28)), d.final()]).equals(original)) {
      throw new Error(`conferencia falhou: ${a.nome}`);
    }

    const destino = path.join(raiz, "entregaveis", oferta, `${a.id}.enc`);
    writeFileSync(destino, cifrado);
    console.log(`${oferta}/${a.id}.enc  ${(original.length / 1024).toFixed(0)} KB  (${a.nome})`);
  }
}
