import { FichaClient } from "./FichaClient";

// no Next 16 params e uma Promise e precisa de await
export default async function FichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FichaClient id={id} />;
}
