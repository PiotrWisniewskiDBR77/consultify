import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DATA_AI & LLMind Module — IRIS by DBR77",
  description:
    "AI engine with ML, LLM reasoning, and proprietary LLMind orchestration. Turn raw factory data into actionable intelligence.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
