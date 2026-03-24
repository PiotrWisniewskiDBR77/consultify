import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — IRIS by DBR77",
  description:
    "Book a demo, start a free trial, or reach out to our team. We help manufacturers deploy AI-native operations at scale.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
