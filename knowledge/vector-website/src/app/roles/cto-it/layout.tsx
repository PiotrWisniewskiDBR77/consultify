import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CTO / IT — IRIS by DBR77",
  description:
    "See IRIS from the CTO/IT perspective: secure SaaS architecture, API-first integration, data governance, and industrial-grade compliance without ERP replacement.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

