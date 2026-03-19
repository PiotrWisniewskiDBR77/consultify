"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const BADGE_INDICES = [0, 1, 2] as const;

export function VectorHero() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.home.hero");

  return (
    <section
      className={cn(
        "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
        isLight
          ? "bg-gradient-to-b from-slate-50 via-white to-white"
          : "bg-navy-950 bg-gradient-hero",
        !isLight && "grid-pattern"
      )}
    >
      <div className="noise-overlay absolute inset-0" />
      <Container size="xl" className="relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex flex-wrap justify-center gap-3">
            {BADGE_INDICES.map((index) => (
              <Badge key={index} variant={index === 0 ? "purple" : "outline"}>
                {t(`badges.${index}`)}
              </Badge>
            ))}
          </div>

          <h1
            className={cn(
              "mt-8 text-4xl font-bold tracking-tight leading-[1.08] sm:text-5xl md:text-6xl lg:text-7xl",
              isLight ? "text-slate-900" : "text-white"
            )}
          >
            {t.rich("title", {
              gradient: (chunks) => (
                <span className="text-gradient">{chunks}</span>
              ),
            })}
          </h1>

          <p
            className={cn(
              "mx-auto mt-7 max-w-3xl text-lg leading-relaxed sm:text-xl",
              isLight ? "text-slate-600" : "text-slate-300"
            )}
          >
            {t("subtitle")}
          </p>

          <div className="mx-auto mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              href="/products"
              className="min-w-[220px]"
            >
              {t("buttons.products")} <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" href="/training" className="min-w-[220px]">
              {t("buttons.training")}
            </Button>
          </div>

          <p
            className={cn(
              "mx-auto mt-8 text-sm font-mono tracking-wide",
              isLight ? "text-slate-600" : "text-slate-500"
            )}
          >
            {t("techLine")}
          </p>

          {!isLight && (
            <div className="mx-auto mt-14 max-w-xl">
              <div className="rounded-2xl p-[1px] bg-gradient-to-b from-iris-purple/30 via-iris-violet/15 to-transparent">
                <div className="rounded-[15px] overflow-hidden bg-navy-900/80">
                  <Image
                    src="/images/vector/vector-hero.png"
                    alt="DBR77 Vector — Industrial AI Engine"
                    width={1200}
                    height={800}
                    className="w-full h-auto object-contain opacity-75"
                    priority
                  />
                </div>
              </div>
            </div>
          )}

          <div className={cn("mx-auto grid max-w-4xl gap-5 sm:grid-cols-3", isLight ? "mt-12" : "mt-16")}>
            <div
              className={cn(
                "rounded-2xl border p-6",
                isLight
                  ? "bg-white border-slate-200 shadow-md shadow-black/[0.06]"
                  : "bg-navy-900/60 border-white/[0.08]"
              )}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
                {t("cards.model.label")}
              </p>
              <p className={cn("mt-3 text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                {t("cards.model.title")}
              </p>
              <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                {t("cards.model.description")}
              </p>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-6",
                isLight
                  ? "bg-white border-slate-200 shadow-md shadow-black/[0.06]"
                  : "bg-navy-900/60 border-white/[0.08]"
              )}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
                {t("cards.inference.label")}
              </p>
              <p className={cn("mt-3 text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                {t("cards.inference.title")}
              </p>
              <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                {t("cards.inference.description")}
              </p>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-6",
                isLight
                  ? "bg-white border-slate-200 shadow-md shadow-black/[0.06]"
                  : "bg-navy-900/60 border-white/[0.08]"
              )}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
                {t("cards.security.label")}
              </p>
              <p className={cn("mt-3 text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                {t("cards.security.title")}
              </p>
              <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                {t("cards.security.description")}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
