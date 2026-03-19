"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import { TrendingUp, Calculator, Boxes, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRef } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const RECOMMENDED = [
  { name: "Digital Twin", href: "/modules/dt" },
  { name: "APS", href: "/modules/aps" },
  { name: "CMMS", href: "/modules/cmms" },
  { name: "KPI & Analytics", href: "/modules/kpi" },
  { name: "DATA_AI (LLMind)", href: "/modules/data-ai" },
] as const;

export default function CfoPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const refHero = useRef<HTMLDivElement>(null);
  const refWhy = useRef<HTMLDivElement>(null);
  const refHow = useRef<HTMLDivElement>(null);
  const refModules = useRef<HTMLDivElement>(null);

  const inViewHero = useInView(refHero, { once: true, margin: "-80px" });
  const inViewWhy = useInView(refWhy, { once: true, margin: "-80px" });
  const inViewHow = useInView(refHow, { once: true, margin: "-80px" });
  const inViewModules = useInView(refModules, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-24 sm:pb-32",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Container size="lg" className="relative z-10">
          <div ref={refHero}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewHero ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Badge variant="purple">By Role</Badge>
                <span className={cn("text-xs font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                  CFO
                </span>
              </div>

              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]", isLight ? "text-slate-900" : "text-white")}>
                Stop Guessing ROI.{" "}
                <span className="text-iris-violet">Simulate It.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                IRIS bridges operations and finance. Validate automation and improvement investments
                in a Digital Twin, quantify impact with real data, and enforce governance before
                CAPEX is spent.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="lg" href="/pricing" className="min-w-[240px]">
                  Calculate ROI
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/demo" className="min-w-[240px]">
                  See Demo Factory
                </Button>
              </div>

              <div className="mt-12 w-full max-w-5xl mx-auto">
                <div
                  className={cn(
                    "rounded-2xl overflow-hidden border shadow-2xl",
                    isLight ? "border-black/[0.08] shadow-black/5" : "border-white/10 shadow-black/50"
                  )}
                >
                  <Image
                    src="/images/modules/digital-twin-concept.png"
                    alt="Digital Twin concept — validate improvements in simulation before spending on the real factory"
                    width={1920}
                    height={1080}
                    className="w-full h-auto"
                    quality={90}
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Why it matters */}
      <Section variant="alternate">
        <Container>
          <div ref={refWhy}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewWhy ? "animate" : "initial"}
            >
              <SectionHeader
                label="WHAT YOU GET"
                title="Financial Clarity from Operational Reality"
                description="When operations and finance use different truths, ROI becomes political. IRIS makes it measurable."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Calculator,
                    title: "ROI you can defend",
                    description:
                      "Quantify improvements with real telemetry and scenario simulations. Show assumptions, constraints, and sensitivity.",
                  },
                  {
                    icon: Boxes,
                    title: "CAPEX governance",
                    description:
                      "Approve investments only where impact is verified — and track execution against plan with accountability.",
                  },
                  {
                    icon: TrendingUp,
                    title: "Cost visibility",
                    description:
                      "Expose hidden costs: micro-stops, changeover loss, quality escapes, and unplanned downtime that never hits the P&L cleanly.",
                  },
                ].map(({ icon: Icon, title, description }) => (
                  <motion.div key={title} variants={fadeInUp} className="h-full">
                    <Card variant="glow" padding="lg" className="h-full">
                      <div className="text-iris-violet mb-4">
                        <Icon className="h-8 w-8" aria-hidden />
                      </div>
                      <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>
                        {title}
                      </h3>
                      <p className={cn("mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                        {description}
                      </p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* How it works */}
      <Section variant="default">
        <Container>
          <div ref={refHow}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewHow ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
            >
              <Card variant="glow" padding="lg">
                <SectionHeader
                  label="THE CFO WORKFLOW"
                  title="Validate Before You Invest"
                  description="A repeatable process for operational improvement — with governance and auditability."
                />
                <div className="mt-5 space-y-2">
                  {[
                    "Collect real data from IoT + MES — not weekly spreadsheets.",
                    "Simulate scenarios in the Digital Twin (constraints, bottlenecks, variability).",
                    "Approve only improvements with a defensible ROI.",
                    "Execute via Tasking with verification and escalation rules.",
                    "Track outcomes in KPI dashboards — and learn for the next cycle.",
                  ].map((t) => (
                    <div key={t} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-iris-green mt-0.5" aria-hidden />
                      <span className={cn("text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
                        {t}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" size="md" href="/pricing">
                    ROI Calculator
                  </Button>
                  <Button variant="outline" size="md" href="/modules/tasking">
                    Execution (Tasking)
                  </Button>
                </div>
              </Card>

              <Card variant="glow" padding="lg">
                <div className="flex items-center gap-3 text-iris-violet">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                  <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    Security for finance-grade governance
                  </span>
                </div>
                <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  IRIS supports enterprise-grade controls (access, auditability, encryption) and
                  deployment options. LLMind can run on-premise for sensitive data environments.
                </p>
                <div className="mt-6">
                  <Button variant="outline" size="md" href="/security">
                    Security & Compliance
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Recommended modules */}
      <Section variant="alternate">
        <Container>
          <div ref={refModules}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewModules ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="RECOMMENDED"
                title="Best Starting Points for CFO"
                description="Build a measurement + simulation + governance stack before scaling automation."
                align="center"
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {RECOMMENDED.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:border-iris-purple/30",
                      isLight
                        ? "border-black/[0.08] bg-white text-slate-900 hover:bg-slate-50"
                        : "border-white/10 bg-navy-800/60 text-white hover:bg-navy-800/80"
                    )}
                  >
                    {m.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
              Want a CFO-Grade Demo?
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              We’ll walk through the ROI workflow: data → simulation → approval → execution → verified impact.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Launch Demo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" href="/contact" className="min-w-[240px]">
                Book a Call
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

