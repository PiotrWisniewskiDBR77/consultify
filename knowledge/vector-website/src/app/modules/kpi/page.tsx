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
import {
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Gauge,
  TrendingUp,
  Brain,
  SlidersHorizontal,
  Target,
  Layers,
  BellRing,
} from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Real-Time Dashboards",
    description:
      "Monitor OEE, throughput, quality rates, and every operational metric in real time. Dashboards update live as data flows from MES, IoT, CMMS, and every connected module.",
  },
  {
    icon: Gauge,
    title: "Tactical & Strategic Analysis",
    description:
      "Move beyond surface-level metrics. Drill down from plant-level summaries to shift, line, and machine-level detail to pinpoint exactly where performance is won or lost.",
  },
  {
    icon: TrendingUp,
    title: "Trend Analysis & Benchmarking",
    description:
      "Track KPIs over time with automated trend detection. Compare performance across shifts, lines, plants, and time periods to identify patterns and set meaningful benchmarks.",
  },
  {
    icon: Brain,
    title: "AI-Powered Recommendations",
    description:
      "The recommendation engine analyzes KPI data in context, identifies root causes of underperformance, and suggests specific actions ranked by expected impact.",
  },
  {
    icon: SlidersHorizontal,
    title: "Custom KPI Builder",
    description:
      "Define your own KPIs with a flexible formula engine. Combine data from any module, set thresholds, configure alert rules, and publish to dashboards — no coding required.",
  },
  {
    icon: Target,
    title: "Goal Tracking & Scorecards",
    description:
      "Set targets at every level — corporate, plant, line, team. Track progress with visual scorecards, automated status indicators, and variance analysis.",
  },
  {
    icon: Layers,
    title: "Multi-Level Drill-Down",
    description:
      "Start at the executive summary and drill into any dimension: time, geography, product, equipment, operator. Every chart is interactive, every number is explorable.",
  },
  {
    icon: BellRing,
    title: "Alerts & Threshold Monitoring",
    description:
      "Configure real-time alerts when KPIs breach thresholds. Escalation chains ensure the right people are notified at the right time — from operators to plant managers.",
  },
];

const INTEGRATIONS = [
  {
    name: "MES",
    description: "Pull production data — OEE, cycle times, output counts — directly into KPI calculations.",
  },
  {
    name: "CMMS",
    description: "Incorporate maintenance metrics like MTBF, MTTR, and planned vs. unplanned downtime.",
  },
  {
    name: "QMS",
    description: "Feed quality rates, defect counts, and inspection results into quality KPIs.",
  },
  {
    name: "HSE",
    description: "Surface safety incident rates and compliance scores alongside operational metrics.",
  },
  {
    name: "ESG",
    description: "Blend sustainability KPIs — energy per unit, waste rates — into unified dashboards.",
  },
  {
    name: "DATA_AI",
    description: "Power the recommendation engine and predictive analytics with the platform AI core.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

export default function KPIModulePage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const refFeatures = useRef<HTMLDivElement>(null);
  const refAI = useRef<HTMLDivElement>(null);
  const refScreenshot = useRef<HTMLDivElement>(null);
  const refIntegrations = useRef<HTMLDivElement>(null);
  const refCTA = useRef<HTMLDivElement>(null);
  const inViewFeatures = useInView(refFeatures, { once: true, margin: "-80px" });
  const inViewAI = useInView(refAI, { once: true, margin: "-80px" });
  const inViewScreenshot = useInView(refScreenshot, { once: true, margin: "-80px" });
  const inViewIntegrations = useInView(refIntegrations, { once: true, margin: "-80px" });
  const inViewCTA = useInView(refCTA, { once: true, margin: "-80px" });

  return (
    <>
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28",
          isLight ? "bg-white" : "bg-navy-950",
          !isLight && "bg-gradient-hero",
          !isLight && "grid-pattern"
        )}
      >
        <Image src="/images/modules/kpi-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="purple" className="mb-6">
              Core Module
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              KPI &amp; Analytics
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Real-time dashboards, drill-down analytics, and AI-powered recommendations — turning
              every data point across your operation into actionable intelligence.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/contact">
                Request a Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="lg" href="/modules">
                All Modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <Section variant="alternate">
        <Container>
          <div className="max-w-3xl mx-auto space-y-6">
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              The IRIS KPI &amp; Analytics module is the intelligence layer of the platform. It
              aggregates data from every connected module — MES, CMMS, QMS, HSE, ESG, and more —
              and transforms it into real-time dashboards, tactical analysis, and strategic
              scorecards that drive better decisions at every level of the organization.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Unlike standalone BI tools, IRIS KPI understands manufacturing context. It knows that
              OEE is a function of availability, performance, and quality. It knows that a spike in
              MTTR correlates with maintenance backlog. And it uses the platform&apos;s AI engine to
              surface not just what happened, but why — and what to do about it.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              With a custom KPI builder, flexible alert system, and multi-level drill-down
              capabilities, the module serves everyone from shop-floor operators tracking shift
              targets to executives monitoring plant-level performance across a global portfolio.
            </p>
          </div>
        </Container>
      </Section>

      {/* Key Features */}
      <Section variant="default">
        <Container>
          <div ref={refFeatures}>
            <SectionHeader
              label="Capabilities"
              title="From Data to Decisions in Real Time"
              description="A complete analytics platform built for manufacturing — not retrofitted from generic BI."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewFeatures ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full flex flex-col">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-base",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-relaxed flex-1",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* AI Integration */}
      <Section variant="alternate">
        <Container>
          <div ref={refAI}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewAI ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              <SectionHeader
                label="Artificial Intelligence"
                title="Analytics That Think — Not Just Display"
                align="center"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    title: "Root Cause Analysis",
                    text: "When a KPI drops, the AI engine traces the contributing factors across modules — was it a maintenance issue, a material problem, or an operator training gap? Get answers, not just alerts.",
                  },
                  {
                    title: "Predictive KPI Forecasting",
                    text: "Machine learning models forecast KPI trajectories based on current trends, planned production, and historical patterns. Know where you're heading before you get there.",
                  },
                  {
                    title: "Actionable Recommendations",
                    text: "The system doesn't just show problems — it recommends solutions. Each recommendation is ranked by expected impact and linked to the specific actions needed to improve performance.",
                  },
                  {
                    title: "Anomaly & Drift Detection",
                    text: "Continuous monitoring detects subtle performance drift that manual review would miss. AI flags when a KPI is trending toward a threshold — not just when it crosses one.",
                  },
                ].map((item) => (
                  <Card key={item.title} variant="default" padding="md">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-iris-violet flex-shrink-0 mt-0.5" />
                      <div>
                        <h4
                          className={cn(
                            "font-semibold",
                            isLight ? "text-slate-900" : "text-white"
                          )}
                        >
                          {item.title}
                        </h4>
                        <p
                          className={cn(
                            "mt-1 text-sm leading-relaxed",
                            isLight ? "text-slate-600" : "text-slate-400"
                          )}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Screenshot Placeholder */}
      <Section variant="default">
        <Container>
          <div ref={refScreenshot}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewScreenshot ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                title="See It in Action"
                description="Interactive dashboards with real-time KPIs, drill-down charts, AI recommendations, and goal tracking — all in one view."
                align="center"
              />
              <div className={cn(
                "rounded-2xl overflow-hidden border max-w-5xl mx-auto shadow-2xl",
                isLight ? "border-black/10 shadow-black/5" : "border-white/10 shadow-black/50"
              )}>
                <Image
                  src="/images/iris-ui/kpi-dashboard.png"
                  alt="IRIS KPI — operational KPI dashboard with daily performance tracking"
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

      {/* Integration Points */}
      <Section variant="alternate">
        <Container>
          <div ref={refIntegrations}>
            <SectionHeader
              label="Integrations"
              title="Every Module Feeds the Intelligence Layer"
              description="KPI & Analytics aggregates data from the entire IRIS ecosystem — no manual exports, no data silos, no stale numbers."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewIntegrations ? "animate" : "initial"}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
            >
              {INTEGRATIONS.map(({ name, description }) => (
                <motion.div key={name} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <h4
                      className={cn(
                        "font-semibold",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {name}
                    </h4>
                    <p
                      className={cn(
                        "mt-1 text-sm leading-relaxed",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div ref={refCTA}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewCTA ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Turn data into your competitive edge
              </h2>
              <p
                className={cn(
                  "mt-4 text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS KPI &amp; Analytics gives every level of your organization the insights
                they need — from real-time operator dashboards to executive scorecards.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/contact">
                  Schedule a Demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" href="/pricing">
                  View Pricing
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
