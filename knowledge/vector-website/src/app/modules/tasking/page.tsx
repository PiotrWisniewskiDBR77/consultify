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
  CheckSquare,
  CalendarClock,
  Users,
  Brain,
  ShieldCheck,
  ArrowRight,
  Factory,
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

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Plan-Driven Assignment",
    description:
      "Tasks are generated directly from production plans, work orders, maintenance schedules, and quality checks — so the shop floor executes the plan, not ad‑hoc requests.",
  },
  {
    icon: Brain,
    title: "AI-Powered Recommendations",
    description:
      "When anomalies occur, IRIS suggests the right next tasks, the right owner, and the right deadline — based on competence, current workload, and production priorities.",
  },
  {
    icon: Users,
    title: "Competence & Ownership",
    description:
      "Assign tasks by role, skill, line, and shift. Everyone knows what they own — and managers can see execution health in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Accountability by Design",
    description:
      "Every task is tracked: created → assigned → accepted → executed → verified. No ‘done’ without proof, and no delays without an escalation path.",
  },
] as const;

const INTEGRATIONS = [
  { name: "MES", href: "/modules/mes" },
  { name: "APS", href: "/modules/aps" },
  { name: "CMMS", href: "/modules/cmms" },
  { name: "QMS", href: "/modules/qms" },
  { name: "Gemba", href: "/modules/gemba" },
  { name: "DATA_AI", href: "/modules/data-ai" },
] as const;

export default function TaskingPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const refHero = useRef<HTMLDivElement>(null);
  const refFeatures = useRef<HTMLDivElement>(null);
  const refScreenshot = useRef<HTMLDivElement>(null);
  const refIntegrations = useRef<HTMLDivElement>(null);

  const inViewHero = useInView(refHero, { once: true, margin: "-80px" });
  const inViewFeatures = useInView(refFeatures, { once: true, margin: "-80px" });
  const inViewScreenshot = useInView(refScreenshot, { once: true, margin: "-80px" });
  const inViewIntegrations = useInView(refIntegrations, { once: true, margin: "-80px" });

  return (
    <>
      {/* Section 1 — Hero */}
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
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-2 mb-5">
                <Badge variant="purple">Core Capability</Badge>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Execution layer
                </span>
              </div>
              <h1
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Tasking for the Factory —{" "}
                <span className="text-iris-violet">Not Just a Checklist.</span>
              </h1>
              <p
                className={cn(
                  "mt-6 text-lg sm:text-xl max-w-3xl leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                In manufacturing, tasks are the difference between insight and impact. IRIS ensures
                the right work is assigned to the right people — at the right time — and then
                verified. Think of it as ClickUp‑level usability, built for an entire plant and
                connected to live production reality.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Button variant="primary" size="lg" href="/demo" className="min-w-[260px]">
                  Start Interactive Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/contact" className="min-w-[260px]">
                  Book a Guided Walkthrough
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
                    src="/images/iris-ui/gemba-task-management.png"
                    alt="IRIS Task Management — plan-driven work execution with accountability and status tracking"
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

      {/* Section 2 — Why it matters */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            label="WHY TASKING"
            title="Execution Wins (or Loses) on the Shop Floor."
            description="Dashboards don’t change reality. People do — when they know exactly what to do, when to do it, and how success is verified."
            align="center"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
            {[
              {
                title: "Correct assignment",
                description:
                  "Assign work based on competence, shift, and location — not whoever happens to notice the issue first.",
              },
              {
                title: "Fast resolution",
                description:
                  "Tasks carry context (line, machine, work order, material lot) so teams don’t waste time searching for information.",
              },
              {
                title: "Real accountability",
                description:
                  "Every task has an owner, a deadline, a verification step, and an escalation rule. That’s how execution becomes reliable.",
              },
            ].map((item) => (
              <Card key={item.title} variant="glow" padding="lg">
                <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>
                  {item.title}
                </h3>
                <p className={cn("mt-3 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 3 — Key features */}
      <Section variant="default">
        <Container>
          <div ref={refFeatures}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewFeatures ? "animate" : "initial"}
            >
              <SectionHeader
                label="FEATURES"
                title="A Closed-Loop Tasking System"
                description="From plan → tasks → execution → verification. Humans stay in control, AI accelerates the cycle."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <motion.div key={title} variants={fadeInUp} className="h-full">
                    <Card variant="glow" padding="lg" className="h-full">
                      <div className="flex gap-4">
                        <div className="text-iris-violet">
                          <Icon className="h-7 w-7" aria-hidden />
                        </div>
                        <div className="flex-1">
                          <h3
                            className={cn(
                              "font-semibold text-lg",
                              isLight ? "text-slate-900" : "text-white"
                            )}
                          >
                            {title}
                          </h3>
                          <p
                            className={cn(
                              "mt-2 leading-relaxed",
                              isLight ? "text-slate-600" : "text-slate-400"
                            )}
                          >
                            {description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Screenshot / workflow */}
      <Section variant="alternate">
        <Container>
          <div ref={refScreenshot}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewScreenshot ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="IN PRACTICE"
                title="Tasks That Follow the Plan"
                description="IRIS generates work from the production plan and keeps everyone aligned — from line leaders to maintenance, quality, and logistics."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 mb-3 text-iris-violet">
                    <Factory className="h-5 w-5" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      Manufacturing-specific by design
                    </span>
                  </div>
                  <ul className={cn("space-y-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    <li>- Work orders and constraints become actionable task bundles.</li>
                    <li>- Shift handovers carry open tasks forward automatically.</li>
                    <li>- Escalations trigger when deadlines or KPIs are at risk.</li>
                    <li>- Verification steps tie back to data (photos, measurements, checklists).</li>
                  </ul>
                </Card>

                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 mb-3 text-iris-violet">
                    <CheckSquare className="h-5 w-5" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      The execution loop
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Detect", "Diagnose", "Assign", "Execute", "Verify", "Learn"].map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "px-3 py-1 rounded-full border text-xs font-medium",
                          isLight ? "border-black/[0.08] bg-white text-slate-700" : "border-white/10 bg-navy-800/60 text-slate-200"
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className={cn("mt-4 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    The goal is simple: fewer surprises, faster response, and measurable execution —
                    with human-led governance.
                  </p>
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Integrations */}
      <Section variant="default">
        <Container>
          <div ref={refIntegrations}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewIntegrations ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="INTEGRATES WITH"
                title="Works Across Every Module"
                description="Tasking is the execution fabric that connects your plan, your data, and your people."
                align="center"
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {INTEGRATIONS.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:border-iris-purple/30",
                      isLight
                        ? "border-black/[0.08] bg-white text-slate-900 hover:bg-slate-50"
                        : "border-white/10 bg-navy-800/60 text-white hover:bg-navy-800/80"
                    )}
                  >
                    {i.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 6 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
              Stop Losing Value Between Insight and Action
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              See IRIS Tasking assign the right work, enforce accountability, and close the loop — live in the demo factory.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Launch Demo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" href="/modules" className="min-w-[240px]">
                Explore Modules
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

