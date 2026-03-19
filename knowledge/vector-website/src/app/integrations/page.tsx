"use client";

import { cn } from "@/lib/utils";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Cpu,
  Building2,
  MessageSquare,
  Cloud,
  ExternalLink,
  FileCode,
} from "lucide-react";

const INTEGRATION_CATEGORIES = [
  {
    icon: Cpu,
    title: "Industrial Equipment",
    description: "Connect directly to the machines that run your plant.",
    items: [
      "PLCs — Siemens, Allen-Bradley, Mitsubishi, Beckhoff",
      "SCADA & HMI systems",
      "IoT gateways & edge sensors",
      "OPC UA, MQTT, Modbus TCP/RTU",
    ],
  },
  {
    icon: Building2,
    title: "Enterprise Systems",
    description: "Unify shop-floor data with your business backbone.",
    items: [
      "SAP, Oracle, Microsoft Dynamics (ERP)",
      "Salesforce, HubSpot (CRM)",
      "Power BI, Tableau, Looker (Analytics)",
      "Active Directory, Okta, SAML SSO",
    ],
  },
  {
    icon: MessageSquare,
    title: "Alerts & Communication",
    description: "Route the right information to the right people, instantly.",
    items: [
      "Email — SMTP, Office 365, Gmail",
      "SMS & voice providers",
      "Microsoft Teams, Slack",
      "Mobile push notifications",
    ],
  },
  {
    icon: Cloud,
    title: "Cloud & Infrastructure",
    description: "Deploy anywhere — on-prem, hybrid, or full cloud.",
    items: [
      "AWS, Azure, Google Cloud",
      "Docker & Kubernetes",
      "REST & GraphQL APIs",
      "Webhooks & event streaming",
    ],
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const API_SNIPPET = `GET /api/v1/production/orders?status=active
Authorization: Bearer <token>

// Response
{
  "orders": [
    {
      "id": "ORD-001",
      "product": "Widget A",
      "quantity": 1000,
      "status": "in_progress"
    }
  ]
}`;

export default function IntegrationsPage() {
  const { theme } = useThemeContext();
  const isLight = theme === "light";
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const isInView1 = useInView(ref1, { once: true, margin: "-80px" });
  const isInView2 = useInView(ref2, { once: true, margin: "-80px" });
  const isInView3 = useInView(ref3, { once: true, margin: "-80px" });
  const isInView4 = useInView(ref4, { once: true, margin: "-80px" });

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
          <div ref={ref1}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-4xl mx-auto"
            >
              <h1 className={cn("text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]", isLight ? "text-slate-900" : "text-white")}>
                Plugs Into What You Already Have.
              </h1>
              <p className={cn("mt-6 text-lg sm:text-xl max-w-2xl leading-relaxed", isLight ? "text-slate-600" : "text-slate-400")}>
                IRIS doesn&apos;t ask you to rip and replace. It connects to your PLCs, ERPs,
                sensors, and cloud services through pre-built connectors and an API-first
                architecture — so you see value in weeks, not years.
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Section 2 — Integration Categories */}
      <Section variant="alternate">
        <Container>
          <div ref={ref2}>
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate={isInView2 ? "animate" : "initial"}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {INTEGRATION_CATEGORIES.map(({ icon: Icon, title, description, items }) => (
                <motion.div
                  key={title}
                  variants={fadeInUp}
                  className={cn("rounded-2xl border p-6 sm:p-8", isLight ? "bg-slate-50 border-black/[0.08]" : "bg-navy-800/50 border-white/5")}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-iris-purple/10 text-iris-violet">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className={cn("font-semibold text-lg", isLight ? "text-slate-900" : "text-white")}>{title}</h3>
                  </div>
                  <p className={cn("text-sm mb-4", isLight ? "text-slate-600" : "text-slate-400")}>{description}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className={cn("inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium", isLight ? "border-black/[0.08] bg-slate-100 text-slate-600" : "border-white/10 bg-white/5 text-slate-300")}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 3 — API-First */}
      <Section variant="default">
        <Container>
          <div ref={ref3}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView3 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="max-w-4xl mx-auto"
            >
              <SectionHeader
                label="Developer-Friendly"
                title="API-First Architecture"
                description="Every IRIS capability is exposed through well-documented REST APIs. Build custom integrations, connect third-party tools, or extend the platform with your own modules — no vendor lock-in, ever."
                align="center"
              />
              <div className={cn("mt-8 rounded-xl overflow-hidden border", isLight ? "border-black/[0.08] bg-slate-50" : "border-white/10 bg-navy-900/80")}>
                <div className={cn("flex items-center gap-2 px-4 py-3 border-b", isLight ? "border-black/[0.08] bg-slate-100" : "border-white/10 bg-navy-800/50")}>
                  <FileCode className="h-4 w-4 text-iris-cyan" />
                  <span className={cn("text-sm font-medium", isLight ? "text-slate-600" : "text-slate-400")}>
                    Example API call
                  </span>
                </div>
                <pre className={cn("p-6 overflow-x-auto text-sm font-mono leading-relaxed", isLight ? "text-slate-600" : "text-slate-300")}>
                  <code>{API_SNIPPET}</code>
                </pre>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — CTA */}
      <Section variant="alternate" padding="xl">
        <Container>
          <div ref={ref4}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView4 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button variant="primary" size="lg" href="/demo" className="min-w-[240px]">
                Talk to Our Integration Team
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="secondary" size="lg" href="/resources" className="min-w-[240px]">
                Browse Documentation
              </Button>
            </motion.div>
          </div>
        </Container>
      </Section>
    </>
  );
}
