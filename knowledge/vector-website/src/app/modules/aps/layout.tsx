import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "APS Module — IRIS by DBR77",
  description:
    "Advanced Planning & Scheduling validated by simulation models. Optimize production sequences and resource allocation with AI.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
