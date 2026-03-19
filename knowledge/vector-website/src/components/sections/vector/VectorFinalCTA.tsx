"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function VectorFinalCTA() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.finalCta");

  return (
    <section
      className={cn(
        "relative overflow-hidden py-24 sm:py-32",
        isLight
          ? "bg-gradient-to-b from-slate-50 via-white to-white"
          : "bg-navy-950"
      )}
    >
      {!isLight && (
        <div
          className="absolute inset-0 z-0 opacity-20"
          style={{
            backgroundImage: 'url("/images/vector/cta-glow.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <Container size="xl" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
            {t("label")}
          </p>
          <h2
            className={cn(
              "mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl",
              isLight ? "text-slate-900" : "text-white"
            )}
          >
            {t("title")}
          </h2>
          <p
            className={cn(
              "mx-auto mt-5 max-w-2xl text-lg leading-relaxed",
              isLight ? "text-slate-600" : "text-slate-400"
            )}
          >
            {t("subtitle")}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button variant="primary" size="lg" href="https://meetings.hubspot.com/dbr77" className="min-w-[220px]">
              {t("buttons.demo")} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" href="/products" className="min-w-[220px]">
              {t("buttons.products")}
            </Button>
            <Button variant="secondary" size="lg" href="/security-vector" className="min-w-[220px]">
              {t("buttons.security")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
