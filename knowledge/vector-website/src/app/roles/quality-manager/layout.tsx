import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quality Manager — IRIS by DBR77",
  description:
    "See IRIS from the Quality Manager perspective: traceability, faster root-cause analysis, automated inspection loops, and AI-driven defect prevention.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

