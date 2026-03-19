"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ExternalLink } from "lucide-react";

const USE_CASES = [
  {
    title: "Production Monitoring & OEE",
    problem:
      "Operators collect data by hand, OEE numbers arrive hours late, and decisions are always reactive — never predictive.",
    solution:
      "IRIS connects IoT sensors and MES data in real time, delivering live OEE dashboards with AI-driven root cause analysis so you act on facts, not hunches.",
    modules: ["IoT", "MES", "KPI"],
    result: "15–25% OEE improvement within 90 days",
  },
  {
    title: "Predictive Maintenance",
    problem:
      "Unplanned breakdowns halt production, reactive maintenance burns budgets, and spare parts inventory spirals out of control.",
    solution:
      "IRIS ingests vibration, temperature, and current data from equipment sensors, applies ML models, and simulates failure scenarios with Digital Twin — so you fix machines before they fail.",
    modules: ["IoT", "CMMS", "Digital Twin", "DATA_AI"],
    result: "30–40% reduction in unplanned downtime",
  },
  {
    title: "Quality Management",
    problem:
      "Defects are caught too late, inspections are manual and inconsistent, and tracing a quality issue back to its root cause takes days.",
    solution:
      "IRIS automates inspection triggers, predicts quality deviations with AI, and correlates defects to specific suppliers, batches, or process parameters in seconds.",
    modules: ["QMS", "IoT", "DATA_AI"],
    result: "20–35% reduction in quality costs",
  },
  {
    title: "Warehouse & Material Flow",
    problem:
      "Material shortages stall the line, warehouse layouts are chaotic, and gate scheduling is a manual guessing game.",
    solution:
      "IRIS WMS optimizes material flow with AI, integrates MRP for demand-driven replenishment, and supports AGV/AMR coordination for lights-out logistics.",
    modules: ["WMS", "MRP", "IoT"],
    result: "25% improvement in warehouse throughput",
  },
  {
    title: "Energy & Sustainability",
    problem:
      "Energy consumption is a black box, ESG reports are assembled manually each quarter, and carbon tracking has blind spots.",
    solution:
      "IRIS monitors energy in real time at the machine level, uses AI to optimize consumption patterns, and auto-generates ESG compliance reports.",
    modules: ["ESG", "IoT", "KPI"],
    result: "10–20% energy cost reduction",
  },
  {
    title: "AI-Powered Production Planning",
    problem:
      "Static schedules can't handle disruptions, what-if analysis doesn't exist, and planners optimize by gut feel.",
    solution:
      "IRIS APS combines Digital Twin simulation with AI scenario optimization, handling hundreds of constraints to build schedules that actually survive contact with reality.",
    modules: ["APS", "Digital Twin", "DATA_AI"],
    result: "20–30% improvement in schedule adherence",
  },
];

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

export default function UseCasesPage() {
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
          <div ref={ref1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]", isLight ? "text-slate-900" : "text-white")}>
                Real Problems.{" "}
                <span className="text-iris-violet">Measurable Results.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                Every use case follows the same pattern: identify the pain, deploy IRIS modules, and
                measure the impact — typically within the first 90 days.
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Section 2 — Use Case Cards */}
      <Section variant="alternate">
        <Container>
          <div ref={ref2}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {USE_CASES.map(({ title, problem, solution, modules, result }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>{title}</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 mb-1">
                          The Challenge
                        </p>
                        <p className={cn("text-sm", isLight ? "text-slate-600" : "text-slate-300")}>{problem}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-iris-green mb-1">
                          How IRIS Solves It
                        </p>
                        <p className={cn("text-sm", isLight ? "text-slate-600" : "text-slate-300")}>{solution}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {modules.map((mod) => (
                          <Badge key={mod} variant="purple">
                            {mod}
                          </Badge>
                        ))}
                      </div>
                      <div className={cn("pt-2 border-t", isLight ? "border-black/[0.08]" : "border-white/5")}>
                        <p className="text-sm font-medium text-iris-cyan">
                          {result}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div ref={ref3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <h2 className={cn("text-2xl sm:text-3xl font-bold tracking-tight mb-4", isLight ? "text-slate-900" : "text-white")}>
                Which Challenge Is Costing You the Most?
              </h2>
              <p className={cn("mb-8 max-w-xl mx-auto", isLight ? "text-slate-600" : "text-slate-400")}>
                Book a demo tailored to your industry and see IRIS solve your specific pain points live.
              </p>
              <Button variant="primary" size="lg" href="/demo" className="min-w-[280px]">
                Book a Personalized Demo
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
