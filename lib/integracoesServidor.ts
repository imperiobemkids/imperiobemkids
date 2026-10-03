import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
  Pecas de servidor comuns a todas as integracoes de marketplace (Shopee hoje;
  Mercado Livre, TikTok Shop e Kwai depois). So rotas de app/api usam este
  arquivo. Cada plataforma tem a sua pasta (lib/shopee/servidor.ts) com a API
  propria e usa daqui: quem chama, o cofre dos tokens e a linha da conexao.
*/

export type Plataforma = "shopee" | "mercadolivre" | "tiktok" | "kwai";
export type Ambiente = "teste" | "producao";

/* ---------- quem chama: so administrador do ERP ---------- */

/*
  A rota recebe o token de login do Supabase no cabecalho Authorization e
  consulta o banco COMO esse usuario (RLS vale normalmente). Nao usa a chave
  service_role: se a pessoa nao e admin, ibk_e_admin() devolve falso.
*/
export async function clienteDoAdmin(req: Request): Promise<SupabaseClient | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return Response.json({ erro: "banco nao configurado" }, { status: 500 });
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/.test(auth)) return Response.json({ erro: "entre no ERP de novo" }, { status: 401 });
  const db = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("ibk_e_admin");
  if (error || data !== true) return Response.json({ erro: "acesso so para administrador" }, { status: 403 });
  return db;
}

/* ---------- cofre ---------- */

/*
  Os tokens ficam no banco cifrados com AES-256-GCM. A chave sai do segredo do
  app de cada plataforma (que so existe no servidor), entao quem le a tabela
  pelo navegador ve texto cifrado. Trocar o segredo do app obriga a conectar
  de novo aquela plataforma, e so ela.
*/
const chave = (segredo: string) => createHash("sha256").update(`ibk-cofre:${segredo}`).digest();

export function cifrar(dados: unknown, segredo: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(segredo), iv);
  const corpo = Buffer.concat([c.update(JSON.stringify(dados), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), corpo].map((b) => b.toString("base64")).join(".");
}

export function decifrar<T>(texto: string, segredo: string): T {
  const [iv, tag, corpo] = texto.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", chave(segredo), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(corpo), d.final()]).toString("utf8")) as T;
}

/* ---------- conexao (tabela ibk_integracoes, migration 0034) ---------- */

export type Conexao = {
  canal_id: string;
  plataforma: Plataforma;
  ambiente: Ambiente;
  loja_id: string | null;
  extra: Record<string, unknown>;
  cofre: string | null;
  access_expira_em: string | null;
  refresh_expira_em: string | null;
  conectado_em: string | null;
  ultima_sync: string | null;
};

export class ErroIntegracao extends Error {
  constructor(public codigo: string, mensagem: string, public requestId?: string) {
    super(mensagem);
  }
}

const erroBanco = (m: string) => new ErroIntegracao("banco", /ibk_integracoes/.test(m) ? "rode a migration 0034 no SQL Editor" : m);

/* conexao da plataforma; com canalId, a daquele canal (para quando houver duas lojas na mesma plataforma) */
export async function lerConexao(db: SupabaseClient, plataforma: Plataforma, canalId?: string): Promise<Conexao | null> {
  let q = db.from("ibk_integracoes").select("*").eq("plataforma", plataforma);
  if (canalId) q = q.eq("canal_id", canalId);
  const { data, error } = await q.order("conectado_em", { ascending: false, nullsFirst: false }).limit(1);
  if (error) throw erroBanco(error.message);
  return ((data ?? [])[0] as Conexao | undefined) ?? null;
}

export async function salvarConexao(db: SupabaseClient, linha: Partial<Conexao> & { canal_id: string; plataforma: Plataforma }) {
  const { error } = await db.from("ibk_integracoes").upsert({ ...linha, updated_at: new Date().toISOString() });
  if (error) throw erroBanco(error.message);
}

/* ---------- tokens OAuth: guardar e manter validos ---------- */

// o que toda plataforma devolve ao autorizar ou renovar, ja no formato daqui
export type Tokens = { access: string; refresh: string; expiraEmSeg: number; refreshDias: number };
type Cofre = { access: string; refresh: string };

export async function guardarTokens(
  db: SupabaseClient,
  base: { canal_id: string; plataforma: Plataforma; ambiente: Ambiente; loja_id: string; extra?: Record<string, unknown> },
  t: Tokens,
  segredo: string,
  conectando = false,
) {
  const agora = Date.now();
  await salvarConexao(db, {
    ...base,
    cofre: cifrar({ access: t.access, refresh: t.refresh } satisfies Cofre, segredo),
    access_expira_em: new Date(agora + t.expiraEmSeg * 1000).toISOString(),
    refresh_expira_em: new Date(agora + t.refreshDias * 86400 * 1000).toISOString(),
    ...(conectando ? { conectado_em: new Date(agora).toISOString() } : {}),
  });
}

/*
  Token de acesso valido da loja. Faltando menos de 5 minutos para vencer,
  renova com o refresh token, que nas plataformas e de uso unico. Se duas abas
  renovarem juntas, a segunda falha: le de novo o banco e usa o token que a
  primeira gravou.
*/
export async function acessoValido(
  db: SupabaseClient,
  plataforma: Plataforma,
  canalId: string | undefined,
  segredo: string,
  ambiente: Ambiente,
  renovar: (refresh: string, conexao: Conexao) => Promise<Tokens>,
): Promise<{ token: string; conexao: Conexao }> {
  const linha = await lerConexao(db, plataforma, canalId);
  if (!linha?.cofre || !linha.loja_id) throw new ErroIntegracao("nao_conectado", "a loja ainda nao foi conectada");
  if (linha.ambiente !== ambiente) {
    throw new ErroIntegracao("ambiente", `a loja foi conectada no ambiente de ${linha.ambiente}; conecte de novo`);
  }
  const valido = (iso: string | null, folgaMs: number) => (iso ? new Date(iso).getTime() - Date.now() > folgaMs : false);
  const cofre = decifrar<Cofre>(linha.cofre, segredo);
  if (valido(linha.access_expira_em, 5 * 60 * 1000)) return { token: cofre.access, conexao: linha };
  try {
    const novo = await renovar(cofre.refresh, linha);
    await guardarTokens(db, { canal_id: linha.canal_id, plataforma, ambiente, loja_id: linha.loja_id, extra: linha.extra }, novo, segredo);
    return { token: novo.access, conexao: linha };
  } catch (e) {
    const outra = await lerConexao(db, plataforma, linha.canal_id);
    if (outra?.cofre && valido(outra.access_expira_em, 60 * 1000)) return { token: decifrar<Cofre>(outra.cofre, segredo).access, conexao: outra };
    throw e;
  }
}
