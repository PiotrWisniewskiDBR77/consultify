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
import {
  Crown,
  LineChart,
  ShieldCheck,
  Boxes,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
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
  { name: "KPI & Analytics", href: "/modules/kpi" },
  { name: "Digital Twin", href: "/modules/dt" },
  { name: "DATA_AI (LLMind)", href: "/modules/data-ai" },
  { name: "Tasking", href: "/modules/tasking" },
  { name: "Communicator", href: "/modules/communications" },
] as const;

export default function CeoOwnerPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const refHero = useRef<HTMLDivElement>(null);
  const refWhy = useRef<HTMLDivElement>(null);
  const refModules = useRef<HTMLDivElement>(null);
  const refGovernance = useRef<HTMLDivElement>(null);

  const inViewHero = useInView(refHero, { once: true, margin: "-80px" });
  const inViewWhy = useInView(refWhy, { once: true, margin: "-80px" });
  const inViewModules = useInView(refModules, { once: true, margin: "-80px" });
  const inViewGovernance = useInView(refGovernance, { once: true, margin: "-80px" });

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
                  CEO / Owner
                </span>
              </div>

              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]", isLight ? "text-slate-900" : "text-white")}>
                One Operating System for{" "}
                <span className="text-iris-violet">Measurable Results.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                IRIS gives you a single, real-time view of performance across operations — and a way
                to validate ROI before you invest. Measure, optimize, automate — with governance,
                not chaos.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                  Start Interactive Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/pricing" className="min-w-[240px]">
                  Calculate ROI
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
                    src="/images/iris-ui/kpi-dashboard.png"
                    alt="IRIS KPI Dashboard — real-time executive view of performance across operations"
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

      {/* Why IRIS for CEO */}
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
                title="Visibility + ROI Validation + Execution"
                description="Most tools stop at reporting. IRIS closes the loop — from data to decisions to verified execution."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: LineChart,
                    title: "Real-time performance",
                    description:
                      "A single source of truth for OEE, throughput, downtime, quality cost, and delivery reliability — across lines and plants.",
                  },
                  {
                    icon: Boxes,
                    title: "Modular investment",
                    description:
                      "Start small. Expand when results justify it. Every module shares one data layer, one AI, and one communication bus.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Governed transformation",
                    description:
                      "Security and compliance are built-in: SaaS controls, auditability, and on-premise options for sensitive environments.",
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

      {/* Recommended building blocks */}
      <Section variant="default">
        <Container>
          <div ref={refModules}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewModules ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="RECOMMENDED"
                title="Best Starting Points"
                description="These modules create fast executive-level clarity and a reliable execution loop."
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

      {/* Governance & deployment story */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div ref={refGovernance}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewGovernance ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
            >
              <Card variant="glow" padding="lg">
                <div className="flex items-center gap-3 text-iris-violet">
                  <Crown className="h-5 w-5" aria-hidden />
                  <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    Executive governance model
                  </span>
                </div>
                <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  IRIS is designed for controlled transformation. You can roll out one module, prove
                  impact within 90 days, and expand. Every improvement is tracked from hypothesis →
                  simulation → execution → verification.
                </p>
                <div className="mt-5 space-y-2">
                  {[
                    "Validate investments in the Digital Twin before CAPEX is spent.",
                    "Make sure every insight becomes an owned task with a deadline and proof.",
                    "Track adoption and results with executive KPI dashboards.",
                  ].map((t) => (
                    <div key={t} className="flex gap-2">
                      <CheckCircle2 className="h-4 w-4 text-iris-green mt-0.5" aria-hidden />
                      <span className={cn("text-sm", isLight ? "text-slate-600" : "text-slate-400")}>
                        {t}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card variant="glow" padding="lg">
                <div className="flex items-center gap-3 text-iris-violet">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                  <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    Security & compliance
                  </span>
                </div>
                <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  IRIS is enterprise-ready: multi-tenant SaaS architecture, encryption, and policies
                  for data governance. On-premise LLMind is available when sensitive data requires
                  local deployment.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" size="md" href="/security" className="min-w-[220px]">
                    See Security & Compliance
                  </Button>
                  <Button variant="outline" size="md" href="/platform" className="min-w-[220px]">
                    Explore the Platform
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
              Want a Demo Tailored to Your Priorities?
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              We’ll show the exact modules, workflows, and ROI levers that matter to your organization.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Start Interactive Demo
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

