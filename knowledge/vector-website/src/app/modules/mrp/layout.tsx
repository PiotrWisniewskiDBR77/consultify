import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MRP Module — IRIS by DBR77",
  description:
    "Material Requirements Planning aligned with actual demand signals. Automate procurement, reduce excess stock, and prevent shortages.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
