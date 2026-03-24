import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations — IRIS by DBR77",
  description:
    "Connect IRIS with your existing ERP, SCADA, and enterprise systems. Pre-built connectors for SAP, Oracle, Siemens, and more.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
