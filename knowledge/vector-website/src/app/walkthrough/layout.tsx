import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Walkthrough — IRIS by DBR77",
  description:
    "A fast, 2‑minute walkthrough of IRIS: see the AI‑native Plant Operating System, Tasking, and communication in context.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

