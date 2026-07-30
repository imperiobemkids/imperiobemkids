import type { Metadata } from "next";
import { SiteHeader } from "../SiteHeader";

export const metadata: Metadata = { title: "Sobre" };

export default function SobrePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16 text-center">
        <h1 className="font-[family-name:var(--font-baloo)] text-3xl font-extrabold text-[var(--purple-dark)]">
          Sobre o Império Bem Kids
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--ink)]/70">
          Nossa história e o que move a marca vêm em breve por aqui. 💜
        </p>
      </main>
    </>
  );
}
