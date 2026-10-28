import Anthropic from "@anthropic-ai/sdk";
import { clienteDoAdmin } from "@/lib/integracoesServidor";
import type { LinhaFolha } from "@/lib/contagem";

/*
  Le a foto de UMA pagina da folha de contagem preenchida a mao e devolve o
  numero escrito no quadro Contado de cada linha que aparece nela. So
  administrador (cabecalho Authorization com o token do Supabase). Nao grava
  nada: a tela Contagem preenche os campos e a pessoa confere antes de aplicar.

  Corpo: { folhaId, imagem: "data:image/jpeg;base64,..." }
  Resposta: { leituras: [{ n, contado, leitura: "certa" | "duvida" | "em_branco" }], aviso }
*/

export const maxDuration = 60;

const SISTEMA = `Você lê fotos de folhas de contagem de estoque impressas pela loja Império Bem Kids e preenchidas à mão.

Cada linha da folha tem, da esquerda para a direita: Nº (número da linha, impresso), Produto, Tam., às vezes Cor / tipo e Sistema (impressos), o quadro Contado (escrito à mão) e Obs.

Para cada linha que aparece na foto, devolva o Nº e o número escrito à mão no quadro Contado:
- leitura "certa": o número está legível, sem dúvida.
- leitura "duvida": dá para ler, mas pode ser outro algarismo (1 ou 7, 4 ou 9, 3 ou 8), está borrado, ou foi riscado e reescrito (use o último número escrito). Em "duvida", contado é o seu melhor palpite.
- leitura "em_branco": quadro vazio ou ilegível; contado = 0.
Um traço ou um X dentro do quadro vale 0, com leitura "certa".

Leia só o quadro Contado. O número da coluna Sistema é impresso e não é a contagem: nunca o copie.
Se o Nº de uma linha estiver ilegível, ache a linha pelo produto, tamanho e cor na lista que vem com a foto.
Devolva só as linhas que aparecem na foto, sem inventar nenhuma.
Em aviso, escreva uma frase curta se a foto estiver cortada, desfocada, for de outra folha ou não for uma folha de contagem; senão, deixe vazio.`;

const FORMATO = {
  type: "object",
  additionalProperties: false,
  required: ["leituras", "aviso"],
  properties: {
    leituras: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "contado", "leitura"],
        properties: {
          n: { type: "integer", description: "Nº impresso da linha" },
          contado: { type: "integer", description: "número escrito no quadro Contado; 0 quando em_branco" },
          leitura: { type: "string", enum: ["certa", "duvida", "em_branco"] },
        },
      },
    },
    aviso: { type: "string" },
  },
};

type Leitura = { n: number; contado: number; leitura: "certa" | "duvida" | "em_branco" };

const erro = (mensagem: string, status: number) => Response.json({ erro: mensagem }, { status });

export async function POST(req: Request) {
  const db = await clienteDoAdmin(req);
  if (db instanceof Response) return db;
  if (!process.env.ANTHROPIC_API_KEY) {
    return erro("a leitura por foto ainda não está ligada: falta a chave ANTHROPIC_API_KEY no servidor", 503);
  }

  const corpo = (await req.json().catch(() => ({}))) as { folhaId?: unknown; imagem?: unknown };
  const imagem = typeof corpo.imagem === "string" ? corpo.imagem : "";
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(imagem);
  if (!m) return erro("foto inválida", 400);
  if (m[1].length > 4_000_000) return erro("foto grande demais", 413);
  if (typeof corpo.folhaId !== "string" || !corpo.folhaId) return erro("falta a folha", 400);

  const { data: folha, error } = await db.from("ibk_contagens").select("codigo, linhas").eq("id", corpo.folhaId).single();
  if (error || !folha) return erro("folha não encontrada", 404);
  const linhas = folha.linhas as LinhaFolha[];
  const lista = linhas
    .map((l) => [l.n, l.produto, l.tamanho ? `tam ${l.tamanho}` : "", l.cor].filter(Boolean).join(" | "))
    .join("\n");

  const client = new Anthropic({ timeout: 55_000, maxRetries: 0 });
  try {
    const resposta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // se a IA recusar a foto, o servidor tenta de novo no modelo indicado pela Anthropic
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: FORMATO } },
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: m[1] } },
            { type: "text", text: `Folha #${folha.codigo}. Linhas desta folha (Nº | produto | tamanho | cor):\n${lista}` },
          ],
        },
      ],
    });

    if (resposta.stop_reason === "refusal") return erro("a IA não leu esta foto; digite os números desta página", 422);
    if (resposta.stop_reason === "max_tokens") return erro("a leitura veio incompleta; tente de novo com uma foto por página", 502);
    const texto = resposta.content.find((b) => b.type === "text");
    if (!texto || texto.type !== "text") return erro("a IA não devolveu a leitura", 502);
    const saida = JSON.parse(texto.text) as { leituras: Leitura[]; aviso: string };

    // so linhas que existem na folha, com numero que faz sentido
    const existe = new Set(linhas.map((l) => l.n));
    const leituras = saida.leituras.filter(
      (l) => existe.has(l.n) && Number.isInteger(l.contado) && l.contado >= 0 && l.contado < 10000,
    );
    return Response.json({ leituras, aviso: saida.aviso.trim() });
  } catch (e) {
    // o motivo exato fica no log do servidor (terminal ou Vercel); a tela recebe a frase pronta
    if (e instanceof Anthropic.APIError) console.error("contagem/ler", e.status, e.message);
    if (e instanceof Anthropic.AuthenticationError) return erro("a chave da IA (ANTHROPIC_API_KEY) não foi aceita", 502);
    // conta sem credito volta como 400: e a causa mais comum quando a chave e nova
    if (e instanceof Anthropic.BadRequestError) return erro("a IA recusou o pedido: confira se a conta da Anthropic tem créditos (console.anthropic.com > Billing)", 502);
    if (e instanceof Anthropic.RateLimitError) return erro("muitas leituras ao mesmo tempo; tente de novo em instantes", 429);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return erro("a leitura demorou demais; tente de novo", 504);
    if (e instanceof Anthropic.APIConnectionError) return erro("não deu para falar com a IA; tente de novo", 502);
    if (e instanceof Anthropic.APIError) return erro(`a IA respondeu com erro ${e.status ?? ""}`.trim(), 502);
    if (e instanceof SyntaxError) return erro("a leitura veio num formato inesperado; tente de novo", 502);
    throw e;
  }
}
