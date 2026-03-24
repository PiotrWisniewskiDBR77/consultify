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
  Server,
  ShieldCheck,
  PlugZap,
  Braces,
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
  { name: "Platform", href: "/platform" },
  { name: "Security & Compliance", href: "/security" },
  { name: "Integrations", href: "/integrations" },
  { name: "IoT", href: "/modules/iot" },
  { name: "DATA_AI (LLMind)", href: "/modules/data-ai" },
] as const;

export default function CtoItPage() {
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
                  CTO / IT
                </span>
              </div>

              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]", isLight ? "text-slate-900" : "text-white")}>
                Secure, API‑First, and{" "}
                <span className="text-iris-violet">ERP‑Friendly.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                IRIS is a multi-tenant SaaS platform designed for manufacturing — with strong security,
                integrations, and governance. Connect to your existing stack instead of ripping it out.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="lg" href="/security" className="min-w-[240px]">
                  Security & Compliance
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/integrations" className="min-w-[240px]">
                  Explore Integrations
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
                    src="/images/platform/cloud-architecture.png"
                    alt="IRIS cloud architecture — multi-tenant platform connecting factories to a central intelligence layer"
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
                title="A Platform IT Can Trust"
                description="Security, governance, and integration patterns designed for industrial environments."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: ShieldCheck,
                    title: "Security by default",
                    description:
                      "Enterprise-grade encryption, access controls, and governance. On-prem LLMind options for sensitive environments.",
                  },
                  {
                    icon: Braces,
                    title: "API-first integration",
                    description:
                      "Connect IRIS to ERP, SCADA, historians, and identity providers. No ERP replacement required.",
                  },
                  {
                    icon: PlugZap,
                    title: "Industrial IoT plug-and-play",
                    description:
                      "Built-in IoT connectivity for fast data collection across different environments, vendors, and legacy constraints.",
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
                  label="DEPLOYMENT"
                  title="Start Small. Scale Securely."
                  description="A pragmatic rollout that respects industrial constraints."
                />
                <div className="mt-5 space-y-2">
                  {[
                    "Connect one line or cell (IoT + MES) and prove value fast.",
                    "Add governance: roles, access, auditability, and security baselines.",
                    "Integrate with your stack (ERP, identity, data sources) through APIs.",
                    "Scale modules while keeping one data layer and one AI core.",
                    "Optional: run LLMind locally for sensitive environments.",
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
                  <Server className="h-5 w-5" aria-hidden />
                  <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                    IT outcomes
                  </span>
                </div>
                <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  Reduce tool sprawl by unifying operations: one platform, shared identity, shared
                  data, shared AI, shared communication. Fewer integrations — better governance.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" size="md" href="/platform">
                    Platform Details
                  </Button>
                  <Button variant="outline" size="md" href="/security">
                    Security Details
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Recommended */}
      <Section variant="alternate">
        <Container>
          <div ref={refModules}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewModules ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="EXPLORE"
                title="Where to Go Next"
                description="Deep dives that answer the most common IT questions."
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
              Want an IT‑Focused Demo?
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              We’ll show architecture, security, and integration patterns — then the operational workflows.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Start Demo
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

