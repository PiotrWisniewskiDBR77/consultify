import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QMS Module — IRIS by DBR77",
  description:
    "Quality tracking driven by automated defect prediction. Reduce scrap, enforce standards, and close the loop with AI insights.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
