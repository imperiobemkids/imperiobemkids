import { createDecipheriv, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*
  Os arquivos pagos ficam no repositorio CIFRADOS, porque o repositorio e
  publico: entregaveis/<oferta>/<arquivo>.enc, gerados por
  scripts/cifrar-entregaveis.mjs a partir de entregaveis/manifesto.json.
  A chave (ENTREGA_CHAVE) so existe no servidor; sem ela o .enc e ruido.
  Formato: iv (12 bytes) + tag (16) + corpo, em AES-256-GCM, como o cofre das
  integracoes. A rota de entrega so chama isto depois de conferir o pagamento.
*/
const chave = (segredo: string) => createHash("sha256").update(`ibk-entrega:${segredo}`).digest();

export async function lerEntregavel(oferta: string, arquivo: string): Promise<Buffer> {
  const segredo = process.env.ENTREGA_CHAVE;
  if (!segredo) throw new Error("ENTREGA_CHAVE nao configurada");
  const bruto = await readFile(path.join(process.cwd(), "entregaveis", oferta, `${arquivo}.enc`));
  const d = createDecipheriv("aes-256-gcm", chave(segredo), bruto.subarray(0, 12));
  d.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([d.update(bruto.subarray(28)), d.final()]);
}
