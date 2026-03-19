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
  Box,
  Radio,
  RefreshCw,
  Cuboid,
  FlaskConical,
  ShieldCheck,
  LayoutDashboard,
  BellRing,
} from "lucide-react";

const FEATURES = [
  {
    icon: Box,
    title: "Digital Twin Management",
    description:
      "Create digital replicas of assets, production lines, and entire processes. Configure twin models, manage versions, define relationships, and track status across your facility.",
  },
  {
    icon: Radio,
    title: "Sensor Integration & Telemetry",
    description:
      "Connect thousands of sensors and collect telemetry data at scale — up to 10,000+ events per second. Aggregate, store, and stream time-series data in real time.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Synchronization",
    description:
      "Keep digital twins in perfect sync with their physical counterparts via WebSocket connections. Bidirectional communication ensures changes flow both ways instantly.",
  },
  {
    icon: Cuboid,
    title: "3D Visualization & Unity",
    description:
      "Render interactive 3D models of your factory floor with Unity and WebGL integration. Navigate scenes, inspect assets, and overlay live data on visual representations.",
  },
  {
    icon: FlaskConical,
    title: "Simulation & What-If Scenarios",
    description:
      "Run simulations with variable parameters to test production changes, capacity adjustments, or process optimizations — before committing resources in the real world.",
  },
  {
    icon: ShieldCheck,
    title: "Validation & Verification",
    description:
      "Validate twin configurations, verify model behavior against real-world data, and generate validation reports. Ensure your digital twin accurately reflects physical reality.",
  },
  {
    icon: LayoutDashboard,
    title: "Unified Dashboard & Analytics",
    description:
      "Monitor all digital twins from a single dashboard with real-time metrics, historical trends, customizable widgets, and export capabilities for deeper analysis.",
  },
  {
    icon: BellRing,
    title: "Alarms & Anomaly Detection",
    description:
      "Configure threshold-based alarms and AI-driven anomaly detection. Get instant notifications when sensor readings deviate from expected patterns, with full escalation support.",
  },
];

const INTEGRATIONS = [
  {
    name: "MES",
    description: "Mirror production lines and processes for real-time monitoring and simulation.",
  },
  {
    name: "CMMS",
    description: "Link asset twins to maintenance records for predictive maintenance modeling.",
  },
  {
    name: "QMS",
    description: "Overlay quality data on digital twins to visualize defect patterns spatially.",
  },
  {
    name: "HSE",
    description: "Integrate safety and environmental data for risk-aware simulations.",
  },
  {
    name: "IoT",
    description: "Ingest sensor telemetry from the IoT layer to feed digital twin state in real time.",
  },
  {
    name: "DATA_AI",
    description: "Power predictive models, anomaly detection, and optimization recommendations.",
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

export default function DTModulePage() {
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
        <Image src="/images/modules/digital-twin-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
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
              Digital Twin
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Build a living digital replica of your factory. Simulate changes, validate decisions,
              and optimize operations — all without touching the physical line.
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
              The IRIS Digital Twin module creates comprehensive digital representations of your
              physical assets, production lines, and processes. Every sensor reading, machine state,
              and process parameter is mirrored in real time — giving you a virtual factory that
              behaves exactly like the real one.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              With 3D visualization powered by Unity and WebGL, operators and engineers can navigate
              an interactive model of the shop floor, inspect individual assets, and overlay live
              telemetry data. The simulation engine lets you run what-if scenarios — test a new
              production schedule, model a capacity increase, or validate a process change — and see
              the projected outcome before committing a single resource.
            </p>
            <p
              className={cn(
                "text-base sm:text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Digital twins also serve as the foundation for synthetic data generation, enabling AI
              model training without disrupting live operations. Combined with predictive analytics
              from the DATA_AI module, your digital twin becomes a decision-support engine that
              quantifies ROI before every investment.
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
              title="Your Factory, Fully Digitized"
              description="From sensor ingestion to 3D simulation — everything you need to build, run, and optimize digital twins at scale."
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
                title="Simulate the Future. Decide With Confidence."
                align="center"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    title: "Predictive Maintenance",
                    text: "AI models analyze sensor telemetry to predict equipment failures days or weeks in advance. Schedule maintenance at the optimal moment — not too early, not too late.",
                  },
                  {
                    title: "Synthetic Data Generation",
                    text: "Generate realistic training data for machine learning models by running simulations on your digital twin. No production disruption, no data privacy concerns.",
                  },
                  {
                    title: "ROI Validation",
                    text: "Before investing in new equipment or process changes, simulate the impact on throughput, quality, and cost. Get a projected ROI backed by your own operational data.",
                  },
                  {
                    title: "Anomaly Detection",
                    text: "Continuous AI monitoring of sensor streams detects deviations from normal behavior in real time. Surface issues before they cascade into downtime or quality defects.",
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
                description="Navigate an interactive 3D model of your factory floor with live sensor overlays, real-time status indicators, and simulation controls."
                align="center"
              />
              <div className={cn("rounded-2xl overflow-hidden border max-w-4xl mx-auto", isLight ? "border-black/[0.08]" : "border-white/10")}>
                <Image src="/images/modules/digital-twin-concept.png" alt="Digital Twin — real factory vs digital twin simulation" width={1920} height={1080} className="w-full h-auto" quality={90} />
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
              title="The Digital Thread Across Your Operation"
              description="Digital Twin connects to every layer of the IRIS platform — from shop-floor sensors to AI models — creating a unified digital thread."
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
                Build your digital factory today
              </h2>
              <p
                className={cn(
                  "mt-4 text-base sm:text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS Digital Twin lets you simulate, validate, and optimize — turning your
                physical operations into a competitive advantage.
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
