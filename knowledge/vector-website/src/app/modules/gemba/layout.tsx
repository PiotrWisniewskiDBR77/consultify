import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gemba Module — IRIS by DBR77",
  description:
    "Digital daily management and team communication platform. Streamline shop-floor meetings, action tracking, and escalation workflows.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
