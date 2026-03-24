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
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  ClipboardCheck,
  GraduationCap,
  HardHat,
  Bell,
  BarChart3,
  Brain,
} from "lucide-react";

const FEATURES = [
  {
    icon: AlertTriangle,
    title: "Incident & Near-Miss Reporting",
    description:
      "Report, classify, and track every safety incident and near miss in real time. Attach photos, assign severity, and trigger investigation workflows automatically.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Assessment & Management",
    description:
      "Identify hazards, score probability and impact on a visual risk matrix, and build mitigation plans. Continuously monitor your risk register as conditions change.",
  },
  {
    icon: ClipboardCheck,
    title: "Layered Process Audits",
    description:
      "Schedule and conduct structured LPA audits at every organizational level. Track findings, assign corrective actions, and measure audit compliance over time.",
  },
  {
    icon: GraduationCap,
    title: "Training & Certifications",
    description:
      "Manage safety training programs, track attendance, and monitor certification validity. Automatically flag expiring credentials and schedule refresher courses.",
  },
  {
    icon: HardHat,
    title: "Safety Equipment Control",
    description:
      "Maintain a full inventory of PPE and safety equipment. Track calibration dates, inspection schedules, and replacement timelines to ensure nothing expires unnoticed.",
  },
  {
    icon: Bell,
    title: "Emergency Alerts & Communication",
    description:
      "Broadcast safety alerts and emergency instructions instantly. Manage evacuation plans, drill schedules, and escalation chains from a single control center.",
  },
  {
    icon: BarChart3,
    title: "HSE Analytics & Dashboards",
    description:
      "Monitor real-time safety KPIs — incident rates, audit scores, training compliance, and equipment validity — on a unified dashboard with drill-down capabilities.",
  },
  {
    icon: Brain,
    title: "AI-Powered Safety Insights",
    description:
      "Leverage predictive risk analysis and incident pattern recognition to surface proactive recommendations before problems occur. Turn historical data into prevention.",
  },
];

const INTEGRATIONS = [
  {
    name: "MES",
    description: "Link incidents to production context — line, shift, and operator data.",
  },
  {
    name: "CMMS",
    description: "Sync maintenance schedules with safety inspection requirements.",
  },
  {
    name: "HRM",
    description: "Pull employee records for training compliance and certification tracking.",
  },
  {
    name: "Gemba",
    description: "Feed shop-floor observations directly into the incident and risk pipeline.",
  },
  {
    name: "KPI",
    description: "Surface safety metrics alongside operational KPIs in unified dashboards.",
  },
  {
    name: "DATA_AI",
    description: "Power predictive risk models and incident pattern recognition with the AI engine.",
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

export default function HSEModulePage() {
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
        <Image src="/images/modules/hse-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-6">
              Add-on Module
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Health, Safety &amp; Environment
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Protect your people, reduce risk, and ensure regulatory compliance — all from a single,
              AI-augmented safety management system built into the IRIS platform.
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
              The IRIS HSE module delivers comprehensive health, safety, and environment management
              capabilities for manufacturing organizations. It covers the full safety lifecycle — from
              incident reporting and root-cause analysis through risk assessment, layered process
              audits, training management, and emergency response coordination.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Every safety event is captured in real time and connected to production context through
              deep integrations with MES, CMMS, HRM, and Gemba. This means an incident on Line 3
              during the night shift is automatically enriched with operator data, machine state, and
              maintenance history — giving investigators the full picture without manual data
              gathering.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Built-in AI analyzes historical patterns to predict emerging risks and recommend
              preventive actions. The result: fewer incidents, faster response times, and a culture
              of continuous safety improvement backed by data — not guesswork.
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
              title="Everything You Need for World-Class Safety"
              description="From incident capture to predictive prevention — a complete HSE toolkit that integrates with your entire operation."
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
                title="Predict Risks Before They Become Incidents"
                align="center"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    title: "Predictive Risk Analysis",
                    text: "Machine learning models trained on your historical incident data identify emerging risk patterns and flag high-probability hazards before they materialize.",
                  },
                  {
                    title: "Incident Pattern Recognition",
                    text: "AI clusters similar incidents across time, location, and equipment to reveal systemic issues that manual analysis would miss.",
                  },
                  {
                    title: "Proactive Recommendations",
                    text: "The system generates actionable safety recommendations — from updated inspection schedules to targeted training — ranked by expected impact.",
                  },
                  {
                    title: "Safety Trend Forecasting",
                    text: "Continuous trend analysis surfaces seasonal patterns, shift-specific risks, and equipment degradation signals to keep your safety strategy ahead of the curve.",
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
                description="The HSE dashboard gives safety managers a real-time view of incidents, risk levels, audit compliance, and training status across every plant."
                align="center"
              />
              <div className={cn("rounded-2xl overflow-hidden border max-w-4xl mx-auto", isLight ? "border-black/[0.08]" : "border-white/10")}>
                <Image src="/images/modules/hse-hero.png" alt="HSE Module — health, safety and environment dashboard" width={1920} height={1080} className="w-full h-auto" quality={90} />
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
              title="Connected to Your Entire Operation"
              description="HSE doesn't live in a silo. It shares data with every IRIS module so safety context flows wherever it's needed."
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
                Ready to transform workplace safety?
              </h2>
              <p
                className={cn(
                  "mt-4 text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS HSE can reduce incidents, streamline compliance, and build a proactive
                safety culture across your operations.
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
