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
  Wrench,
  Activity,
  Clock,
  Package,
  BarChart3,
  Shield,
  Cpu,
  AlertTriangle,
} from "lucide-react";

const FEATURES = [
  {
    icon: Wrench,
    title: "Asset Lifecycle Management",
    description:
      "Track every asset from acquisition to disposal. Maintain full hierarchy, documentation, and maintenance history in one place.",
  },
  {
    icon: Clock,
    title: "Preventive Maintenance",
    description:
      "Schedule time-based and condition-based maintenance plans. Auto-generate work orders so nothing slips through the cracks.",
  },
  {
    icon: AlertTriangle,
    title: "Corrective Maintenance",
    description:
      "Handle breakdowns fast. Capture failure reports, assign emergency repairs, and track root cause analysis to prevent recurrence.",
  },
  {
    icon: Activity,
    title: "Predictive Maintenance",
    description:
      "Leverage IoT sensor data and AI analytics to predict failures before they happen — reducing unplanned downtime by up to 40%.",
  },
  {
    icon: Package,
    title: "Spare Parts Management",
    description:
      "Manage spare parts inventory with automatic reorder points, procurement tracking, and usage analytics tied to specific assets.",
  },
  {
    icon: BarChart3,
    title: "Work Order Management",
    description:
      "Create, assign, prioritize, and track work orders end-to-end. Full audit trail with technician notes, time logs, and parts consumed.",
  },
  {
    icon: Shield,
    title: "Compliance & Safety",
    description:
      "Ensure regulatory compliance with automated maintenance schedules, safety checklists, and complete audit trails for every intervention.",
  },
  {
    icon: Cpu,
    title: "Maintenance Analytics",
    description:
      "Real-time dashboards for MTBF, MTTR, OEE impact, and cost analysis. Identify patterns and optimize your maintenance strategy.",
  },
];

const AI_CAPABILITIES = [
  "Predicts equipment failures 2–4 weeks in advance using vibration, temperature, and performance data",
  "Automatically prioritizes work orders based on criticality, resource availability, and production impact",
  "Recommends optimal spare parts stock levels based on consumption patterns and lead times",
  "Identifies recurring failure patterns and suggests root cause interventions",
  "Optimizes preventive maintenance schedules to minimize production disruption",
];

const INTEGRATIONS = [
  {
    module: "MES",
    description:
      "Equipment failure events from MES automatically trigger corrective work orders. Maintenance completion updates production availability in real time.",
  },
  {
    module: "WMS",
    description:
      "Spare part receipts in WMS update CMMS inventory automatically. Procurement requests flow seamlessly between systems.",
  },
  {
    module: "IoT",
    description:
      "Real-time sensor data feeds condition monitoring and predictive maintenance models. Threshold alerts trigger automatic work orders.",
  },
  {
    module: "Digital Twin",
    description:
      "Simulate maintenance scenarios on the digital twin before executing them. Validate impact on production without real-world risk.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export default function CMMSPage() {
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
          !isLight && "bg-gradient-hero grid-pattern"
        )}
      >
        <Image src="/images/modules/cmms-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6">
              Add-on Module
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Computerized Maintenance Management
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Shift from reactive firefighting to predictive precision. IRIS CMMS
              gives your maintenance teams the tools to eliminate unplanned
              downtime, extend asset life, and cut maintenance costs.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <Button variant="primary" size="lg" href="/pricing">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="secondary" size="lg" href="/modules">
                All modules
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <Section variant="alternate">
        <Container size="md">
          <div className="max-w-3xl mx-auto space-y-6">
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The IRIS CMMS module provides comprehensive maintenance management
              capabilities that transform how organizations handle equipment
              upkeep. From preventive schedules to predictive analytics, every
              maintenance activity is planned, tracked, and optimized within a
              single system.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              It supports the full spectrum of maintenance strategies — preventive,
              corrective, and predictive — unified through intelligent work order
              management, asset lifecycle tracking, and spare parts control. By
              integrating directly with MES, WMS, and IoT modules, CMMS ensures
              that maintenance decisions are always informed by real-time
              production data.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The result: reduced downtime, longer asset lifespans, lower
              maintenance costs, and full regulatory compliance — all visible
              through real-time analytics dashboards.
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
              title="Everything Your Maintenance Team Needs"
              description="From work orders to predictive analytics — a complete maintenance management toolkit built for modern manufacturing."
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
                  <Card variant="default" padding="md" className="h-full">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold mb-2",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
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
            <SectionHeader
              label="AI-Powered"
              title="Intelligent Maintenance, Not Just Scheduled Maintenance"
              description="IRIS AI continuously learns from your equipment data to move your maintenance strategy from calendar-based to condition-based."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewAI ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <Card variant="glow" padding="lg">
                <ul className="space-y-4">
                  {AI_CAPABILITIES.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-iris-violet flex-shrink-0 mt-0.5" />
                      <span
                        className={cn(
                          "text-sm leading-relaxed",
                          isLight ? "text-slate-600" : "text-slate-300"
                        )}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
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
              <div className={cn(
                "rounded-2xl overflow-hidden border max-w-5xl mx-auto shadow-2xl",
                isLight ? "border-black/10 shadow-black/5" : "border-white/10 shadow-black/50"
              )}>
                <LocalizedImage
                  src="/images/iris-ui/cmms-dashboard-en.png"
                  alt="IRIS CMMS Dashboard — work orders, PM compliance, and asset cost tracking"
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
              label="Connected"
              title="Seamless Integration Across IRIS"
              description="CMMS doesn't work in isolation. It shares data and events with every module that touches your equipment."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewIntegrations ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-4xl mx-auto"
            >
              {INTEGRATIONS.map(({ module, description }) => (
                <motion.div key={module} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <Badge variant="purple" className="mb-3">
                      {module}
                    </Badge>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
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
                Stop reacting. Start predicting.
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS CMMS can transform your maintenance operations.
              </p>
              <div className="mt-8 flex flex-wrap gap-4 justify-center">
                <Button variant="primary" size="lg" href="/pricing">
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="secondary" size="lg" href="/modules">
                  Explore all modules
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
