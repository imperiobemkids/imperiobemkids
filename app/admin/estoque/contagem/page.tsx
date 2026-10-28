import { LancarContagem } from "./LancarContagem";

// no Next 16 searchParams e uma Promise e precisa de await
export default async function ContagemPage({
  searchParams,
}: {
  searchParams: Promise<{ folha?: string }>;
}) {
  const { folha } = await searchParams;
  return <LancarContagem folhaInicial={folha ?? null} />;
}
