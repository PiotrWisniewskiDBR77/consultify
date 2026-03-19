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
  Brain,
  Database,
  Cpu,
  MessageSquare,
  Sparkles,
  GitBranch,
  Layers,
  FlaskConical,
  Factory,
  ShieldCheck,
  Wrench,
  Warehouse,
  BarChart3,
  Calendar,
  Shield,
} from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    title: "ML Model Lifecycle",
    description:
      "End-to-end management from experiment to production. Train, evaluate, version, deploy, and monitor models — all within the IRIS ecosystem. A/B testing and automatic rollback included.",
  },
  {
    icon: Database,
    title: "RAG Knowledge Bases",
    description:
      "Ingest operational documents, SOPs, and maintenance logs into vector-indexed knowledge bases. Retrieval-Augmented Generation delivers answers grounded in your actual data, not generic training sets.",
  },
  {
    icon: MessageSquare,
    title: "LLMind — Proprietary LLM",
    description:
      "IRIS's own large language model, fine-tuned on manufacturing operations. LLMind understands production context, speaks your domain language, and runs on-premise for full data sovereignty.",
  },
  {
    icon: Sparkles,
    title: "AI Recommendation Engine",
    description:
      "Cross-module analysis generates actionable recommendations — from maintenance scheduling to quality adjustments. Every suggestion includes confidence scores and human approval gates.",
  },
  {
    icon: Layers,
    title: "Vector Embeddings & Semantic Search",
    description:
      "Transform unstructured data into high-dimensional vectors. Semantic search finds relevant information by meaning, not keywords — making tribal knowledge accessible to everyone.",
  },
  {
    icon: FlaskConical,
    title: "ML Studio & Experiments",
    description:
      "A built-in experimentation platform for data scientists. Track hyperparameters, compare runs, visualize metrics, and promote winning models to the registry with one click.",
  },
  {
    icon: GitBranch,
    title: "Feature Store & Pipelines",
    description:
      "Centralized feature engineering with versioned, reusable features served online and offline. ETL/ELT pipelines handle data transformation, scheduling, and error recovery automatically.",
  },
  {
    icon: Brain,
    title: "Synthetic Data Training",
    description:
      "Don't wait years for historical data. Generate synthetic training datasets from Digital Twin simulations, enabling predictive models from day one of deployment.",
  },
];

const AI_CAPABILITIES = [
  {
    title: "Predictive Maintenance",
    description:
      "ML models analyze sensor telemetry, vibration patterns, and maintenance history to predict equipment failures days before they happen — reducing unplanned downtime by up to 40%.",
  },
  {
    title: "Quality Prediction",
    description:
      "Catch defects before they reach the end of the line. Models trained on process parameters and inspection data flag at-risk batches in real time.",
  },
  {
    title: "Demand Forecasting",
    description:
      "Combine historical sales, seasonality, and external signals to forecast demand with ML precision — feeding directly into APS for optimized production planning.",
  },
];

const INTEGRATIONS = [
  { icon: Factory, name: "MES", description: "Production telemetry feeds ML models and real-time dashboards." },
  { icon: ShieldCheck, name: "QMS", description: "Quality data trains prediction models and triggers anomaly alerts." },
  { icon: Wrench, name: "CMMS", description: "Maintenance history powers predictive maintenance algorithms." },
  { icon: Warehouse, name: "WMS", description: "Warehouse flow data enables demand and inventory forecasting." },
  { icon: BarChart3, name: "KPI", description: "AI recommendations surface directly in KPI dashboards." },
  { icon: Calendar, name: "APS", description: "Demand forecasts feed advanced planning and scheduling." },
  { icon: Shield, name: "HSE", description: "Safety data trains risk prediction and incident prevention models." },
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

export default function DataAiPage() {
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
        <Image src="/images/modules/ai-neural-network.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="purple" className="mb-6">Core</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              DATA_AI —{" "}
              <span className="text-gradient">Intelligence Engine</span>
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The AI backbone of the IRIS platform. Machine learning models, RAG
              knowledge bases, and a proprietary LLM — purpose-built for
              manufacturing.
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
                Most manufacturing AI is bolted on as an afterthought — a
                dashboard widget here, a predictive alert there. DATA_AI is
                different. It&apos;s the foundational intelligence layer that
                every IRIS module draws from, creating a single source of truth
                for data, models, and AI-driven decisions.
              </p>
              <p
                className={cn(
                  "text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                From raw sensor streams to production-grade ML models, DATA_AI
                manages the entire data lifecycle. It ingests data from any
                source — databases, APIs, IoT sensors, files — transforms it
                through configurable pipelines, and stores it in versioned
                datasets ready for training. Models are tracked through
                experiments, registered in a central registry, and served via
                low-latency APIs.
              </p>
              <p
                className={cn(
                  "text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                What makes DATA_AI unique is the closed loop: AI doesn&apos;t
                just analyze — it recommends, and those recommendations become
                tasks that humans approve and execute. New execution data flows
                back into the models, making them smarter with every cycle.
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
              title="Full-Stack AI for Manufacturing"
              description="Eight core capabilities that cover the entire data-to-decision pipeline — from ingestion to inference."
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
              label="USE CASES"
              title="AI That Delivers Measurable ROI"
              description="DATA_AI powers concrete use cases that reduce downtime, prevent defects, and optimize planning — with results you can measure in weeks, not years."
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
                      <Sparkles className="h-5 w-5 text-iris-violet flex-shrink-0" aria-hidden />
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
                  src="/images/modules/ai-neural-network.png"
                  alt="IRIS AI Engine — neural network analyzing factory data"
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
              title="Intelligence Across Every Module"
              description="DATA_AI isn't isolated — it's the shared brain that every IRIS module taps into for predictions, recommendations, and insights."
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
                Unlock the intelligence in your data
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how DATA_AI turns raw operational data into predictions,
                recommendations, and autonomous decisions.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button variant="primary" size="lg" href="/contact" className="min-w-[200px]">
                  Request a Demo
                </Button>
                <Button variant="secondary" size="lg" href="/ai" className="min-w-[200px]">
                  Learn About IRIS AI
                </Button>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
