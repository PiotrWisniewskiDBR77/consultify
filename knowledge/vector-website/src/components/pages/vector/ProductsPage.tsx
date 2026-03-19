"use client";

import { ArrowRight, BrainCircuit, Binary, Radar, Blocks, Check, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const PRODUCT_META = [
  { icon: BrainCircuit, href: "https://consultify.ai" },
  { icon: Binary, href: "https://www.dbr77.com/en/digital_twin/" },
  { icon: Radar, href: "https://www.dbr77.com/en/iiot" },
  { icon: Blocks, href: "https://www.dbr77.com/en/marketplace/" },
] as const;

const BENEFIT_COUNT = 5;

export function ProductsPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.products");

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
            <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-4">
              {PRODUCT_META.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full border border-iris-purple/20 bg-iris-purple/5 px-5 py-2.5 text-sm font-medium text-iris-violet"
                >
                  {t(`ecosystem.items.${i}.title`)}
                </span>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Tech specs bar */}
      <div
        className={cn(
          "border-y py-6",
          isLight ? "bg-slate-50 border-slate-200" : "bg-navy-900 border-slate-400/[0.06]"
        )}
      >
        <Container size="xl">
          <div className="flex flex-wrap items-center justify-center gap-6 text-center">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "text-xs font-medium tracking-wide",
                  isLight ? "text-slate-500" : "text-slate-500"
                )}
              >
                {t(`techBar.items.${i}`)}
              </span>
            ))}
          </div>
        </Container>
      </div>

      {/* Product cards */}
      <Section padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("ecosystem.label")}
            title={t("ecosystem.title")}
            description={t("ecosystem.description")}
            align="center"
          />

          <div className="space-y-10">
            {PRODUCT_META.map(({ icon: Icon, href }, index) => (
              <Card key={index} variant="glow" padding="lg">
                <div className={cn("flex flex-col gap-8 lg:flex-row lg:items-start", index % 2 !== 0 && "lg:flex-row-reverse")}>
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className={cn("text-xl font-bold", isLight ? "text-slate-900" : "text-white")}>
                          {t(`ecosystem.items.${index}.title`)}
                        </h3>
                        <p className="text-sm font-medium text-iris-violet">
                          {t(`ecosystem.items.${index}.tagline`)}
                        </p>
                      </div>
                    </div>

                    <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {t(`ecosystem.items.${index}.description`)}
                    </p>

                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-iris-violet hover:text-iris-magenta transition-colors"
                    >
                      {t("ecosystem.visitPrefix")} {t(`ecosystem.items.${index}.title`)}{" "}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className={cn("flex-1 rounded-xl p-6", isLight ? "bg-slate-50" : "bg-navy-900/60")}>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-iris-violet">
                      {t("ecosystem.benefitsLabel")}
                    </p>
                    <ul className="space-y-3">
                      {Array.from({ length: BENEFIT_COUNT }, (_, bi) => (
                        <li key={bi} className="flex gap-2.5 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                          <span className={cn(isLight ? "text-slate-700" : "text-slate-300")}>
                            {t(`ecosystem.items.${index}.benefits.${bi}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="alternate" padding="md">
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
              <Button variant="secondary" size="lg" href="/deployment">
                {t("cta.buttons.deployment")}
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
