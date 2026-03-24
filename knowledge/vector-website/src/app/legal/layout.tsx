"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  return (
    <div
      className={cn(
        "min-h-screen pt-32 pb-20",
        isLight ? "bg-white" : "bg-navy-950"
      )}
    >
      <Container className="max-w-4xl">
        <article
          className={cn(
            "prose prose-slate max-w-none",
            isLight
              ? "text-slate-600 [&_h1]:!text-slate-900 [&_h2]:!text-slate-900 [&_h3]:!text-slate-900 [&_strong]:!text-slate-900 [&_p]:!text-slate-600 [&_li]:!text-slate-600"
              : "prose-invert text-slate-300 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white",
            "[&_a]:text-iris-violet [&_a]:no-underline hover:[&_a]:underline"
          )}
        >
          {children}
        </article>
      </Container>
    </div>
  );
}
