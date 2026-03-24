import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communicator — IRIS by DBR77",
  description:
    "Context-based communication for manufacturing. Messages, groups, alerts, and broadcasts tied to lines, machines, orders, and real operational context.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

