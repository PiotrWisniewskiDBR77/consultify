import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KPI & Analytics Module — IRIS by DBR77",
  description:
    "Comprehensive performance monitoring and AI-driven insights. Track OEE, throughput, quality, and custom KPIs in real time.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
