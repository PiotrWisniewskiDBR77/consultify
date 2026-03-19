import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HSE Module — IRIS by DBR77",
  description:
    "Health, Safety, and Environment monitoring for plant compliance. Automate incident reporting, audits, and regulatory tracking.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
