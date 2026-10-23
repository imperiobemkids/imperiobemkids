"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/*
  Enquanto o pagamento nao confirma, pede os dados da pagina de novo a cada
  4 segundos, por ate 10 minutos. O Pix costuma confirmar em segundos; quem
  passar disso recarrega a pagina depois e ela confere de novo.
*/
export function Aguardar() {
  const router = useRouter();
  useEffect(() => {
    let vezes = 0;
    const t = setInterval(() => {
      if (++vezes > 150) clearInterval(t);
      else router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
