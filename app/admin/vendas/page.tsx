import { Suspense } from "react";
import { VendasClient } from "./VendasClient";

// useSearchParams (filtro ?cliente=) exige Suspense na pagina
export default function VendasPage() {
  return (
    <Suspense fallback={null}>
      <VendasClient />
    </Suspense>
  );
}
