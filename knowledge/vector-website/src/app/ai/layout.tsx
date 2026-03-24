import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Engine — IRIS by DBR77",
  description:
    "Machine Learning, LLM reasoning, and Digital Twin simulation powering every IRIS module. Purpose-built AI for manufacturing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
