import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Story — IRIS by DBR77",
  description:
    "Built by manufacturing leaders who experienced operational complexity firsthand. The story behind the IRIS platform and DBR77.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
