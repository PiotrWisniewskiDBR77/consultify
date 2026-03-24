"use client";

import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { LocalizedImage } from "@/components/i18n/LocalizedImage";
import {
  CheckCircle2,
  ArrowRight,
  Factory,
  ClipboardList,
  Timer,
  TrendingDown,
  BarChart3,
  Users,
  CalendarClock,
  Layers,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Production Order Management",
    description:
      "Create, release, and track production orders through their full lifecycle — from planning to completion — with real-time progress updates and priority management.",
  },
  {
    icon: BarChart3,
    title: "OEE Monitoring",
    description:
      "Track Overall Equipment Effectiveness in real time. Availability, Performance, and Quality metrics calculated automatically from production data — no manual entry required.",
  },
  {
    icon: Timer,
    title: "Real-Time Execution Tracking",
    description:
      "See exactly what's running, who's operating it, and how much has been produced. Every work center reports live quantities, scrap counts, and execution status.",
  },
  {
    icon: TrendingDown,
    title: "Downtime Management",
    description:
      "Register downtime events the moment they occur. Categorize with reason codes, track duration automatically, and analyze patterns to eliminate recurring losses.",
  },
  {
    icon: CalendarClock,
    title: "Production Scheduling",
    description:
      "Schedule orders across production lines with Gantt visualization, capacity planning, and resource allocation. Optimize sequences to minimize changeover time.",
  },
  {
    icon: Layers,
    title: "Work Center Management",
    description:
      "Configure work centers with specific capabilities, assign them to production lines, and track performance metrics per station. Full visibility into every machine group.",
  },
  {
    icon: Users,
    title: "Operator Collaboration",
    description:
      "Assign operators to executions, track who produced what and when. Role-based access ensures operators see their tasks while managers see the full picture.",
  },
  {
    icon: Factory,
    title: "Production Line Configuration",
    description:
      "Model your physical production layout digitally. Define lines, assign work centers, manage capacity, and monitor line-level performance in a single view.",
  },
];

const INTEGRATIONS = [
  { name: "WMS", description: "Material consumption and finished goods automatically update warehouse inventory" },
  { name: "QMS", description: "Quality inspections triggered at production milestones with non-conformance tracking" },
  { name: "IoT", description: "Machine telemetry feeds OEE calculations and downtime detection" },
  { name: "APS", description: "Advanced scheduling engine optimizes production sequences and resource allocation" },
  { name: "GEMBA", description: "Production status, alerts, and task management on the shop floor dashboard" },
  { name: "DATA_AI", description: "Production data powers AI recommendations for scheduling and efficiency" },
];

export default function MESModulePage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const heroRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const integrationRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const overviewInView = useInView(overviewRef, { once: true, margin: "-80px" });
  const featuresInView = useInView(featuresRef, { once: true, margin: "-80px" });
  const aiInView = useInView(aiRef, { once: true, margin: "-80px" });
  const screenshotInView = useInView(screenshotRef, { once: true, margin: "-80px" });
  const integrationInView = useInView(integrationRef, { once: true, margin: "-80px" });
  const ctaInView = useInView(ctaRef, { once: true, margin: "-80px" });

  return (
    <>
      {/* Section 1 — Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero"
        )}
      >
        <Image src="/images/modules/mes-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div ref={heroRef} className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="purple" className="mb-6">Core Module</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Manufacturing Execution System
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The bridge between planning and the shop floor. Track every order, every machine, every second — in real time.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/demo">
                Request a Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/modules">
                All Modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Section 2 — Overview */}
      <Section variant="alternate">
        <Container size="md">
          <div ref={overviewRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={overviewInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="What It Does"
                title="Complete Production Control"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The IRIS MES module gives you complete control over production execution — from the moment an order is created to the second the last unit rolls off the line. It bridges the gap between production planning and actual shop floor activity, replacing clipboards, spreadsheets, and guesswork with real-time digital workflows that operators and managers can trust.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Production orders flow through a structured lifecycle — Planned, Released, In Progress, Completed — with every state change tracked, timestamped, and visible across the organization. Operators log execution directly from their work centers, while managers see aggregated OEE metrics, downtime events, and production progress on live dashboards that update in under one second.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The module supports full production line and work center modeling, so your digital layout mirrors your physical factory. Scheduling, capacity planning, and resource allocation are built in — and when integrated with the APS module, you get simulation-validated production scenarios that account for real-world constraints.
                </p>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Key Features */}
      <Section variant="default">
        <Container>
          <div ref={featuresRef}>
            <SectionHeader
              label="Key Features"
              title="Production, Digitized"
              description="Every aspect of manufacturing execution — from order management to OEE analytics — in a single, integrated system."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={featuresInView ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeInUp}>
                  <Card variant="default" padding="lg" className="h-full">
                    <div className="text-iris-violet mb-4">
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-base mb-2",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — AI Integration */}
      <Section variant="alternate">
        <Container size="md">
          <div ref={aiRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={aiInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="Artificial Intelligence"
                title="AI-Powered MES"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  IRIS MES doesn&apos;t just record what happened — it learns from every production cycle to help you make better decisions. The DATA_AI module analyzes historical production data, OEE trends, and downtime patterns to surface recommendations that would take a team of analysts weeks to uncover.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  AI-powered scheduling suggests optimal order sequences that minimize changeover time and maximize throughput. Downtime prediction models flag equipment that&apos;s trending toward failure before it stops the line. And real-time performance analytics automatically identify bottlenecks, helping you focus improvement efforts where they&apos;ll have the greatest impact on OEE.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    { label: "Schedule Optimization", desc: "AI suggests order sequences that minimize changeover and maximize line utilization" },
                    { label: "Downtime Prediction", desc: "ML models identify equipment trending toward failure before unplanned stops occur" },
                    { label: "Bottleneck Detection", desc: "Real-time analytics pinpoint production constraints and recommend corrective actions" },
                  ].map((item) => (
                    <Card key={item.label} variant="default" padding="md">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-iris-violet flex-shrink-0 mt-0.5" />
                        <div>
                          <h4
                            className={cn(
                              "font-semibold text-sm mb-1",
                              isLight ? "text-slate-900" : "text-white"
                            )}
                          >
                            {item.label}
                          </h4>
                          <p
                            className={cn(
                              "text-sm leading-relaxed",
                              isLight ? "text-slate-600" : "text-slate-400"
                            )}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Screenshot Placeholder */}
      <Section variant="default">
        <Container>
          <div ref={screenshotRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={screenshotInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <div className={cn(
                "rounded-2xl overflow-hidden border max-w-5xl mx-auto shadow-2xl",
                isLight ? "border-black/10 shadow-black/5" : "border-white/10 shadow-black/50"
              )}>
                <LocalizedImage
                  src="/images/iris-ui/mes-dashboard-en.png"
                  alt="IRIS MES Dashboard — production orders, status distribution, and downtime tracking"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                  quality={90}
                />
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 6 — Integration Points */}
      <Section variant="alternate">
        <Container>
          <div ref={integrationRef}>
            <SectionHeader
              label="Integration Points"
              title="The Production Hub"
              description="MES sits at the center of your operations — connecting warehouse, quality, maintenance, and planning into a unified execution layer."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={integrationInView ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {INTEGRATIONS.map((integration) => (
                <motion.div key={integration.name} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="purple">{integration.name}</Badge>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {integration.description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 7 — CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div ref={ctaRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={ctaInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                See MES in Action
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                From order creation to OEE dashboards — see how IRIS MES transforms production visibility.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/demo">
                  Request a Demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="secondary" size="lg" href="/modules">
                  Explore All Modules
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
