"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Wifi,
  Box,
  Factory,
  Warehouse,
  ShieldCheck,
  Wrench,
  Package,
  Users,
  Shield,
  Leaf,
  Calendar,
  BarChart3,
  LayoutDashboard,
  Brain,
  CheckSquare,
  MessagesSquare,
  ArrowRight,
} from "lucide-react";

const MODULE_CATEGORIES = [
  {
    name: "Data Collection",
    modules: [
      {
        slug: "iot",
        icon: Wifi,
        name: "IoT",
        description:
          "Connect sensors, PLCs, machines. Real-time telemetry. Dedicated hardware integration.",
        badge: "Core" as const,
      },
      {
        slug: "dt",
        icon: Box,
        name: "Digital Twin",
        description:
          "3D simulation, what-if scenarios, synthetic data generation for AI training.",
        badge: "Core" as const,
      },
    ],
  },
  {
    name: "Execution",
    modules: [
      {
        slug: "mes",
        icon: Factory,
        name: "MES",
        description:
          "Production monitoring, OEE tracking, work orders, operator collaboration tools.",
        badge: "Core" as const,
      },
      {
        slug: "wms",
        icon: Warehouse,
        name: "WMS",
        description:
          "Warehouse management, material flow optimization, gate scheduling, AGV/AMR integration.",
        badge: "Add-on" as const,
      },
      {
        slug: "qms",
        icon: ShieldCheck,
        name: "QMS",
        description:
          "Quality control, inspection management, root cause analysis, supplier quality.",
        badge: "Add-on" as const,
      },
      {
        slug: "cmms",
        icon: Wrench,
        name: "CMMS",
        description:
          "Maintenance management, predictive maintenance, asset lifecycle tracking.",
        badge: "Add-on" as const,
      },
      {
        slug: "mrp",
        icon: Package,
        name: "MRP",
        description:
          "Material requirements planning, demand forecasting, supply chain visibility.",
        badge: "Add-on" as const,
      },
      {
        slug: "hrm",
        icon: Users,
        name: "HRM",
        description:
          "Shift planning, competence matching, workforce optimization, training tracking.",
        badge: "Add-on" as const,
      },
      {
        slug: "hse",
        icon: Shield,
        name: "HSE",
        description:
          "Health, safety, environment. Incident tracking, risk assessment, compliance.",
        badge: "Add-on" as const,
      },
      {
        slug: "esg",
        icon: Leaf,
        name: "ESG",
        description:
          "Sustainability monitoring, carbon footprint tracking, ESG compliance reporting.",
        badge: "Add-on" as const,
      },
    ],
  },
  {
    name: "Intelligence & Planning",
    modules: [
      {
        slug: "aps",
        icon: Calendar,
        name: "APS",
        description:
          "Advanced planning & scheduling. Simulation-validated production scenarios.",
        badge: "Add-on" as const,
      },
      {
        slug: "kpi",
        icon: BarChart3,
        name: "KPI",
        description:
          "Real-time dashboards, tactical analysis, AI-powered recommendations engine.",
        badge: "Core" as const,
      },
    ],
  },
  {
    name: "Platform",
    modules: [
      {
        slug: "gemba",
        icon: LayoutDashboard,
        name: "Gemba",
        description:
          "Operational control center. Production status, task management, tiered meetings.",
        badge: "Core" as const,
      },
      {
        slug: "tasking",
        icon: CheckSquare,
        name: "Tasking",
        description:
          "AI-driven work management that assigns tasks from plan, enforces accountability, and closes execution loops across the plant.",
        badge: "Core" as const,
      },
      {
        slug: "communications",
        icon: MessagesSquare,
        name: "Communicator",
        description:
          "Context-based messaging, alerts, and org-wide broadcasts — keep every conversation tied to the real shop-floor context.",
        badge: "Core" as const,
      },
      {
        slug: "data-ai",
        icon: Brain,
        name: "DATA_AI",
        description:
          "AI engine. ML models, RAG knowledge bases, LLMind, recommendation system.",
        badge: "Core" as const,
      },
    ],
  },
];

const FLOW_ITEMS = [
  "IoT",
  "MES",
  "QMS",
  "CMMS",
  "APS",
  "DT",
  "AI",
  "Tasking",
  "Comms",
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export default function ModulesPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });

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
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <h1 className={cn("text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]", isLight ? "text-slate-900" : "text-white")}>
              One System. All Operations.
            </h1>
            <p className={cn("mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
              IRIS modules work together through a shared data layer and AI core.
              Choose what you need.
            </p>
          </div>
        </Container>
      </section>

      {/* Section 2 — Module Categories */}
      <Section variant="alternate">
        <Container>
          <div ref={ref1}>
            {MODULE_CATEGORIES.map((category) => (
              <motion.div
                key={category.name}
                variants={staggerContainer}
                initial="initial"
                animate={isInView1 ? "animate" : "initial"}
                className="mb-16 last:mb-0"
              >
                <h2 className="text-sm font-semibold uppercase tracking-widest text-iris-violet mb-6">
                  {category.name}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {category.modules.map(({ slug, icon: Icon, name, description, badge }) => (
                    <motion.div key={slug} variants={fadeInUp}>
                      <Link href={`/modules/${slug}`}>
                        <Card
                          variant="interactive"
                          padding="md"
                          className="h-full flex flex-col"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-iris-violet">
                              <Icon className="h-6 w-6" aria-hidden />
                            </div>
                            <Badge variant={badge === "Core" ? "purple" : "outline"}>
                              {badge}
                            </Badge>
                          </div>
                          <h3 className={cn("font-semibold mt-3", isLight ? "text-slate-900" : "text-white")}>{name}</h3>
                          <p className={cn("text-sm leading-relaxed mt-2 flex-1", isLight ? "text-slate-600" : "text-slate-400")}>
                            {description}
                          </p>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 3 — How Modules Work Together */}
      <Section variant="default">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              title="No Silos. One Intelligence."
              description="Every module shares the same data, the same AI, the same communication bus."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView2 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-8"
            >
              {FLOW_ITEMS.map((item, i) => (
                <div key={item} className="flex items-center gap-2 sm:gap-4">
                  <div
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium hover:border-iris-purple/30 transition-colors",
                      isLight ? "border-black/[0.08] bg-slate-50 text-slate-900" : "border-white/10 bg-navy-800/60 text-white"
                    )}
                  >
                    {item}
                  </div>
                  {i < FLOW_ITEMS.length - 1 && (
                    <ArrowRight className={cn("w-4 h-4 flex-shrink-0 hidden sm:block", isLight ? "text-slate-400" : "text-slate-500")} />
                  )}
                </div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div ref={ref3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
                Build your configuration
              </h2>
              <div className="mt-8">
                <Button variant="primary" size="lg" href="/pricing" className="min-w-[200px]">
                  Build your configuration
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
