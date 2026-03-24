"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  X,
  LockKeyhole,
  Server,
  Scale,
  ShieldCheck,
  BadgeCheck,
  Shield,
  GitBranch,
  Workflow,
  Container as ContainerIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const pillarIcons = [LockKeyhole, Server, Scale, ShieldCheck, BadgeCheck, Shield];
const pipelineIcons = [GitBranch, Workflow, ContainerIcon];

export function SecurityPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("vector.security");

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
                      src="/images/vector/security-hero.png"
                      alt="DBR77 Vector security — multiple layers of protection for industrial AI"
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

      {/* Security pillars */}
      <Section padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("pillars.label")}
            title={t("pillars.title")}
            description={t("pillars.description")}
            align="center"
          />

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillarIcons.map((Icon, i) => (
              <Card key={i} variant="default" padding="lg" className="h-full">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    {t(`pillars.items.${i}.title`)}
                  </h3>
                  <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    {t(`pillars.items.${i}.description`)}
                  </p>
                  <ul className="mt-auto space-y-2">
                    {[0, 1, 2].map((j) => (
                      <li key={j} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                        <span className={cn(isLight ? "text-slate-600" : "text-slate-400")}>
                          {t(`pillars.items.${i}.bullets.${j}`)}
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

      {/* Comparison table */}
      <Section variant="alternate" padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("comparison.label")}
            title={t("comparison.title")}
            description={t("comparison.description")}
            align="center"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse overflow-hidden rounded-2xl text-sm">
              <thead>
                <tr className={cn(isLight ? "bg-slate-100" : "bg-navy-800")}>
                  <th className={cn("px-4 py-4 text-left font-semibold", isLight ? "text-slate-700" : "text-slate-300")}>
                    {t("comparison.headers.dimension")}
                  </th>
                  <th className="px-4 py-4 text-left font-semibold text-iris-violet">
                    {t("comparison.headers.vector")}
                  </th>
                  <th className={cn("px-4 py-4 text-left font-semibold", isLight ? "text-slate-500" : "text-slate-400")}>
                    {t("comparison.headers.publicLlm")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <tr
                    key={index}
                    className={cn(
                      "border-t",
                      isLight
                        ? index % 2 === 0 ? "bg-white border-black/[0.05]" : "bg-slate-50 border-black/[0.05]"
                        : index % 2 === 0 ? "bg-navy-900/40 border-white/[0.05]" : "bg-navy-900/20 border-white/[0.05]"
                    )}
                  >
                    <td className={cn("px-4 py-4 font-medium", isLight ? "text-slate-700" : "text-slate-300")}>
                      {t(`comparison.rows.${index}.dimension`)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-iris-violet" />
                        <span className={cn(isLight ? "text-slate-700" : "text-slate-300")}>
                          {t(`comparison.rows.${index}.vector`)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex gap-2">
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                        <span className="text-slate-500">
                          {t(`comparison.rows.${index}.publicLlm`)}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* Pipeline security */}
      <Section padding="lg">
        <Container size="xl">
          <SectionHeader
            label={t("pipeline.label")}
            title={t("pipeline.title")}
            description={t("pipeline.description")}
            align="center"
          />

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {pipelineIcons.map((Icon, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-7",
                  isLight
                    ? "bg-white border-slate-200 shadow-md shadow-black/[0.05]"
                    : "bg-navy-800/40 border-white/[0.06]"
                )}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className={cn("text-lg font-semibold", isLight ? "text-slate-900" : "text-white")}>
                  {t(`pipeline.items.${i}.title`)}
                </h3>
                <p className={cn("mt-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  {t(`pipeline.items.${i}.description`)}
                </p>
              </div>
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
