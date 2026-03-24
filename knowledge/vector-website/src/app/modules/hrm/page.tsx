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
  Users,
  CalendarDays,
  Clock,
  Award,
  BarChart3,
  GraduationCap,
  UserPlus,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "People Management",
    description:
      "Complete employee lifecycle from onboarding to offboarding. Organizational structure, department hierarchy, and employee profiles in one system.",
  },
  {
    icon: CalendarDays,
    title: "Shift Planning & Rostering",
    description:
      "Visual shift scheduling with templates, drag-and-drop assignment, and automatic conflict detection. Support for rotating shifts and flexible schedules.",
  },
  {
    icon: Clock,
    title: "Time & Attendance",
    description:
      "Integrated time tracking with clock-in/out, overtime calculation, and absence management. Direct integration with access control systems.",
  },
  {
    icon: Award,
    title: "Competence Matrix",
    description:
      "Track skills, certifications, and qualifications for every employee. Skills gap analysis ensures the right people are assigned to the right tasks.",
  },
  {
    icon: BarChart3,
    title: "Performance Management",
    description:
      "Structured performance reviews with goal setting, 360-degree feedback, and evaluation workflows. Track metrics that matter for manufacturing teams.",
  },
  {
    icon: GraduationCap,
    title: "Training & Development",
    description:
      "Career path planning, development plans, and training tracking. Ensure operators maintain required certifications and continuously build new skills.",
  },
  {
    icon: UserPlus,
    title: "Recruitment & Onboarding",
    description:
      "End-to-end hiring workflow from job posting to candidate management, interview scheduling, and structured onboarding checklists.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance & Documentation",
    description:
      "Automated compliance tracking, document management, and audit trails. Ensure all HR processes meet regulatory requirements.",
  },
];

const AI_CAPABILITIES = [
  "Predicts workforce demand based on production schedules, seasonal patterns, and historical attendance data",
  "Recommends optimal shift assignments by matching employee skills and certifications to production requirements",
  "Identifies retention risks early using engagement signals, performance trends, and tenure patterns",
  "Suggests personalized development plans based on career goals, skill gaps, and available training programs",
  "Analyzes attendance patterns to flag potential issues and recommend schedule adjustments",
];

const INTEGRATIONS = [
  {
    module: "MES",
    description:
      "Production schedules inform workforce requirements. Operator assignments in HRM flow to MES work stations. Skill requirements are validated automatically.",
  },
  {
    module: "CMMS",
    description:
      "Maintenance schedules drive technician shift planning. HRM ensures certified maintenance personnel are available when preventive tasks are due.",
  },
  {
    module: "HSE",
    description:
      "Safety incident reports link to employee records. Training requirements from HSE automatically generate development tasks in HRM.",
  },
  {
    module: "Gemba",
    description:
      "Tiered meeting attendance, task assignments, and team performance data flow between Gemba and HRM for complete workforce visibility.",
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

export default function HRMPage() {
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
        <Image src="/images/modules/hrm-hero.png" alt="" role="presentation" fill className={cn("object-cover object-center", isLight ? "opacity-[0.06]" : "opacity-[0.15]")} quality={75} priority />
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
              Human Resource Management
            </h1>
            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-400"
              )}
            >
              Your people are your most valuable asset. IRIS HRM connects
              workforce planning to production reality — ensuring the right
              people with the right skills are always in the right place.
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
              The IRIS HRM module provides comprehensive human resources
              management built specifically for manufacturing environments. Unlike
              generic HR software, it understands shift patterns, competence
              matrices, operator certifications, and the unique workforce
              challenges of running a production facility.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              From shift planning and time tracking to skills management and
              performance reviews, every HR process is connected to your
              production operations. When MES needs a certified operator or CMMS
              schedules a maintenance window, HRM ensures the right personnel are
              available and assigned.
            </p>
            <p
              className={cn(
                "text-lg leading-relaxed",
                isLight ? "text-slate-600" : "text-slate-300"
              )}
            >
              The result: optimized workforce utilization, reduced administrative
              overhead, better employee engagement, and the assurance that
              compliance requirements are always met — all powered by AI-driven
              recommendations and real-time analytics.
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
              title="Workforce Management for Manufacturing"
              description="Purpose-built HR tools that understand production environments — from shift rostering to competence tracking and everything in between."
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
              title="Smarter Workforce Decisions"
              description="IRIS AI turns your HR data into actionable insights — from predicting staffing needs to identifying retention risks before they become turnover."
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
                  src="/images/iris-ui/hrm-schedule.png"
                  alt="IRIS HRM — shift schedule planning with employee management"
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
              title="People Connected to Production"
              description="HRM bridges the gap between workforce management and shop floor operations — ensuring your people strategy supports your production strategy."
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
                Empower your workforce. Elevate your operations.
              </h2>
              <p
                className={cn(
                  "mt-4 text-lg leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-400"
                )}
              >
                See how IRIS HRM can transform your workforce management.
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
