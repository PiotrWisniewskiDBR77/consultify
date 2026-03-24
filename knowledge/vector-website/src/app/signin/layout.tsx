import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — IRIS by DBR77",
  description:
    "Access your IRIS account. Manage your factory operations, modules, and team from a single AI-native platform.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
