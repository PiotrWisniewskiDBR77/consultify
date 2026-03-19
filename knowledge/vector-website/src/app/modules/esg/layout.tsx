import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ESG Module — IRIS by DBR77",
  description:
    "Environmental, Social, and Governance tracking for manufacturing enterprises. Automate sustainability reporting and compliance.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
