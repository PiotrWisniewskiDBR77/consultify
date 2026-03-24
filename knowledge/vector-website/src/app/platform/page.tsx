"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  X,
  Check,
  ArrowRight,
  ArrowDown,
  Layers,
  Cpu,
  BrainCircuit,
  Radio,
  Shield,
  Zap,
  MessageSquare,
  ListChecks,
  Bell,
  Users,
  HardHat,
  Globe,
  Lock,
  Server,
} from "lucide-react";

const PAIN_POINTS = [
  { text: "Data trapped in silos between departments", detail: "MES doesn't talk to WMS. QMS doesn't see CMMS data. You're flying blind." },
  { text: "Reactive decisions based on outdated reports", detail: "By the time you see the report, the problem already cost you a shift." },
  { text: "No simulation before CAPEX investment", detail: "You're spending millions on gut feeling instead of validated scenarios." },
  { text: "Excel-based planning for million-dollar operations", detail: "Your production schedule lives in a spreadsheet. One wrong cell, one missed order." },
  { text: "Automation without validated ROI", detail: "You automated a process but can't prove it was worth the investment." },
];

const ARCHITECTURE_LAYERS = [
  {
    icon: Radio,
    label: "IoT & Connectivity Layer",
    sublabel: "Sensors, PLCs, SCADA, Edge Gateways",
    description: "Real-time data ingestion from every machine, sensor, and device on your shop floor. Protocol-agnostic: MQTT, OPC-UA, Modbus, REST.",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    icon: Layers,
    label: "Execution Layer",
    sublabel: "MES, WMS, QMS, CMMS, HRM, HSE",
    description: "The operational backbone. Production tracking, warehouse management, quality control, maintenance, workforce, and safety — all unified under one data model.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    icon: Cpu,
    label: "Planning & Scheduling Layer",
    sublabel: "APS, MRP, KPI",
    description: "Advanced planning and scheduling, material requirements planning, and real-time KPI dashboards. Constraint-based optimization, not just Gantt charts.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    icon: BrainCircuit,
    label: "Intelligence Layer",
    sublabel: "Digital Twin, ML, LLMind, Recommendation Engine",
    description: "AI that doesn't just report — it reasons, predicts, recommends, and acts. Powered by LLMind, our proprietary industrial LLM, and a full Digital Twin for simulation and synthetic data.",
    color: "text-iris-violet",
    bgColor: "bg-iris-purple/10",
    borderColor: "border-iris-purple/20",
  },
];

const COMPARISON_ROWS = [
  { traditional: "Reports that arrive too late", iris: "Real-time decisions powered by AI" },
  { traditional: "Data silos across departments", iris: "Unified intelligence layer across all modules" },
  { traditional: "Reactive firefighting", iris: "Predictive and prescriptive operations" },
  { traditional: "Manual optimization by guesswork", iris: "AI-driven scenario simulation" },
  { traditional: "Months to deploy, years to ROI", iris: "Days to first value, modular rollout" },
  { traditional: "Bolted-on analytics", iris: "AI-native from the ground up" },
];

const CORE_MODULES = ["IoT", "MES", "KPI", "Digital Twin"];
const EXECUTION_MODULES = ["WMS", "QMS", "CMMS", "HRM", "HSE"];
const ADVANCED_MODULES = ["APS", "MRP", "ESG", "DATA_AI"];

const PLATFORM_SYSTEMS = [
  {
    icon: Zap,
    title: "MCP Events",
    subtitle: "Inter-Module Communication",
    description: "Every module publishes and subscribes to standardized MCP events. When a quality defect is detected in QMS, CMMS automatically receives a maintenance request, MES adjusts the production plan, and KPI dashboards update — all in real time, with zero manual handoff.",
    features: ["Event-driven architecture", "Cross-module orchestration", "Real-time propagation", "Full audit trail"],
  },
  {
    icon: ListChecks,
    title: "Tasking System",
    subtitle: "Distributed Task Management",
    description: "AI-generated and human-created tasks flow across modules with full lifecycle tracking. A predictive maintenance alert becomes a CMMS work order, assigned to the right technician, with parts reserved in WMS — automatically. Every task carries context from its origin.",
    features: ["AI-generated tasks", "Cross-module assignment", "Priority & escalation rules", "Human approval gates"],
  },
  {
    icon: Bell,
    title: "Communication System",
    subtitle: "Multi-Channel Notifications",
    description: "The right information reaches the right person at the right time. Push notifications, email, SMS, in-app alerts, and the built-in Team Communicator ensure no critical event goes unnoticed. Role-based routing means operators, supervisors, and managers each see what matters to them.",
    features: ["Team Communicator", "Role-based routing", "Multi-channel delivery", "Escalation workflows"],
  },
];

const DEPLOYMENT_OPTIONS = [
  {
    icon: Globe,
    title: "Cloud SaaS",
    description: "Multi-tenant deployment on our managed infrastructure. Automatic updates, zero maintenance overhead, enterprise-grade SLAs. Start in days, not months.",
  },
  {
    icon: Lock,
    title: "Private Cloud",
    description: "Dedicated instance in your preferred cloud provider (AWS, Azure, GCP). Full data sovereignty with the convenience of managed infrastructure.",
  },
  {
    icon: Server,
    title: "On-Premise",
    description: "Deploy IRIS entirely within your own data center. Complete control over data residency, network isolation, and compliance requirements. Ideal for regulated industries.",
  },
];

export default function PlatformPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

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
              PLATFORM
            </Badge>
            <h1
              className={cn(
                "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              A New Category: The{" "}
              <span className="text-gradient">AI-Native</span> Plant Operating
              System.
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              IRIS is not another MES. Not an ERP extension. Not a dashboard.
              It is the operational intelligence core of your factory — a single
              system that connects every sensor, every process, and every
              decision into one AI-powered loop.
            </p>
          </div>
        </Container>
      </section>

      {/* Section 2 — What is a Plant Operating System */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            label="NEW CATEGORY"
            title="What Is a Plant Operating System?"
            description="An operating system runs your computer. A Plant Operating System runs your factory. It's the single layer that connects IoT data, execution systems, planning engines, and AI intelligence — so they work as one."
            align="center"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card variant="glow" padding="lg" className="text-center">
              <p className="text-4xl font-bold text-gradient mb-2">20+</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Integrated Modules
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                MES, WMS, QMS, CMMS, APS, MRP, and more
              </p>
            </Card>
            <Card variant="glow" padding="lg" className="text-center">
              <p className="text-4xl font-bold text-gradient mb-2">1</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Unified Data Model
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                No integrations. No data mapping. One source of truth.
              </p>
            </Card>
            <Card variant="glow" padding="lg" className="text-center">
              <p className="text-4xl font-bold text-gradient mb-2">AI</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Native Intelligence
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                Every module has its own AI component. Not bolted on — built in.
              </p>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Section 3 — The Problem */}
      <Section variant="default">
        <Container>
          <SectionHeader
            title="Most Factories Run on Disconnected Systems"
            description="You have an MES from one vendor, a WMS from another, quality in spreadsheets, and maintenance on whiteboards. Sound familiar?"
            align="center"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {PAIN_POINTS.map(({ text, detail }) => (
              <Card
                key={text}
                variant="default"
                padding="md"
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-4 h-4 text-red-400" />
                  </div>
                  <p
                    className={cn(
                      "text-sm font-medium leading-snug",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    {text}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-xs leading-relaxed pl-11",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  {detail}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 4 — Architecture */}
      <div id="ai">
        <Section variant="alternate">
          <Container>
            <SectionHeader
              label="ARCHITECTURE"
              title="From Sensors to Decisions. Four Layers. One System."
              description="IRIS covers the full automation pyramid — from raw IoT signals to AI-driven executive decisions — in a single, integrated platform."
              align="center"
            />
          <div className="max-w-3xl mx-auto space-y-4">
            {ARCHITECTURE_LAYERS.slice()
              .reverse()
              .map((layer, i) => {
                const Icon = layer.icon;
                return (
                  <div key={layer.label}>
                    <Card variant="default" padding="lg">
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
                            layer.bgColor
                          )}
                        >
                          <Icon className={cn("w-6 h-6", layer.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3
                              className={cn(
                                "font-semibold text-lg",
                                isLight ? "text-slate-900" : "text-white"
                              )}
                            >
                              {layer.label}
                            </h3>
                            <Badge variant="outline">{layer.sublabel}</Badge>
                          </div>
                          <p
                            className={cn(
                              "mt-2 leading-relaxed",
                              isLight ? "text-slate-600" : "text-slate-400"
                            )}
                          >
                            {layer.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                    {i < ARCHITECTURE_LAYERS.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowDown
                          className={cn(
                            "w-5 h-5",
                            isLight ? "text-slate-300" : "text-slate-600"
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          </Container>
        </Section>
      </div>

      {/* Section 5 — POS vs Traditional */}
      <Section variant="default">
        <Container>
          <SectionHeader
            title="Plant Operating System vs. Traditional Approach"
            description="Stop stitching together point solutions. IRIS replaces the patchwork with a platform."
            align="center"
          />
          <div
            className={cn(
              "max-w-3xl mx-auto overflow-hidden rounded-2xl border",
              isLight ? "border-black/[0.08]" : "border-white/10"
            )}
          >
            <div
              className={cn(
                "grid grid-cols-2",
                isLight ? "bg-slate-50" : "bg-navy-800/30"
              )}
            >
              <div
                className={cn(
                  "px-6 py-4 border-b border-r font-semibold text-sm uppercase tracking-wider",
                  isLight
                    ? "border-black/[0.08] bg-slate-100/50 text-slate-600"
                    : "border-white/10 bg-slate-900/30 text-slate-500"
                )}
              >
                Traditional
              </div>
              <div
                className={cn(
                  "px-6 py-4 border-b font-semibold text-sm uppercase tracking-wider",
                  isLight
                    ? "border-black/[0.08] bg-iris-purple/10 text-iris-violet"
                    : "border-white/10 bg-iris-purple/10 text-iris-violet"
                )}
              >
                IRIS POS
              </div>
            </div>
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.traditional}
                className={cn(
                  "grid grid-cols-2 border-b last:border-b-0",
                  isLight ? "border-black/[0.08]" : "border-white/5"
                )}
              >
                <div
                  className={cn(
                    "px-6 py-4 border-r",
                    isLight
                      ? "text-slate-600 border-black/[0.08]"
                      : "text-slate-400 border-white/5"
                  )}
                >
                  {row.traditional}
                </div>
                <div
                  className={cn(
                    "px-6 py-4 flex items-center gap-2 bg-iris-purple/5",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  <Check className="w-5 h-5 text-iris-green flex-shrink-0" />
                  {row.iris}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 6 — Modular Architecture */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            label="MODULAR BY DESIGN"
            title="Start With What You Need. Grow When You're Ready."
            description="No big-bang deployment. No all-or-nothing commitment. Begin with the core — IoT, MES, KPI, and Digital Twin — then activate execution modules, then advanced intelligence. Each module shares the same data model, so adding one is configuration, not integration."
            align="center"
          />
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "glow-purple glow-border rounded-xl border-2 border-iris-purple/40 px-6 py-4 w-full max-w-md",
                  isLight ? "bg-slate-50" : "bg-navy-800/60"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-iris-violet mb-2">
                  Start Here — Core Modules
                </p>
                <div className="flex flex-wrap gap-2">
                  {CORE_MODULES.map((m) => (
                    <Badge key={m} variant="purple">
                      {m}
                    </Badge>
                  ))}
                </div>
                <p
                  className={cn(
                    "text-xs mt-3",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Connect your machines, track production, measure KPIs, and
                  build your Digital Twin.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-iris-purple/60 -rotate-90" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "rounded-xl border px-6 py-4 w-full max-w-lg",
                  isLight
                    ? "border-black/[0.08] bg-slate-50"
                    : "border-white/10 bg-navy-800/40"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-widest mb-2",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Expand — Execution Modules
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXECUTION_MODULES.map((m) => (
                    <Badge key={m} variant="outline">
                      {m}
                    </Badge>
                  ))}
                </div>
                <p
                  className={cn(
                    "text-xs mt-3",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Add warehouse, quality, maintenance, workforce, and safety
                  management as your needs grow.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-iris-purple/60 -rotate-90" />
            </div>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "glow-purple rounded-xl border border-iris-purple/30 px-6 py-4 w-full max-w-xl",
                  isLight ? "bg-slate-50" : "bg-navy-800/60"
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-iris-cyan mb-2">
                  Unlock — Advanced Intelligence
                </p>
                <div className="flex flex-wrap gap-2">
                  {ADVANCED_MODULES.map((m) => (
                    <Badge key={m} variant="purple">
                      {m}
                    </Badge>
                  ))}
                </div>
                <p
                  className={cn(
                    "text-xs mt-3",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Enable advanced planning, material requirements, ESG
                  reporting, and learning management.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 7 — Platform Systems: MCP, Tasking, Communication */}
      <div id="team-communicator">
        <Section variant="default">
          <Container>
            <SectionHeader
              label="PLATFORM BACKBONE"
              title="The Connective Tissue That Makes It All Work"
              description="Modules are powerful alone. Together, they're transformative. Three platform-wide systems ensure every module communicates, collaborates, and acts as one."
              align="center"
            />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {PLATFORM_SYSTEMS.map(({ icon: Icon, title, subtitle, description, features }) => (
              <Card key={title} variant="glow" padding="lg" className="h-full flex flex-col">
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
                  {features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-iris-green flex-shrink-0" />
                      <span
                        className={cn(
                          "text-sm",
                          isLight ? "text-slate-600" : "text-slate-300"
                        )}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          </Container>
        </Section>
      </div>

      {/* Section 8 — Multi-Tenant SaaS & Deployment */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            label="DEPLOYMENT"
            title="Multi-Tenant SaaS. Your Data, Your Rules."
            description="IRIS is built as a multi-tenant SaaS platform with row-level security and complete tenant isolation. But we know manufacturing has strict data requirements — so you choose where your data lives."
            align="center"
          />
          <div className={cn("relative w-full max-w-3xl mx-auto aspect-square rounded-2xl overflow-hidden border mt-12", isLight ? "border-black/[0.08]" : "border-white/10")}>
            <Image
              src="/images/platform/cloud-architecture.png"
              alt="IRIS Cloud Architecture — multi-tenant SaaS platform connecting factories"
              fill
              className="object-contain"
              quality={90}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
            {DEPLOYMENT_OPTIONS.map(({ icon: Icon, title, description }) => (
              <Card key={title} variant="default" padding="lg" className="text-center">
                <div
                  className={cn(
                    "w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center",
                    isLight ? "bg-slate-100" : "bg-navy-800/60"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-7 h-7",
                      isLight ? "text-slate-600" : "text-slate-300"
                    )}
                  />
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
            ))}
          </div>
          <div className="mt-8 max-w-2xl mx-auto">
            <Card variant="glow" padding="md">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-iris-green flex-shrink-0 mt-0.5" />
                <div>
                  <p
                    className={cn(
                      "font-medium text-sm",
                      isLight ? "text-slate-900" : "text-white"
                    )}
                  >
                    Enterprise-grade security across all deployment options
                  </p>
                  <p
                    className={cn(
                      "text-sm mt-1",
                      isLight ? "text-slate-600" : "text-slate-400"
                    )}
                  >
                    JWT-based authentication, row-level tenant isolation,
                    encrypted data at rest and in transit, full audit trails,
                    and GDPR-compliant data export and deletion.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Section 9 — Built by Operators */}
      <Section variant="default">
        <Container>
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  isLight ? "bg-slate-100" : "bg-navy-800/60"
                )}
              >
                <HardHat
                  className={cn(
                    "w-8 h-8",
                    isLight ? "text-slate-600" : "text-slate-300"
                  )}
                />
              </div>
            </div>
            <h2
              className={cn(
                "text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              Built by Operators. For Operators.
            </h2>
            <p
              className={cn(
                "mt-5 text-base leading-relaxed sm:text-lg max-w-2xl mx-auto",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              DBR77 is not a software house that discovered manufacturing. We
              are factory operators who built the software we wished existed.
              Every feature in IRIS was born from real production floors, real
              pain points, and real operators who were tired of tools that
              didn't understand their world.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className={cn(
                  "rounded-xl border px-4 py-5",
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
                  Designed for the shop floor
                </p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Touch-first interfaces that work with gloves, in noisy
                  environments, on any device.
                </p>
              </div>
              <div
                className={cn(
                  "rounded-xl border px-4 py-5",
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
                  Speaks your language
                </p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  OEE, MTBF, MTTR, changeover time, scrap rate — not software
                  jargon.
                </p>
              </div>
              <div
                className={cn(
                  "rounded-xl border px-4 py-5",
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
                  Zero training curve
                </p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  If you can use a smartphone, you can use IRIS. Onboarding
                  takes hours, not weeks.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 10 — Part of DBR77 Industrial Intelligence */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            title="Part of DBR77 Industrial Intelligence"
            description="IRIS powers the Measure and Optimize stages of the DBR77 Industrial Intelligence framework — the methodology that transforms factories from reactive operations to autonomous optimization."
            align="center"
          />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="glow-border rounded-xl border-2 border-iris-purple/50 bg-iris-purple/10 px-6 py-4 min-w-[140px] text-center">
                <p
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  Measure
                </p>
                <p className="text-xs text-iris-violet mt-1">IRIS</p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "w-6 h-6 rotate-90 sm:rotate-0",
                isLight ? "text-slate-400" : "text-slate-500"
              )}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="glow-border rounded-xl border-2 border-iris-purple/50 bg-iris-purple/10 px-6 py-4 min-w-[140px] text-center">
                <p
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-900" : "text-white"
                  )}
                >
                  Optimize
                </p>
                <p className="text-xs text-iris-violet mt-1">IRIS</p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "w-6 h-6 rotate-90 sm:rotate-0",
                isLight ? "text-slate-400" : "text-slate-500"
              )}
            />
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "rounded-xl border px-6 py-4 min-w-[140px] text-center",
                  isLight
                    ? "border-black/[0.08] bg-slate-50"
                    : "border-white/10 bg-navy-800/50"
                )}
              >
                <p
                  className={cn(
                    "font-semibold",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Automate
                </p>
                <p
                  className={cn(
                    "text-xs mt-1",
                    isLight ? "text-slate-600" : "text-slate-500"
                  )}
                >
                  Coming soon
                </p>
              </div>
            </div>
          </div>
          <p className="mt-8 text-center">
            <a
              href="https://dbr77.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-iris-violet hover:text-iris-magenta underline underline-offset-4 transition-colors"
            >
              Learn more at dbr77.com →
            </a>
          </p>
        </Container>
      </Section>

      {/* Section 11 — CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2
              className={cn(
                "text-3xl sm:text-4xl font-bold tracking-tight",
                isLight ? "text-slate-900" : "text-white"
              )}
            >
              See the Platform in Action.
            </h2>
            <p
              className={cn(
                "mt-4 text-lg",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Book a personalized demo and see how IRIS transforms your
              operations from day one.
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
                href="/trial"
                className="min-w-[200px]"
              >
                Start 14-Day Trial
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
