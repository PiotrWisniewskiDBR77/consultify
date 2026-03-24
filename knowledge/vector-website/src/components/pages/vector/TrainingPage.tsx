"use client";

import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChartColumnIncreasing,
  Factory,
  Route,
  Target,
  Workflow,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { VectorArchitecture } from "@/components/sections/vector/VectorArchitecture";

const competencyIcons = [Factory, Route, Workflow, ChartColumnIncreasing, Wrench, Target] as const;

export function TrainingPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.training");

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-gradient-to-b from-slate-50 via-white to-white" : "bg-navy-950 bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <div className="noise-overlay absolute inset-0" />
        <Container size="xl" className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="purple">{t("hero.badge")}</Badge>

            <h1
              className={cn(
                "mt-8 text-4xl font-bold tracking-tight leading-[1.08] sm:text-5xl md:text-6xl",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              {t.rich("hero.title", {
                gradient: (chunks) => <span className="text-gradient">{chunks}</span>,
              })}
            </h1>

            <p
              className={cn(
                "mx-auto mt-7 max-w-3xl text-lg leading-relaxed sm:text-xl",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              {t("hero.subtitle")}
            </p>
            <p
              className={cn(
                "mx-auto mt-4 text-sm font-mono tracking-wide",
                isLight ? "text-slate-600" : "text-slate-500"
              )}
            >
              {t("hero.techLine")}
            </p>
            {!isLight && (
              <div className="mx-auto mt-12 max-w-2xl">
                <div className="rounded-2xl bg-gradient-to-b from-iris-purple/10 to-transparent p-[1px]">
                  <div className="rounded-[15px] overflow-hidden">
                    <Image
                      src="/images/vector/training-hero.png"
                      alt="DBR77 Vector training — knowledge distilled from real transformations"
                      width={1200}
                      height={600}
                      className="w-full h-auto object-contain opacity-70"
                      priority
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Technical specs bar */}
      <div
        className={cn(
          "border-y py-10",
          isLight ? "bg-slate-50 border-slate-200" : "bg-navy-900/40 border-white/[0.04]"
        )}
      >
        <Container size="xl">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 text-center">
            {([0, 1, 2, 3] as const).map((i) => (
              <div key={i}>
                <p className="text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
                  {t(`specs.items.${i}.value`)}
                </p>
                <p className={cn("mt-1 text-xs", isLight ? "text-slate-500" : "text-slate-500")}>
                  {t(`specs.items.${i}.label`)}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </div>

      {/* Training pipeline steps */}
      <Section padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("pipeline.label")}
            title={t("pipeline.title")}
            description={t("pipeline.description")}
            align="center"
          />

          <div className="mx-auto max-w-3xl space-y-8">
            {([0, 1, 2, 3] as const).map((i) => (
              <div key={i} className="flex gap-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet font-bold text-lg">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    {t(`pipeline.steps.${i}.title`)}
                  </h3>
                  <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t(`pipeline.steps.${i}.body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Architecture flow (reused from homepage) */}
      <VectorArchitecture />

      {/* Competencies */}
      <Section variant="alternate" padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("competencies.label")}
            title={t("competencies.title")}
            description={t("competencies.description")}
            align="center"
          />

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {([0, 1, 2, 3, 4, 5] as const).map((i) => {
              const Icon = competencyIcons[i];
              return (
                <Card key={i} variant="default" padding="lg" className="h-full">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      {t(`competencies.items.${i}.title`)}
                    </h3>
                    <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {t(`competencies.items.${i}.description`)}
                    </p>
                    <ul className="mt-auto space-y-2">
                      {([0, 1, 2] as const).map((j) => (
                        <li key={j} className="flex gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                          <span className={cn(isLight ? "text-slate-600" : "text-slate-400")}>
                            {t(`competencies.items.${i}.bullets.${j}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section padding="lg">
        <Container size="xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-iris-violet">
              {t("cta.label")}
            </p>
            <h2
              className={cn(
                "mt-4 text-3xl font-bold tracking-tight sm:text-4xl",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              {t("cta.title")}
            </h2>
            <p
              className={cn(
                "mx-auto mt-5 max-w-2xl text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              {t("cta.subtitle")}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button variant="primary" size="lg" href="https://meetings.hubspot.com/dbr77">
                {t("cta.buttons.demo")} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/deployment">
                {t("cta.buttons.deployment")}
              </Button>
              <Button variant="secondary" size="lg" href="/products">
                {t("cta.buttons.products")}
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
