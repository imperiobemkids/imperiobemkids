import type { NextConfig } from "next";

/*
  Cabecalhos de seguranca. A CSP libera so o que o site usa de fato:
  scripts e imagens da Meta (Pixel), fontes do Google, e o Supabase do
  Imperio nas conexoes. 'unsafe-inline' em script fica por causa do JSON-LD
  e do snippet do Pixel; quando houver nonce, apertar.
*/
const dev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const supabaseWs = supabase.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  // o hot reload do Next em dev precisa de eval; em producao nao entra
  `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval'" : ""} https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://www.facebook.com https://*.supabase.co",
  `connect-src 'self' ${supabase} ${supabaseWs} https://www.facebook.com https://connect.facebook.net`,
  "frame-src https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // o Pixel manda o evento como form para facebook.com/tr
  "form-action 'self' https://www.facebook.com",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const headers = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // foto de produto pode vir do Storage do Supabase, alem de /public
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  async headers() {
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
