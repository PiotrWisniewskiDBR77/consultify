import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tasking — IRIS by DBR77",
  description:
    "AI-driven task management for manufacturing. Assign work from plan, enforce accountability, and close the loop from insight to action across the plant.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

