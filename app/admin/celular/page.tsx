import { networkInterfaces } from "node:os";
import { VerNoCelular } from "./VerNoCelular";

/* no servidor local, os enderecos do PC na rede (Wi-Fi) para abrir o ERP no celular de verdade */
function enderecosDaRede(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}

export default function CelularPage() {
  return <VerNoCelular enderecos={enderecosDaRede()} porta={process.env.PORT ?? "3000"} />;
}
