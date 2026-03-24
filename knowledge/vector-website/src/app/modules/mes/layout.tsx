import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MES Module — IRIS by DBR77",
  description:
    "Manufacturing Execution System tied to AI-backed flow optimization. Track orders, OEE, and shop-floor operations in real time.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
