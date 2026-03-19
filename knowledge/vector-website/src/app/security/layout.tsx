import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security & Compliance — IRIS by DBR77",
  description:
    "ISO 27001, SOC 2, GDPR, and IEC 62443 certified. Enterprise-grade security for your manufacturing data and operations.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
