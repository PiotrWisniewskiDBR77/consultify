import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CFO — IRIS by DBR77",
  description:
    "See IRIS from the CFO perspective: validated ROI, Digital Twin simulation, cost transparency, and investment governance before CAPEX is spent.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

