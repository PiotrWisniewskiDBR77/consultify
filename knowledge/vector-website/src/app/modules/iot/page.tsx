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
  Wifi,
  Cpu,
  Activity,
  Bell,
  Database,
  Shield,
  Gauge,
  Radio,
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
    icon: Radio,
    title: "Universal Telemetry Ingestion",
    description:
      "Collect data from any industrial source — PLCs, sensors, SCADA systems, and edge gateways — through a high-throughput HTTP API that handles 10,000+ messages per second.",
  },
  {
    icon: Cpu,
    title: "Edge Computing & Offline Sync",
    description:
      "Process data at the edge for latency-critical decisions. Edge devices continue operating offline and automatically synchronize when connectivity is restored.",
  },
  {
    icon: Activity,
    title: "Real-Time Device Monitoring",
    description:
      "Track the online/offline status of every connected device in real time. Instantly see which assets are reporting, idle, or in maintenance mode.",
  },
  {
    icon: Bell,
    title: "Threshold-Based Alert Rules",
    description:
      "Define min/max thresholds, conditional rules, and scheduled evaluations for any telemetry metric. Alerts trigger instantly through the GEMBA notification system.",
  },
  {
    icon: Database,
    title: "Time-Series Storage & Retention",
    description:
      "Optimized time-series storage with configurable retention policies, automatic archival, and partitioned queries that return results in under 100ms.",
  },
  {
    icon: Shield,
    title: "Device Authentication & Security",
    description:
      "Every device authenticates via API keys with tenant-level isolation. Rate limiting, schema validation, and full audit logging protect your data pipeline.",
  },
  {
    icon: Gauge,
    title: "Schema Validation & Normalization",
    description:
      "Incoming telemetry is validated against defined schemas and normalized to a standard format — ensuring data consistency across thousands of heterogeneous devices.",
  },
  {
    icon: Wifi,
    title: "Device Lifecycle Management",
    description:
      "Register, configure, group, and decommission devices from a single interface. Link every device to its physical asset in the CMMS registry for full traceability.",
  },
];

const INTEGRATIONS = [
  { name: "MES", description: "Equipment telemetry feeds production monitoring" },
  { name: "GEMBA", description: "Alerts and device status on the shop floor dashboard" },
  { name: "DATA_AI", description: "Telemetry streams power ML models and anomaly detection" },
  { name: "Digital Twin", description: "Real-time sensor data synchronizes digital twins" },
  { name: "CMMS", description: "Devices linked to the asset registry for maintenance context" },
  { name: "QMS", description: "Process parameter monitoring for quality assurance" },
];

export default function IoTModulePage() {
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
        <Image src="/images/modules/iot-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
        <Container size="lg" className="relative z-10">
          <div ref={heroRef} className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <Badge variant="purple" className="mb-6">Core Module</Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              IoT & Connectivity
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The industrial data backbone. Connect every sensor, PLC, and machine on your shop floor — then turn raw telemetry into real-time intelligence.
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
                title="Your Factory's Nervous System"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  The IRIS IoT module is the data ingestion layer for your entire manufacturing operation. It collects telemetry from machines, sensors, PLCs, and edge gateways through a high-throughput HTTP API — normalizing, validating, and storing every data point in an optimized time-series database. Whether you&apos;re monitoring temperature, vibration, pressure, energy consumption, or custom process parameters, the IoT module handles it all at scale.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  But data collection is just the beginning. Every telemetry reading is automatically evaluated against configurable alert rules, fed into AI/ML models for predictive analytics, and synchronized with Digital Twin simulations. The result is a closed-loop system where your physical assets and their digital representations stay perfectly in sync — enabling predictive maintenance, anomaly detection, and data-driven optimization across the entire plant.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  With support for 10,000+ concurrent devices, edge computing for offline scenarios, and configurable data retention policies, the IoT module scales from a single production line to a multi-site enterprise deployment — without compromising on latency or reliability.
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
              title="Built for Industrial Scale"
              description="From sensor to insight in milliseconds. Every feature is designed for the demands of 24/7 manufacturing environments."
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
                title="AI-Powered IoT"
                align="center"
              />
              <div className="space-y-6">
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Every telemetry stream flowing through the IoT module is a training signal for IRIS&apos;s AI engine. The DATA_AI module continuously analyzes sensor data to detect anomalies that human operators would miss — subtle vibration pattern changes that predict bearing failure weeks in advance, temperature drift that signals calibration issues, or energy consumption spikes that indicate process inefficiency.
                </p>
                <p
                  className={cn(
                    "text-base sm:text-lg leading-relaxed",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  Machine learning models trained on your historical telemetry data provide predictive maintenance recommendations, automatically adjusting alert thresholds based on learned equipment behavior. Instead of static min/max rules, the system evolves with your operations — reducing false positives while catching genuine anomalies earlier.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                  {[
                    { label: "Anomaly Detection", desc: "AI identifies deviations from normal operating patterns across all connected devices" },
                    { label: "Predictive Maintenance", desc: "ML models forecast equipment failures before they cause unplanned downtime" },
                    { label: "Smart Thresholds", desc: "Alert rules that learn and adapt based on historical telemetry trends" },
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
                  src="/images/iris-ui/iot-device-overview.png"
                  alt="IRIS IoT Device Management — real-time sensor monitoring and connectivity dashboard"
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
              title="Connected to Every Module"
              description="IoT data flows seamlessly across the IRIS platform — powering production monitoring, quality control, maintenance, and AI analytics."
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
                See IoT & Connectivity in Action
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Connect your first device in minutes. See how real-time telemetry transforms your operations.
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
