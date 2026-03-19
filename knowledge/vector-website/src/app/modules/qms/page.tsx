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
  ShieldCheck,
  ClipboardCheck,
  Search,
  AlertTriangle,
  TrendingUp,
  FileCheck,
  Users,
  BarChart3,
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
    icon: ClipboardCheck,
    title: "Inspection Management",
    description:
      "Define inspection plans with configurable checkpoints, acceptance criteria, and sampling rules. Trigger inspections automatically at receiving, in-process, or final stages.",
  },
  {
    icon: AlertTriangle,
    title: "Non-Conformance Tracking",
    description:
      "Capture non-conformances the moment they're detected. Classify by severity, assign disposition actions (rework, scrap, concession), and track resolution through to closure.",
  },
  {
    icon: Search,
    title: "Root Cause Analysis",
    description:
      "Structured 8D and 5-Why workflows guide teams from problem identification to permanent corrective action. Link findings to specific production orders, machines, or materials.",
  },
  {
    icon: TrendingUp,
    title: "Statistical Process Control",
    description:
      "Real-time SPC charts monitor critical process parameters. Control limits are calculated automatically, and out-of-control conditions trigger immediate alerts.",
  },
  {
    icon: Users,
    title: "Supplier Quality Management",
    description:
      "Rate and track supplier performance based on incoming inspection results. Manage supplier corrective actions, quality agreements, and approved vendor lists.",
  },
  {
    icon: FileCheck,
    title: "Quality Certificates & Documents",
    description:
      "Generate Certificates of Analysis, Certificates of Conformance, and inspection reports. Attach quality documents to shipments, lots, and production orders.",
  },
  {
    icon: BarChart3,
    title: "Quality Analytics & KPIs",
    description:
      "Track first-pass yield, defect rates, COPQ (Cost of Poor Quality), and supplier scores. Drill down from KPI dashboards to individual non-conformance records.",
  },
  {
    icon: ShieldCheck,
    title: "Audit Management",
    description:
      "Plan and execute internal and external audits. Track findings, corrective actions, and verification status. Maintain a complete audit trail for regulatory compliance.",
  },
];

const INTEGRATIONS = [
  { name: "MES", description: "Quality inspections triggered at production milestones with real-time defect feedback to operators" },
  { name: "WMS", description: "Incoming material inspection during receiving with hold/release workflows and certificate management" },
  { name: "IoT", description: "Process parameter data feeds SPC charts and triggers quality alerts on out-of-spec conditions" },
  { name: "CMMS", description: "Equipment calibration tracking and maintenance-related quality events linked to asset records" },
  { name: "GEMBA", description: "Quality alerts, inspection tasks, and non-conformance notifications on the shop floor dashboard" },
  { name: "DATA_AI", description: "AI-powered defect prediction, root cause suggestions, and quality trend analysis" },
];

export default function QMSModulePage() {
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
        <Image src="/images/modules/qms-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div ref={heroRef} className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="yellow" className="mb-6">Add-on Module</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Quality Management System
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              Catch defects before they reach your customer. Systematic quality control with AI-powered root cause analysis and real-time SPC.
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
                title="Quality Built Into Every Step"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The IRIS QMS module embeds quality control directly into your manufacturing workflow — not as an afterthought, but as an integral part of every production step. From incoming material inspection at the warehouse dock to in-process checks on the production line to final product verification before shipping, every quality gate is digitized, tracked, and connected to the data that matters.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  When a non-conformance is detected, the system captures it immediately — classifying severity, linking it to the specific production order, machine, operator, and material lot involved. Structured root cause analysis workflows (8D, 5-Why) guide your team from problem identification through containment, corrective action, and verification. Every step is documented, creating an audit trail that satisfies ISO 9001, IATF 16949, and industry-specific regulatory requirements.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Real-time Statistical Process Control charts monitor critical parameters continuously, alerting operators the moment a process drifts out of control — before it produces defective parts. Combined with supplier quality management, quality analytics, and AI-powered defect prediction, IRIS QMS transforms quality from a cost center into a competitive advantage.
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
              title="Zero-Defect Manufacturing"
              description="Comprehensive quality management that covers inspections, non-conformances, root cause analysis, SPC, and supplier quality — all in one system."
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
                title="AI-Powered QMS"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Quality problems are rarely random — they follow patterns that AI can detect far earlier than traditional methods. The IRIS QMS module leverages the DATA_AI engine to analyze defect data, process parameters, and material characteristics together, identifying the root causes and contributing factors that drive quality issues.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Defect prediction models trained on your historical quality data can flag high-risk production runs before they start — based on material lot properties, environmental conditions, machine state, and operator experience. When a non-conformance is opened, AI suggests probable root causes ranked by likelihood, accelerating the investigation process from days to hours. SPC charts are enhanced with ML-based pattern recognition that detects trends, shifts, and cyclical patterns that traditional Western Electric rules would miss.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    { label: "Defect Prediction", desc: "ML models flag high-risk production runs before they start based on process and material data" },
                    { label: "Root Cause Suggestions", desc: "AI ranks probable root causes by likelihood when a non-conformance is opened" },
                    { label: "Advanced SPC", desc: "ML-enhanced pattern recognition detects process drift earlier than traditional statistical rules" },
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
                <Image
                  src="/images/iris-ui/qms-suppliers.png"
                  alt="IRIS QMS — supplier quality management with performance scoring"
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
              title="Quality Across the Value Chain"
              description="QMS connects to production, warehouse, maintenance, and IoT — ensuring quality data flows wherever decisions are made."
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
                See QMS in Action
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                From inspection plans to SPC charts — see how IRIS QMS drives zero-defect manufacturing.
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
