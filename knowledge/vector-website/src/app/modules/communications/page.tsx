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
  MessagesSquare,
  Bell,
  Users,
  Megaphone,
  Link2,
  ShieldCheck,
  ArrowRight,
  MessageCircle,
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

const FEATURES = [
  {
    icon: Link2,
    title: "Communication in Context",
    description:
      "Messages aren’t floating in a chat app. They’re tied to a line, machine, work order, shift, or incident — so everyone sees the same reality.",
  },
  {
    icon: Bell,
    title: "Alerts That Drive Action",
    description:
      "Turn alarms and anomalies into structured alerts. Escalate by rules, notify the right team, and link every alert to a task and a resolution.",
  },
  {
    icon: Users,
    title: "1:1 and Group Collaboration",
    description:
      "Create single and group channels for operations, maintenance, quality, logistics, or leadership — with auditability and clear ownership.",
  },
  {
    icon: Megaphone,
    title: "Organization Broadcasts",
    description:
      "Send plant-wide announcements, safety notices, or shift updates — and track acknowledgment when it matters.",
  },
] as const;

const INTEGRATIONS = [
  { name: "Tasking", href: "/modules/tasking" },
  { name: "Gemba", href: "/modules/gemba" },
  { name: "MES", href: "/modules/mes" },
  { name: "CMMS", href: "/modules/cmms" },
  { name: "QMS", href: "/modules/qms" },
] as const;

export default function CommunicationsPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const refHero = useRef<HTMLDivElement>(null);
  const refFeatures = useRef<HTMLDivElement>(null);
  const refOps = useRef<HTMLDivElement>(null);
  const refIntegrations = useRef<HTMLDivElement>(null);

  const inViewHero = useInView(refHero, { once: true, margin: "-80px" });
  const inViewFeatures = useInView(refFeatures, { once: true, margin: "-80px" });
  const inViewOps = useInView(refOps, { once: true, margin: "-80px" });
  const inViewIntegrations = useInView(refIntegrations, { once: true, margin: "-80px" });

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
          <div ref={refHero}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewHero ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-2 mb-5">
                <Badge variant="purple">Core Capability</Badge>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isLight ? "text-slate-600" : "text-slate-400"
                  )}
                >
                  Communication bus
                </span>
              </div>
              <h1
                className={cn(
                  "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                Communication That Understands{" "}
                <span className="text-iris-violet">Context.</span>
              </h1>
              <p
                className={cn(
                  "mt-6 text-lg sm:text-xl max-w-3xl leading-relaxed",
                  isLight ? "text-slate-600" : "text-slate-300"
                )}
              >
                Manufacturing communication fails when it’s disconnected from reality. IRIS connects
                messages, alerts, and decisions directly to operational context — machines, lines,
                work orders, and incidents — so teams move faster and waste less time.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Button variant="primary" size="lg" href="/demo" className="min-w-[260px]">
                  See Communicator in Action
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" href="/contact" className="min-w-[260px]">
                  Talk to Our Team
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
                    src="/images/iris-ui/gemba-communicator.png"
                    alt="IRIS Communicator — context-based messaging, alerts, and operational collaboration"
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

      {/* Section 2 — Why it matters */}
      <Section variant="alternate">
        <Container>
          <SectionHeader
            label="WHY COMMUNICATION"
            title="Speed Is a Competitive Advantage."
            description="The fastest plants aren’t just automated — they’re aligned. Clear communication turns signals into coordinated action."
            align="center"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-10">
            {[
              {
                title: "Less chaos",
                description:
                  "No more scattered WhatsApp groups or lost emails. Conversations live where the work lives — with structure and visibility.",
              },
              {
                title: "Faster response",
                description:
                  "Alerts route to the right people instantly, with all relevant context attached. That’s how downtime gets reduced.",
              },
              {
                title: "Better decisions",
                description:
                  "When everyone sees the same source of truth, decisions happen faster — and with fewer escalations caused by misunderstanding.",
              },
            ].map((item) => (
              <Card key={item.title} variant="glow" padding="lg">
                <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>
                  {item.title}
                </h3>
                <p className={cn("mt-3 leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 3 — Key features */}
      <Section variant="default">
        <Container>
          <div ref={refFeatures}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={inViewFeatures ? "animate" : "initial"}
            >
              <SectionHeader
                label="FEATURES"
                title="Messaging + Alerts + Broadcasts"
                description="One system for day-to-day collaboration and critical incident communication — fully integrated with IRIS operations."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <motion.div key={title} variants={fadeInUp} className="h-full">
                    <Card variant="glow" padding="lg" className="h-full">
                      <div className="flex gap-4">
                        <div className="text-iris-violet">
                          <Icon className="h-7 w-7" aria-hidden />
                        </div>
                        <div className="flex-1">
                          <h3
                            className={cn(
                              "font-semibold text-lg",
                              isLight ? "text-slate-900" : "text-white"
                            )}
                          >
                            {title}
                          </h3>
                          <p
                            className={cn(
                              "mt-2 leading-relaxed",
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
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Operational patterns */}
      <Section variant="alternate">
        <Container>
          <div ref={refOps}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewOps ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="OPERATIONAL PATTERNS"
                title="Designed for Real Manufacturing Work"
                description="From daily coordination to critical incidents — communication stays structured, searchable, and connected to outcomes."
                align="center"
              />

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 mb-3 text-iris-violet">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      Conversations with context
                    </span>
                  </div>
                  <ul className={cn("space-y-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    <li>- Threads tied to a specific line, machine, or work order.</li>
                    <li>- Attachments, photos, and checklists stay with the incident.</li>
                    <li>- Shift handovers preserve critical context automatically.</li>
                    <li>- Search across messages by asset, order, or time window.</li>
                  </ul>
                </Card>

                <Card variant="glow" padding="lg">
                  <div className="flex items-center gap-3 mb-3 text-iris-violet">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                    <span className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
                      Governance & traceability
                    </span>
                  </div>
                  <ul className={cn("space-y-2 text-sm leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                    <li>- Auditability when safety and compliance require it.</li>
                    <li>- Acknowledgments for critical announcements.</li>
                    <li>- Clear ownership and escalation paths for alerts.</li>
                    <li>- Tight integration with Tasking for closed-loop execution.</li>
                  </ul>
                </Card>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Integrations */}
      <Section variant="default">
        <Container>
          <div ref={refIntegrations}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inViewIntegrations ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
            >
              <SectionHeader
                label="INTEGRATES WITH"
                title="Connected to Execution"
                description="Communicator is most powerful when every alert can become a task — and every task has a conversation attached."
                align="center"
              />
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {INTEGRATIONS.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:border-iris-purple/30",
                      isLight
                        ? "border-black/[0.08] bg-white text-slate-900 hover:bg-slate-50"
                        : "border-white/10 bg-navy-800/60 text-white hover:bg-navy-800/80"
                    )}
                  >
                    {i.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 6 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className={cn("text-3xl sm:text-4xl font-bold tracking-tight", isLight ? "text-slate-900" : "text-white")}>
              Put Every Conversation Where the Work Happens
            </h2>
            <p className={cn("mt-4 text-base sm:text-lg", isLight ? "text-slate-600" : "text-slate-400")}>
              See how IRIS Communicator turns alerts into coordinated action — with context, traceability, and speed.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Launch Demo
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" href="/modules/tasking" className="min-w-[240px]">
                Explore Tasking
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

