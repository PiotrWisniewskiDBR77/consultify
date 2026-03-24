import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Twin Module — IRIS by DBR77",
  description:
    "High-fidelity 3D factory simulation with live sensor data. Test scenarios, optimize layouts, and predict outcomes before acting.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
