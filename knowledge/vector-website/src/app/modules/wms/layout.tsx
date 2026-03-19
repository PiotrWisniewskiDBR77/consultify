import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WMS Module — IRIS by DBR77",
  description:
    "Warehouse Management synchronized with production schedules. Optimize inventory, picking, and material flow across your plant.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
