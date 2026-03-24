import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CMMS Module — IRIS by DBR77",
  description:
    "Condition-based maintenance alerts integrated with production planning. Predict failures before they happen and minimize downtime.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
