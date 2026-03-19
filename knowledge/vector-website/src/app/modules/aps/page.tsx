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
  Calendar,
  Layers,
  Zap,
  GitBranch,
  BarChart3,
  Clock,
  Cpu,
  Settings2,
} from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    title: "Finite Capacity Planning",
    description:
      "Create production plans that respect real capacity limits — machines, labor, tooling, and materials — not just infinite-capacity MRP outputs.",
  },
  {
    icon: Settings2,
    title: "Constraint-Based Scheduling",
    description:
      "Define complex constraints including setup times, sequencing rules, material availability, and shift patterns. The solver finds the optimal schedule.",
  },
  {
    icon: GitBranch,
    title: "What-If Scenario Analysis",
    description:
      "Model multiple planning scenarios side by side. Compare lead times, costs, and resource utilization before committing to a plan.",
  },
  {
    icon: Zap,
    title: "Real-Time Rescheduling",
    description:
      "When disruptions happen — machine breakdowns, rush orders, material delays — APS recalculates the optimal schedule in seconds, not hours.",
  },
  {
    icon: Layers,
    title: "Resource Optimization",
    description:
      "Balance workloads across production lines and work centers. Maximize utilization while respecting capacity limits and maintenance windows.",
  },
  {
    icon: BarChart3,
    title: "Plan Versioning & Approval",
    description:
      "Maintain full version history of every production plan. Built-in approval workflows ensure the right people sign off before execution.",
  },
  {
    icon: Clock,
    title: "Demand-Driven Planning",
    description:
      "Start from demand forecasts and customer orders, then work backward through BOMs and routings to generate feasible production schedules.",
  },
  {
    icon: Cpu,
    title: "Advanced Optimization Algorithms",
    description:
      "Purpose-built solvers minimize changeover times, reduce WIP, and optimize for your specific KPIs — whether that's on-time delivery, cost, or throughput.",
  },
];

const AI_CAPABILITIES = [
  "Learns from historical production data to improve schedule accuracy over time",
  "Predicts bottlenecks before they occur and suggests preemptive resource reallocation",
  "Automatically adjusts schedules when MES reports deviations from planned cycle times",
  "Recommends optimal batch sizes based on demand patterns, setup costs, and inventory targets",
  "Validates production scenarios against the Digital Twin before committing to the shop floor",
];

const INTEGRATIONS = [
  {
    module: "MES",
    description:
      "Production completion events from MES feed back into APS for real-time schedule accuracy. Deviations trigger automatic rescheduling.",
  },
  {
    module: "MRP",
    description:
      "Material requirements from MRP inform APS scheduling constraints. APS ensures production is only scheduled when materials are available.",
  },
  {
    module: "Digital Twin",
    description:
      "Validate production scenarios on the digital twin before execution. Simulate throughput, identify bottlenecks, and optimize without real-world risk.",
  },
  {
    module: "IoT",
    description:
      "Real-time machine status and performance data ensure APS schedules reflect actual shop floor conditions, not assumptions.",
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

export default function APSPage() {
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
        <Image src="/images/modules/aps-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
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
              Advanced Planning & Scheduling
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Replace spreadsheets and gut feelings with AI-optimized production
              schedules. IRIS APS balances demand, capacity, and constraints to
              deliver plans that actually work on the shop floor.
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
              The IRIS APS module brings advanced production planning and
              scheduling to your manufacturing operations. It goes far beyond
              traditional MRP by incorporating finite capacity constraints,
              real-time shop floor data, and AI-driven optimization to create
              production schedules that are both optimal and feasible.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              With support for what-if scenario analysis, constraint-based
              scheduling, and real-time rescheduling, planners can respond to
              disruptions in minutes instead of days. Every schedule is validated
              against actual resource availability, material constraints, and
              business rules before it reaches the shop floor.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The result: higher on-time delivery rates, better resource
              utilization, lower WIP inventory, and the agility to handle demand
              variability without sacrificing efficiency.
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
              title="Scheduling That Thinks Ahead"
              description="From finite capacity planning to real-time rescheduling — every tool your planning team needs to deliver optimal production schedules."
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
              title="Schedules That Learn and Adapt"
              description="IRIS AI doesn't just optimize once — it continuously learns from production outcomes to make every future schedule smarter."
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
                <Image
                  src="/images/iris-ui/aps-dashboard.png"
                  alt="IRIS APS — advanced planning dashboards with KPI monitoring"
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
              title="Planning Meets Execution"
              description="APS closes the loop between planning and reality by integrating with every module that touches your production process."
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
                Plan smarter. Deliver on time.
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS APS can optimize your production scheduling.
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
