"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  Cog,
  TrendingUp,
  Shield,
  CheckCircle2,
  ArrowRight,
  Building2,
  Factory,
  Layers,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const WHY_ICONS = [Factory, Layers, TrendingUp, Shield] as const;
const WHY_KEYS = ["everyPlant", "modular", "roi", "saas"] as const;

const STEP_ICONS = [MessageSquare, Cog, TrendingUp, Building2] as const;
const STEP_KEYS = ["s1", "s2", "s3", "s4"] as const;
const STEP_NUMBERS = ["01", "02", "03", "04"] as const;

const INCLUDED_KEYS = ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"] as const;

export default function PricingPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const t = useTranslations("pricing");

  return (
    <>
      {/* HERO */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-white" : "bg-navy-950 bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              animate: {
                transition: { staggerChildren: 0.12, delayChildren: 0.05 },
              },
            }}
            className="flex flex-col items-center text-center max-w-4xl mx-auto"
          >
            <motion.div variants={fadeInUp}>
              <Badge variant="purple">{t("badge")}</Badge>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className={cn(
                "mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              {t("heroTitle")}{" "}
              <span className="text-iris-violet">{t("heroTitleAccent")}</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              {t("heroDescription")}
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                variant="primary"
                size="lg"
                href="/pilot"
                className="min-w-[220px]"
              >
                {t("ctaPilot")}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                href="/demo"
                className="min-w-[220px]"
              >
                {t("ctaDemo")}
              </Button>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              className={cn(
                "mt-4 text-sm",
                isLight ? "text-slate-500" : "text-slate-500"
              )}
            >
              {t("heroNote")}
            </motion.p>
          </motion.div>
        </Container>
      </section>

      {/* WHY INDIVIDUAL */}
      <Section variant="alternate" padding="lg">
        <Container>
          <SectionHeader
            label={t("whyLabel")}
            title={t("whyTitle")}
            description={t("whyDescription")}
            align="center"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {WHY_KEYS.map((key, i) => {
              const Icon = WHY_ICONS[i];
              return (
                <Card key={key} variant="interactive" padding="lg">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet flex-shrink-0">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <div>
                      <h3 className={cn("font-semibold", isLight ? "text-slate-900" : "text-white")}>
                        {t(`whyItems.${key}.title`)}
                      </h3>
                      <p className={cn("mt-1 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                        {t(`whyItems.${key}.desc`)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* PROCESS */}
      <Section variant="default" padding="lg">
        <Container>
          <SectionHeader
            label={t("processLabel")}
            title={t("processTitle")}
            description={t("processDescription")}
            align="center"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {STEP_KEYS.map((key, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <Card key={key} variant="glow" padding="lg" className="h-full">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold text-iris-violet/30">
                        {STEP_NUMBERS[i]}
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-iris-purple/10 text-iris-violet">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                    </div>
                    <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>
                      {t(`steps.${key}.title`)}
                    </h3>
                    <p className={cn("text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                      {t(`steps.${key}.desc`)}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* SUBSCRIPTION */}
      <Section variant="alternate" padding="lg">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <Badge variant="purple" className="mb-4">
                {t("subscriptionBadge")}
              </Badge>
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t("subscriptionTitle")}
                <br />
                {t("subscriptionTitleLine2")}
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                {t("subscriptionDescription")}
              </p>
              <div className="mt-8">
                <Button
                  variant="primary"
                  size="md"
                  href="/pilot"
                  className="flex items-center gap-2 min-w-[220px]"
                >
                  {t("ctaPilot")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card variant="gradient-border" padding="lg">
              <h3
                className={cn(
                  "text-lg font-semibold mb-6",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {t("includedTitle")}
              </h3>
              <ul className="space-y-3">
                {INCLUDED_KEYS.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <CheckCircle2
                      className="h-5 w-5 text-iris-violet flex-shrink-0 mt-0.5"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-700" : "text-slate-300"
                      )}
                    >
                      {t(`includedItems.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="gradient" padding="lg">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              {t("finalCtaTitle")}
            </h2>
            <p
              className={cn(
                "mt-4 text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              {t("finalCtaDescription")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="primary" size="lg" href="/pilot" className="min-w-[200px]">
                {t("finalCtaPilot")}
              </Button>
              <Button variant="secondary" size="lg" href="/demo" className="min-w-[200px]">
                {t("finalCtaDemo")}
              </Button>
              <Button variant="outline" size="lg" href="/contact" className="min-w-[200px]">
                {t("finalCtaContact")}
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
