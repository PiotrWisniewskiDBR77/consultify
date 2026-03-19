import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HRM Module — IRIS by DBR77",
  description:
    "Production workforce management with competence tracking and shift optimization. Align human resources with operational demands.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
