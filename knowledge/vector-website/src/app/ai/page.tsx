"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  BrainCircuit,
  MessageSquare,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Server,
  Shield,
  Sparkles,
  Database,
  BarChart3,
  Wrench,
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Microscope,
  Lock,
} from "lucide-react";

const AI_PILLARS = [
  {
    icon: BarChart3,
    title: "Machine Learning",
    subtitle: "Predictive Intelligence",
    description:
      "Classical and deep learning models trained on your operational data — and synthetic data from the Digital Twin when historical data is scarce. Time-series forecasting, classification, regression, and anomaly detection running continuously across every module.",
    capabilities: [
      "Predictive maintenance",
      "Quality prediction",
      "Demand forecasting",
      "Anomaly detection",
      "Process optimization",
    ],
  },
  {
    icon: MessageSquare,
    title: "LLM & RAG",
    subtitle: "Contextual Reasoning",
    description:
      "Powered by LLMind — DBR77's proprietary industrial LLM — combined with Retrieval-Augmented Generation on your operational knowledge bases. Ask questions in natural language, get answers grounded in your SOPs, maintenance logs, quality records, and production data.",
    capabilities: [
      "Natural language queries",
      "Semantic search across all modules",
      "SOP and procedure lookup",
      "Root cause analysis",
      "Contextual recommendations",
    ],
  },
  {
    icon: Lightbulb,
    title: "Recommendation Engine",
    subtitle: "Prescriptive Action",
    description:
      "Cross-module analysis that doesn't just tell you what happened — it tells you what to do next. AI-generated recommendations become tasks with human approval gates, closing the loop from insight to execution automatically.",
    capabilities: [
      "Cross-module pattern detection",
      "Auto-generated action items",
      "Human-in-the-loop approval",
      "Impact estimation",
      "Continuous learning from outcomes",
    ],
  },
];

const CLOSED_LOOP_STEPS = [
  { label: "Data", description: "IoT sensors, production events, quality checks" },
  { label: "Digital Twin", description: "Simulation, scenario modeling, synthetic data" },
  { label: "ML Model", description: "Prediction, classification, anomaly detection" },
  { label: "LLM Reasoning", description: "Context analysis, root cause, explanation" },
  { label: "Recommendation", description: "Actionable insight with estimated impact" },
  { label: "Task", description: "Auto-created, assigned, prioritized" },
  { label: "Human Approval", description: "Review, approve, or reject" },
  { label: "Execution", description: "Work order, schedule change, parameter adjustment" },
  { label: "Feedback", description: "Outcome data feeds back into the loop" },
];

const LLMIND_FEATURES = [
  {
    icon: BrainCircuit,
    title: "Purpose-Built for Manufacturing",
    description:
      "LLMind is not a general-purpose chatbot fine-tuned for industry. It was trained from the ground up on manufacturing processes, operational terminology, and industrial workflows. It understands OEE, MTBF, changeover optimization, and batch scheduling natively.",
  },
  {
    icon: Server,
    title: "On-Premise Deployment",
    description:
      "For organizations with strict data sovereignty requirements, LLMind can be deployed entirely on-premise. Your operational data never leaves your network. No cloud dependency, no third-party data processing — full control.",
  },
  {
    icon: Shield,
    title: "RAG on Your Operational Data",
    description:
      "Vector embeddings are generated from your SOPs, maintenance logs, quality records, production data, and knowledge bases. When LLMind answers a question, it retrieves relevant context from your data first — grounding every response in facts, not hallucinations.",
  },
  {
    icon: Sparkles,
    title: "Every Module Has Its Own AI",
    description:
      "LLMind isn't a single chatbot sitting on top. Each IRIS module — MES, WMS, QMS, CMMS, APS — has its own AI component powered by LLMind, trained on module-specific data and optimized for module-specific tasks.",
  },
];

const DIGITAL_TWIN_BENEFITS = [
  {
    title: "Synthetic Training Data",
    description:
      "Don't have 2 years of failure data to train a predictive maintenance model? The Digital Twin simulates thousands of scenarios — equipment degradation, process variations, demand spikes — generating the training data your ML models need, today.",
  },
  {
    title: "Scenario Simulation",
    description:
      "What happens if you add a third shift? Change the batch size? Move a workstation? Run the scenario in the Digital Twin before spending a dollar. Validate ROI with data, not gut feeling.",
  },
  {
    title: "Continuous Model Validation",
    description:
      "ML models degrade over time as conditions change. The Digital Twin continuously generates test scenarios to validate model accuracy, triggering retraining before predictions become unreliable.",
  },
];

const USE_CASES = [
  {
    icon: Wrench,
    title: "Predictive Maintenance",
    description:
      "Vibration patterns, temperature trends, and cycle counts feed ML models that predict bearing failures 2–3 weeks before they happen. CMMS automatically schedules the work order. WMS reserves the spare parts. Zero unplanned downtime.",
    badge: "ML + Tasking",
  },
  {
    icon: Microscope,
    title: "Quality Prediction",
    description:
      "Process parameters from the current batch are compared against historical quality outcomes in real time. If the model detects drift toward a defect, operators receive an alert with specific parameter adjustments — before the defect occurs.",
    badge: "ML + LLM",
  },
  {
    icon: ShoppingCart,
    title: "Demand Forecasting",
    description:
      "Time-series models analyze order history, seasonality, and external signals to forecast demand 4–12 weeks ahead. APS uses the forecast to optimize production scheduling. MRP adjusts material procurement automatically.",
    badge: "ML + APS",
  },
  {
    icon: AlertTriangle,
    title: "Anomaly Detection",
    description:
      "Unsupervised models continuously monitor hundreds of process variables across every production line. When something deviates from normal — even subtly — the system flags it, explains the likely cause via LLM reasoning, and recommends corrective action.",
    badge: "ML + LLM + Recommendations",
  },
  {
    icon: TrendingUp,
    title: "OEE Optimization",
    description:
      "AI analyzes availability, performance, and quality losses across all lines, identifies the highest-impact improvement opportunities, and generates prioritized action plans. Digital Twin simulates each improvement before implementation.",
    badge: "ML + Digital Twin",
  },
  {
    icon: FlaskConical,
    title: "Process Parameter Optimization",
    description:
      "For every product-machine combination, ML models learn the optimal process parameters that maximize quality and throughput. Recommendations are pushed to operators in real time, with the reasoning explained by LLMind.",
    badge: "ML + LLM + Recommendations",
  },
];

const CHAT_EXAMPLES = [
  {
    prompt: "Why did OEE drop on Line 3 yesterday?",
    response:
      "OEE dropped 12% due to 3 unplanned stoppages. Root cause: bearing wear on conveyor C2 — CMMS flagged predictive maintenance 5 days ago but the work order wasn't prioritized. Recommend scheduling maintenance before next shift. Estimated recovery: +14% OEE.",
  },
  {
    prompt: "What's the optimal batch size for Product X?",
    response:
      "Based on changeover costs, demand patterns, and quality yield data, batches of 500 units minimize total cost per unit. Digital Twin simulation confirms 8% throughput improvement vs. current 200-unit batches, with no impact on quality metrics.",
  },
  {
    prompt: "Which machines are most likely to fail this week?",
    response:
      "3 machines flagged: Press #7 (bearing — 87% failure probability within 5 days), CNC-12 (spindle — 72% within 7 days), Conveyor B4 (motor — 65% within 10 days). Work orders have been drafted in CMMS. Approve to schedule?",
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

export default function AIPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const ref6 = useRef<HTMLDivElement>(null);
  const ref7 = useRef<HTMLDivElement>(null);
  const ref8 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });
  const isInView5 = useInView(ref5, { once: true, margin: "-80px" });
  const isInView6 = useInView(ref6, { once: true, margin: "-80px" });
  const isInView7 = useInView(ref7, { once: true, margin: "-80px" });
  const isInView8 = useInView(ref8, { once: true, margin: "-80px" });

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
            <Badge variant="purple" className="mb-6">
              AI-NATIVE
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Intelligence at the Core.{" "}
              <span className="text-gradient">Not Bolted On.</span>
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              Most platforms add AI as an afterthought — a chatbot here, a
              dashboard there. IRIS was architected with AI from day one. Every
              module has its own AI component. Every decision is informed by
              machine learning, LLM reasoning, and real-time recommendations.
            </p>
          </div>
        </Container>
      </section>

      {/* Section 2 — What AI-Native Means */}
      <Section variant="alternate">
        <Container>
          <div ref={ref1}>
            <SectionHeader
              label="WHAT AI-NATIVE MEANS"
              title="AI Is Not a Feature. It's the Foundation."
              description="In IRIS, AI isn't a separate module you can turn off. It's woven into the architecture itself — the way data flows, decisions are made, and actions are executed."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView1 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            >
              {AI_PILLARS.map(({ icon: Icon, title, subtitle, description, capabilities }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full flex flex-col">
                    <div className="text-iris-violet mb-4">
                      <Icon className="h-10 w-10" aria-hidden />
                    </div>
                    <h3
                      className={cn(
                        "font-semibold text-xl mb-1",
                        isLight ? "text-slate-900" : "text-white"
                      )}
                    >
                      {title}
                    </h3>
                    <p className="text-xs font-medium text-iris-violet mb-3">
                      {subtitle}
                    </p>
                    <p
                      className={cn(
                        "leading-relaxed text-sm mb-4",
                        isLight ? "text-slate-600" : "text-slate-400"
                      )}
                    >
                      {description}
                    </p>
                    <div className="mt-auto pt-4 space-y-2">
                      {capabilities.map((c) => (
                        <div key={c} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-iris-green flex-shrink-0" />
                          <span
                            className={cn(
                              "text-sm",
                              isLight ? "text-slate-600" : "text-slate-300"
                            )}
                          >
                            {c}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — The Closed Loop */}
      <Section variant="default">
        <Container>
          <div ref={ref2}>
            <SectionHeader
              label="CLOSED-LOOP AI"
              title="From Data to Decision to Execution — Automatically."
              description="This is what separates AI-native from AI-added. In IRIS, the loop never breaks: data generates insight, insight becomes a recommendation, the recommendation becomes a task, the task gets executed, and the outcome feeds back as new data."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView2 ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3 py-4">
                {CLOSED_LOOP_STEPS.map((step, i) => (
                  <div key={step.label} className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        "px-3 py-2.5 rounded-lg border text-center min-w-[90px] hover:border-iris-violet/40 transition-colors",
                        isLight
                          ? "bg-slate-50 border-iris-purple/20"
                          : "bg-navy-800/60 border-iris-purple/20"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {step.label}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] mt-0.5 leading-tight",
                          isLight ? "text-slate-600" : "text-slate-500"
                        )}
                      >
                        {step.description}
                      </p>
                    </div>
                    {i < CLOSED_LOOP_STEPS.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-iris-purple/60 flex-shrink-0 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
              <p
                className={cn(
                  "text-center text-sm mt-4 italic",
                  isLight ? "text-slate-600" : "text-slate-500"
                )}
              >
                The loop is continuous. Every execution generates new data that
                improves the next prediction.
              </p>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — LLMind */}
      <Section variant="alternate">
        <Container>
          <div ref={ref3}>
            <SectionHeader
              label="LLMIND"
              title="Meet LLMind. Our Proprietary Industrial LLM."
              description="General-purpose LLMs don't understand your factory. LLMind does. Built by DBR77 specifically for manufacturing operations, it reasons about production processes, maintenance procedures, and quality standards the way an experienced plant manager would."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView3 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              {LLMIND_FEATURES.map(({ icon: Icon, title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="default" padding="lg" className="h-full">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                          "bg-iris-purple/10"
                        )}
                      >
                        <Icon className="w-6 h-6 text-iris-violet" />
                      </div>
                      <div>
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
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Digital Twin as Data Generator */}
      <Section variant="default">
        <Container>
          <div ref={ref4}>
            <SectionHeader
              label="DIGITAL TWIN + AI"
              title="Train Models Without Waiting for Historical Data."
              description="The biggest barrier to industrial AI? Not enough data. The Digital Twin solves this by generating synthetic training data from simulated scenarios — so your ML models are production-ready from day one."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView4 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
            >
              {DIGITAL_TWIN_BENEFITS.map(({ title, description }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="glow" padding="lg" className="h-full">
                    <Database className="w-8 h-8 text-iris-cyan mb-4" />
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

      {/* Section 6 — Real Use Cases */}
      <Section variant="alternate">
        <Container>
          <div ref={ref5}>
            <SectionHeader
              label="USE CASES"
              title="AI That Solves Real Problems on the Shop Floor."
              description="Not theoretical. Not future-state. These are production use cases running in IRIS today."
              align="center"
            />
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView5 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {USE_CASES.map(({ icon: Icon, title, description, badge }) => (
                <motion.div key={title} variants={fadeInUp}>
                  <Card variant="default" padding="lg" className="h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-6 h-6 text-iris-violet flex-shrink-0" />
                      <h3
                        className={cn(
                          "font-semibold text-lg",
                          isLight ? "text-slate-900" : "text-white"
                        )}
                      >
                        {title}
                      </h3>
                    </div>
                    <Badge variant="purple" className="self-start mb-3">
                      {badge}
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

      {/* Section 7 — Talk to Your Factory */}
      <Section variant="default">
        <Container>
          <div ref={ref6}>
            <SectionHeader
              label="CONVERSATIONAL AI"
              title="Talk to Your Factory."
              description="Ask questions in natural language. Get answers grounded in your operational data — not generic responses from a chatbot that doesn't know your plant."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView6 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-2xl mx-auto"
            >
              <Card variant="default" padding="lg" className="border-iris-purple/20">
                <div className="space-y-5">
                  {CHAT_EXAMPLES.map(({ prompt, response }) => (
                    <div key={prompt} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-iris-cyan text-sm font-medium whitespace-nowrap">
                          You:
                        </span>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isLight ? "text-slate-700" : "text-slate-200"
                          )}
                        >
                          {prompt}
                        </p>
                      </div>
                      <div className="flex items-start gap-2 pl-4 border-l-2 border-iris-purple/30">
                        <span className="text-iris-violet text-sm font-medium whitespace-nowrap">
                          IRIS:
                        </span>
                        <p
                          className={cn(
                            "text-sm leading-relaxed",
                            isLight ? "text-slate-600" : "text-slate-400"
                          )}
                        >
                          {response}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "mt-5 pt-4 border-t",
                    isLight ? "border-black/[0.08]" : "border-white/5"
                  )}
                >
                  <div className="flex gap-2">
                    <div
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-3 text-sm",
                        isLight
                          ? "bg-slate-50 border-black/[0.08] text-slate-600"
                          : "bg-navy-800/50 border-white/5 text-slate-400"
                      )}
                    >
                      Ask IRIS anything about your operations...
                    </div>
                    <Button variant="primary" size="sm">
                      Send
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 8 — Data Sovereignty */}
      <Section variant="alternate">
        <Container>
          <div ref={ref7}>
            <SectionHeader
              label="DATA SOVEREIGNTY"
              title="Your Data. Your Infrastructure. Your Rules."
              description="We know manufacturing data is sensitive. That's why IRIS gives you full control over where your data lives and how AI processes it."
              align="center"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView7 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card variant="glow" padding="lg">
                  <Lock className="w-8 h-8 text-iris-violet mb-4" />
                  <h3
                    className={cn(
                      "font-semibold text-lg mb-2",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    On-Premise LLM
                  </h3>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    Deploy LLMind entirely within your own infrastructure. No
                    data leaves your network. No cloud API calls. Full
                    air-gapped operation for the most sensitive environments.
                  </p>
                </Card>
                <Card variant="glow" padding="lg">
                  <Shield className="w-8 h-8 text-iris-green mb-4" />
                  <h3
                    className={cn(
                      "font-semibold text-lg mb-2",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Tenant-Isolated AI
                  </h3>
                  <p
                    className={cn(
                      "text-sm leading-relaxed",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    In multi-tenant SaaS mode, every AI model, every knowledge
                    base, and every vector embedding is strictly isolated per
                    tenant. Your data never trains another customer's model.
                  </p>
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 9 — Governance */}
      <Section variant="default">
        <Container>
          <div ref={ref8}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView8 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-3xl mx-auto text-center"
            >
              <SectionHeader
                label="GOVERNANCE"
                title="Intelligence Guided by Human Judgment."
                description="AI recommends. Leaders decide. Every AI-generated recommendation can be reviewed, approved, modified, or rejected before execution. Full audit trail on every decision. Because in manufacturing, accountability matters."
                align="center"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                  className={cn(
                    "rounded-xl border px-4 py-5 text-center",
                    isLight
                      ? "border-black/[0.08] bg-slate-50"
                      : "border-white/10 bg-navy-800/40"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Approval Gates
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    Configurable per module, per role, per risk level
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-xl border px-4 py-5 text-center",
                    isLight
                      ? "border-black/[0.08] bg-slate-50"
                      : "border-white/10 bg-navy-800/40"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Full Audit Trail
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    Every recommendation, decision, and outcome is logged
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-xl border px-4 py-5 text-center",
                    isLight
                      ? "border-black/[0.08] bg-slate-50"
                      : "border-white/10 bg-navy-800/40"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Explainable AI
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    LLMind explains its reasoning in plain language
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 10 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              See AI-Native Manufacturing in Action.
            </h2>
            <p
              className={cn(
                "mt-4 text-lg",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Book a demo and see how IRIS turns your factory data into
              decisions — automatically.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                href="/demo"
                className="min-w-[200px]"
              >
                Book a Demo
              </Button>
              <Button
                variant="secondary"
                size="lg"
                href="/platform"
                className="min-w-[200px]"
              >
                Explore the Platform
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
