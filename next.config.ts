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
  // 'self': a tela Ver no celular (/admin/celular) mostra o proprio ERP em quadros do tamanho do celular
  "frame-src 'self' https://www.facebook.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  // o Pixel manda o evento como form para facebook.com/tr
  "form-action 'self' https://www.facebook.com",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const headers = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // o celular na mesma rede Wi-Fi abre o servidor local pelo IP do PC (ex.: 192.168.15.4)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // foto de produto pode vir do Storage do Supabase, alem de /public
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  // os arquivos pagos e os dados da lista (cifrados) sao lidos do disco pelo servidor
  outputFileTracingIncludes: {
    "/api/entrega/**": ["./entregaveis/**/*.enc"],
    "/api/lista/**": ["./entregaveis/**/*.enc"],
    "/obrigado/**": ["./entregaveis/**/*.enc"],
  },
  async headers() {
    return [
      { source: "/((?!api/entrega/).*)", headers },
      // o PDF abre no leitor do navegador, que a CSP do site (object-src 'none') pode barrar
      {
        source: "/api/entrega/:path*",
        headers: headers.filter((h) => h.key !== "Content-Security-Policy" && h.key !== "X-Frame-Options"),
      },
    ];
  },
};

export default nextConfig;
