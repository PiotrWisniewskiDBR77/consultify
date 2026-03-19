import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Modules — IRIS by DBR77",
  description:
    "14+ integrated modules covering every aspect of factory operations. From MES and WMS to Digital Twin and AI analytics.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
