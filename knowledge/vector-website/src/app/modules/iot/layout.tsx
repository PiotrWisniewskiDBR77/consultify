import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IoT Module — IRIS by DBR77",
  description:
    "Connect sensors and stream live telemetry to the IRIS decision engine. Real-time IoT monitoring for smart manufacturing.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
