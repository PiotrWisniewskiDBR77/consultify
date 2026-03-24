import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plant Manager — IRIS by DBR77",
  description:
    "See IRIS from the Plant Manager perspective: real-time visibility, AI-driven tasking, faster response, and daily operational control without chaos.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

