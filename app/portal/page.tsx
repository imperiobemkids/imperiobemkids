import type { Metadata } from "next";
import { SiteHeader } from "../SiteHeader";
import { PortalForm } from "./PortalForm";

export const metadata: Metadata = {
  title: "Portal do Cliente",
  robots: { index: false, follow: false },
};

export default function PortalPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-14">
        <PortalForm />
      </main>
    </>
  );
}
