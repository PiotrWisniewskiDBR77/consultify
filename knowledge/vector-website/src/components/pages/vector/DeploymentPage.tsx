"use client";

import Image from "next/image";
import { ArrowRight, Check, Server, CloudCog, Sparkles, Container as ContainerIcon, GitBranch, Gauge } from "lucide-react";
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

const deploymentModelIcons = [Server, CloudCog, Sparkles];
const infrastructureIcons = [ContainerIcon, CloudCog, GitBranch, Gauge];

export function DeploymentPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.deployment");

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
                      src="/images/vector/deployment-hero.png"
                      alt="DBR77 Vector deployment — three deployment models: on-premise, private API, shared"
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

      {/* Deployment models */}
      <Section padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("models.label")}
            title={t("models.title")}
            description={t("models.description")}
            align="center"
          />

          <div className="grid gap-8 lg:grid-cols-3">
            {deploymentModelIcons.map((Icon, i) => (
              <Card key={i} variant="glow" padding="lg" className="h-full">
                <div className="flex h-full flex-col gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={cn("text-xl font-bold", isLight ? "text-slate-900" : "text-white")}>
                      {t(`models.items.${i}.title`)}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-iris-violet">
                      {t(`models.items.${i}.tagline`)}
                    </p>
                  </div>
                  <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t(`models.items.${i}.description`)}
                  </p>

                  <div className={cn("rounded-lg p-4", isLight ? "bg-slate-50" : "bg-navy-900/60")}>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-iris-violet">
                      {t("models.bestForLabel")}
                    </p>
                    <p className={cn("mt-1 text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
                      {t(`models.items.${i}.bestFor`)}
                    </p>
                  </div>

                  <ul className="mt-auto space-y-2.5">
                    {[0, 1, 2, 3].map((h) => (
                      <li key={h} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                        <span className={cn(isLight ? "text-slate-600" : "text-slate-400")}>
                          {t(`models.items.${i}.highlights.${h}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Architecture flow (reused from homepage) */}
      <VectorArchitecture />

      {/* Infrastructure details */}
      <Section variant="alternate" padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("infrastructure.label")}
            title={t("infrastructure.title")}
            align="center"
          />

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {infrastructureIcons.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-7",
                  isLight
                    ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                    : "bg-navy-800/40 border-white/[0.06]"
                )}
              >
                <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                  {t(`infrastructure.items.${i}.title`)}
                </h3>
                <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  {t(`infrastructure.items.${i}.description`)}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section padding="md">
        <Container size="xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={cn(
                "text-3xl font-bold tracking-tight sm:text-4xl",
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
              <Button variant="secondary" size="lg" href="/products">
                {t("cta.buttons.products")}
              </Button>
              <Button variant="secondary" size="lg" href="/security-vector">
                {t("cta.buttons.security")}
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
