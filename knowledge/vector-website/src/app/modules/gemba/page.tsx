"use client";

import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Bell,
  ArrowRightLeft,
  BarChart3,
  Eye,
  Camera,
  Brain,
  Factory,
  ShieldCheck,
  Wrench,
  Warehouse,
  Shield,
  UserCog,
} from "lucide-react";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Production Status Board",
    description:
      "A unified real-time view of every production line, machine, and work order. Color-coded status indicators let supervisors spot bottlenecks in seconds, not minutes.",
  },
  {
    icon: ListChecks,
    title: "Task & Action Management",
    description:
      "Create, assign, and track action items directly from the shop floor. Every task carries context — the observation that triggered it, the person responsible, and the deadline.",
  },
  {
    icon: Users,
    title: "Tiered Meetings (T1–T4)",
    description:
      "Structured daily management from operator huddles (T1) to executive reviews (T4). Pre-populated agendas, auto-escalation of unresolved issues, and meeting minutes captured automatically.",
  },
  {
    icon: Bell,
    title: "Real-Time Alerts & Notifications",
    description:
      "Configurable alert rules that push critical events to the right people at the right time. Equipment failures, quality deviations, and safety incidents surface instantly.",
  },
  {
    icon: ArrowRightLeft,
    title: "Shift Handover",
    description:
      "Digital shift handover that eliminates information loss between crews. Outgoing shifts document open issues, incoming shifts confirm acknowledgment — all with full audit trail.",
  },
  {
    icon: Eye,
    title: "Gemba Walks",
    description:
      "Plan, conduct, and document structured walks through production areas. Record observations with photos, categorize findings, and convert them into tracked action items.",
  },
  {
    icon: Camera,
    title: "Photo Documentation",
    description:
      "Capture visual evidence on the spot. Photos are automatically linked to observations, tagged with location and timestamp, and stored for compliance and trend analysis.",
  },
  {
    icon: BarChart3,
    title: "Operational Analytics",
    description:
      "Dashboards that transform raw observations into actionable patterns. Track resolution rates, recurring issues, and improvement velocity across plants and shifts.",
  },
];

const AI_CAPABILITIES = [
  {
    title: "Anomaly Detection",
    description:
      "AI monitors observation patterns and flags emerging issues before they escalate — catching trends that manual reviews miss.",
  },
  {
    title: "Smart Prioritization",
    description:
      "Machine learning ranks action items by predicted impact, helping teams focus on the changes that move the needle most.",
  },
  {
    title: "Auto-Generated Summaries",
    description:
      "LLMind reads shift logs, observations, and meeting notes to produce concise executive summaries — saving hours of manual reporting.",
  },
];

const INTEGRATIONS = [
  { icon: Factory, name: "MES", description: "Production data flows into Gemba dashboards in real time." },
  { icon: ShieldCheck, name: "QMS", description: "Quality deviations auto-create Gemba observations." },
  { icon: Wrench, name: "CMMS", description: "Maintenance events surface as alerts and action items." },
  { icon: Warehouse, name: "WMS", description: "Material shortages trigger shop-floor notifications." },
  { icon: Shield, name: "HSE", description: "Safety incidents escalate through tiered meetings automatically." },
  { icon: UserCog, name: "HRM", description: "Shift schedules and competence data inform task assignment." },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export default function GembaPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const ref6 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });
  const isInView5 = useInView(ref5, { once: true, margin: "-80px" });
  const isInView6 = useInView(ref6, { once: true, margin: "-80px" });

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
        <Image src="/images/modules/gemba-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="purple" className="mb-6">Core</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Gemba —{" "}
              <span className="text-gradient">Operational Control Center</span>
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The nerve center of your factory floor. Real-time visibility,
              structured daily management, and seamless shift handovers — all in
              one place.
            </p>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <Section variant="alternate">
        <Container>
          <div ref={ref1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto space-y-6"
            >
              <p
                className={cn(
                  "text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Manufacturing leaders spend too much time chasing information and
                not enough time acting on it. Gemba replaces scattered
                whiteboards, spreadsheet trackers, and email chains with a
                single operational command center that every role — from operator
                to plant director — can rely on.
              </p>
              <p
                className={cn(
                  "text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Built on the principle that the best decisions happen where the
                work happens, Gemba digitizes the daily management cycle: Gemba
                walks capture ground truth, tiered meetings escalate what
                matters, and real-time dashboards keep everyone aligned. Issues
                don&apos;t get lost between shifts — they get resolved.
              </p>
              <p
                className={cn(
                  "text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Because Gemba is wired into every IRIS module, it doesn&apos;t
                just show you what happened — it connects production events,
                quality alerts, maintenance signals, and safety incidents into a
                coherent operational picture that drives action.
              </p>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Key Features */}
      <Section variant="default">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              label="CAPABILITIES"
              title="Everything You Need to Run the Floor"
              description="Eight core capabilities that transform daily management from reactive firefighting into proactive operational excellence."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-8 w-8" aria-hidden />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-lg mb-2",
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
          <div ref={ref3}>
            <SectionHeader
              label="AI-POWERED"
              title="Intelligence Built Into Daily Management"
              description="Gemba doesn't just collect data — it learns from it. AI capabilities are embedded directly into the operational workflow."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView3 ? "animate" : "initial"}
              className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-5xl mx-auto"
            >
              {AI_CAPABILITIES.map(({ title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="gradient-border" padding="lg" className="h-full">
                    <div className="flex items-center gap-3 mb-3">
                      <Brain className="h-5 w-5 text-iris-violet flex-shrink-0" aria-hidden />
                      <h3
                        className={cn(
                          "font-semibold",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {title}
                      </h3>
                    </div>
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

      {/* Screenshot Placeholder */}
      <Section variant="default">
        <Container>
          <div ref={ref4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-5xl mx-auto"
            >
              <div className={cn(
                "rounded-2xl overflow-hidden border max-w-5xl mx-auto shadow-2xl",
                isLight ? "border-black/10 shadow-black/5" : "border-white/10 shadow-black/50"
              )}>
                <Image
                  src="/images/iris-ui/gemba-board.png"
                  alt="IRIS Gemba — digital board with live operational data and tiered meeting schedule"
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
          <div ref={ref5}>
            <SectionHeader
              label="INTEGRATIONS"
              title="Connected to Every Module"
              description="Gemba is the operational hub that pulls signals from across the IRIS platform into a single actionable view."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView5 ? "animate" : "initial"}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
            >
              {INTEGRATIONS.map(({ icon: Icon, name, description }) => (
                <motion.div key={name} variants={fadeInUp}>
                  <Card variant="default" padding="md" className="h-full">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-iris-violet flex-shrink-0" aria-hidden />
                      <h3
                        className={cn(
                          "font-semibold",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {name}
                      </h3>
                    </div>
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
          <div ref={ref6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView6 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-center max-w-2xl mx-auto"
            >
              <h2
                className={cn(
                  "text-3xl sm:text-4xl font-bold tracking-tight",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Ready to take control of your operations?
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how Gemba transforms daily management from guesswork into a
                data-driven discipline.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="primary" size="lg" href="/contact" className="min-w-[200px]">
                  Request a Demo
                </Button>
                <Button variant="secondary" size="lg" href="/modules" className="min-w-[200px]">
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
