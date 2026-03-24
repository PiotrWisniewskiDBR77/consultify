import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Use Cases — IRIS by DBR77",
  description:
    "Real manufacturing problems solved with measurable ROI. See how IRIS transforms production, quality, and maintenance workflows.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
