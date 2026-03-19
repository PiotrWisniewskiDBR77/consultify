import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CEO / Owner — IRIS by DBR77",
  description:
    "See IRIS from the CEO/Owner perspective: one unified operating system for measurable ROI, investment validation, and operational control across plants.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

