"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import {
  Gauge,
  Bell,
  CheckSquare,
  LayoutDashboard,
  ArrowRight,
  Timer,
  Route,
} from "lucide-react";
import { useRef } from "react";

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

const RECOMMENDED = [
  { name: "MES", href: "/modules/mes" },
  { name: "Gemba", href: "/modules/gemba" },
  { name: "Tasking", href: "/modules/tasking" },
  { name: "Communicator", href: "/modules/communications" },
  { name: "KPI & Analytics", href: "/modules/kpi" },
] as const;

export default function PlantManagerPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const refHero = useRef<HTMLDivElement>(null);
  const refPain = useRef<HTMLDivElement>(null);
  const refLoop = useRef<HTMLDivElement>(null);
  const refModules = useRef<HTMLDivElement>(null);

  const inViewHero = useInView(refHero, { once: true, margin: "-80px" });
  const inViewPain = useInView(refPain, { once: true, margin: "-80px" });
  const inViewLoop = useInView(refLoop, { once: true, margin: "-80px" });
  const inViewModules = useInView(refModules, { once: true, margin: "-80px" });

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
        <Container size="lg" className="relative z-10">
          <div ref={refHero}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewHero ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Badge variant="purple">By Role</Badge>
                <span className={cn("text-xs font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                  Plant Manager
                </span>
              </div>

              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]", isLight ? "text-slate-900" : "text-white")}>
                Run the Plant with{" "}
                <span className="text-iris-violet">Fewer Surprises.</span>
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                IRIS gives you real-time production visibility, AI-driven tasking, and a communication
                loop tied to context — so issues get resolved fast and the plan stays on track.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                  Start Interactive Demo
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/modules/gemba" className="min-w-[240px]">
                  Explore Gemba Control
                </Button>
              </div>

              <div className="mt-12 w-full max-w-5xl mx-auto">
                <div
                  className={cn(
                    "rounded-2xl overflow-hidden border shadow-2xl",
                    isLight ? "border-black/[0.08] shadow-black/5" : "border-white/10 shadow-black/50"
                  )}
                >
                  <Image
                    src="/images/iris-ui/mes-supervisor.png"
                    alt="IRIS Supervisor Hub — OEE breakdown, alerts, and shift execution overview"
                    width={1920}
                    height={1080}
                    className="w-full h-auto"
                    quality={90}
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Pain → clarity */}
      <Section variant="alternate">
        <Container>
          <div ref={refPain}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewPain ? "animate" : "initial"}
            >
              <SectionHeader
                label="THE REAL PROBLEM"
                title="Most Plants Don’t Have a Visibility Problem. They Have an Execution Problem."
                description="When a breakdown or quality issue hits, the biggest loss is time: finding context, chasing people, and aligning decisions."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Bell,
                    title: "Signals without context",
                    description:
                      "Alarms fire, but people don’t know what matters, where it happened, and what action is required.",
                  },
                  {
                    icon: Route,
                    title: "Work without coordination",
                    description:
                      "Tasks are assigned ad‑hoc, priorities drift, and teams duplicate work or miss critical steps.",
                  },
                  {
                    icon: Timer,
                    title: "Slow response loops",
                    description:
                      "By the time the issue is understood, the line is already losing throughput and the schedule is broken.",
                  },
                ].map(({ icon: Icon, title, description }) => (
                  <motion.div key={title} variants={fadeInUp} className="h-full">
                    <Card variant="glow" padding="lg" className="h-full">
                      <div className="text-iris-violet mb-4">
                        <Icon className="h-8 w-8" aria-hidden />
                      </div>
                      <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>
                        {title}
                      </h3>
                      <p className={cn("mt-2 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                        {description}
                      </p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Closed loop */}
      <Section variant="default">
        <Container>
          <div ref={refLoop}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewLoop ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="THE IRIS LOOP"
                title="Detect → Assign → Execute → Verify"
                description="Your shop floor runs faster when every signal becomes owned work — with a deadline and proof."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 text-iris-violet">
                    <LayoutDashboard className="h-6 w-6" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      Operational control
                    </span>
                  </div>
                  <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    Gemba gives you a live shift view: production status, bottlenecks, escalations,
                    and the tasks that must happen now to protect throughput.
                  </p>
                  <div className="mt-6">
                    <Button variant="outline" size="md" href="/modules/gemba">
                      See Gemba
                    </Button>
                  </div>
                </Card>

                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 text-iris-violet">
                    <CheckSquare className="h-6 w-6" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      Tasking with accountability
                    </span>
                  </div>
                  <p className={cn("mt-4 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    Tasking assigns work based on the plan and current priorities. People can assign
                    tasks too — and AI recommends the right owner and deadline. Nothing disappears
                    without verification.
                  </p>
                  <div className="mt-6">
                    <Button variant="outline" size="md" href="/modules/tasking">
                      See Tasking
                    </Button>
                  </div>
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Recommended modules */}
      <Section variant="alternate">
        <Container>
          <div ref={refModules}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewModules ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="RECOMMENDED"
                title="Your Best Stack as a Plant Manager"
                description="Start with real-time visibility and add the execution fabric that eliminates chaos."
                align="center"
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {RECOMMENDED.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:border-iris-purple/30",
                      isLight
                        ? "border-black/[0.08] bg-white text-slate-900 hover:bg-slate-50"
                        : "border-white/10 bg-navy-800/60 text-white hover:bg-navy-800/80"
                    )}
                  >
                    {m.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section variant="default" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
              Want to See This on a Real Shift Scenario?
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              We’ll run the demo like a real plant: live OEE, alerts, tasks, and communication in context.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Launch Demo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" href="/contact" className="min-w-[240px]">
                Book a Call
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

