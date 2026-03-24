import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform — IRIS by DBR77",
  description:
    "The first AI-Native Plant Operating System. From IoT ingestion to Digital Twin simulation — one unified platform for factories.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
